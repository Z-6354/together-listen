/**
 * Together-listen: synced rooms + optional NetEase secondary proxy.
 */
const http = require("http");
const path = require("path");
const { Readable } = require("stream");
const express = require("express");
const { Server } = require("socket.io");
const netease = require("./netease-proxy");
const pairListenStore = require("./pair-listen-store");
const roomExtrasStore = require("./room-extras-store");
const roomLogic = require("./lib/room-logic");
const { normalizeUserName, pairListenNameKey } = require("./lib/user-name");
const opsLog = require("./ops-log");

const {
  MAX_QUEUE_SIZE,
  MAX_ROOM_EXTRA,
  trackMatchKey,
  currentTrack,
  normalizePlayMode,
  logicalPositionSec,
  freezePlayback,
  recordRoomPlay,
  findQueueIndex,
  filterTracksNotInQueue,
  pushTrack,
  pushTracks,
  playTrackNow,
  pushRoomExtra,
  favoriteAsTrack,
  addRoomFavorite,
  removeRoomFavoriteLike,
  stabilizeRoomPlayback,
  goNext,
  goPrev,
  removeQueueIndices,
} = roomLogic;

const app = express();
const server = http.createServer(app);

/** 线上主站（分享链接、日志提示）；Socket 额外放行 wannian.fun */
const PUBLIC_SITE_ORIGIN = (
  process.env.PUBLIC_SITE_ORIGIN || "https://wannian.fun"
).replace(/\/$/, "");

function hostnameFromOrigin(origin) {
  try {
    return new URL(origin).hostname;
  } catch {
    return "";
  }
}

function socketCorsAllowed(origin) {
  if (!origin) return true;
  /* 默认放行所有来源，便于内网 IP 调试；生产可设 SOCKET_CORS_RELAXED=0 仅允许白名单 */
  if (process.env.SOCKET_CORS_RELAXED !== "0") return true;
  const h = hostnameFromOrigin(origin);
  if (h === "wannian.fun" || h.endsWith(".wannian.fun")) return true;
  if (h === "localhost" || h === "127.0.0.1") return true;
  const extras = String(process.env.EXTRA_ORIGINS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  for (const e of extras) {
    if (!e) continue;
    if (e.startsWith("http")) {
      try {
        if (origin.startsWith(e.replace(/\/$/, ""))) return true;
      } catch {
        /* ignore */
      }
    } else if (h === e || h.endsWith(`.${e}`)) return true;
  }
  return false;
}

const io = new Server(server, {
  cors: {
    origin: (origin, callback) => {
      callback(null, socketCorsAllowed(origin));
    },
    methods: ["GET", "POST"],
  },
});

const PORT = Number(process.env.PORT) || 3847;
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC = path.join(__dirname, "public");

app.use(express.json({ limit: "64kb" }));
app.use(express.static(PUBLIC));

function nowMs() {
  return Date.now();
}

function makeRoom() {
  return {
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    anchorWallMs: 0,
    anchorPosSec: 0,
    listeners: new Set(),
    /** "loop" = 顺序循环；"random" = 随机下一首 */
    playMode: "loop",
    /** 房间共享音量 0～1，多端同步 */
    volume: 1,
    /** 本场：最后一人离开后清零 */
    pairListenSessionMs: new Map(),
    /** 累计：同一房间在进程内持续累加（不因散场清零） */
    pairListenTotalMs: new Map(),
    /** 断线后仍用于展示「和某人」的昵称 */
    lastKnownNames: new Map(),
    /** 防同一曲目短时间内重复 goNext（多端 ended / 漂移兜底） */
    lastNaturalEndIndex: -1,
    lastNaturalEndAt: 0,
    /** 房间内自建歌单集（持久化） */
    roomPlaylists: [],
    /** 房间内喜欢（持久化） */
    roomFavorites: [],
    recentPlays: [],
    playStats: { counts: {}, tracks: {} },
  };
}

const rooms = new Map();
const DEFAULT_ROOM_ID = "reserved";

/** 全局昵称占用：同名仅允许一个 clientId（浏览器）在线，同 clientId 重连则顶替旧连接 */
const nameHolders = new Map();

function releaseNameForSocket(socket) {
  for (const [key, holder] of nameHolders.entries()) {
    if (holder.socketId === socket.id) nameHolders.delete(key);
  }
}

/**
 * @returns {{ ok: boolean, name?: string, message?: string }}
 */
function claimDisplayName(socket, rawName, clientId) {
  const name = normalizeUserName(rawName);
  if (!name) {
    return { ok: false, message: "昵称不能为空（1～24 字）" };
  }
  const cid = String(clientId || "")
    .trim()
    .slice(0, 64);

  for (const [key, holder] of nameHolders.entries()) {
    if (holder.socketId === socket.id && key !== name) {
      nameHolders.delete(key);
    }
  }

  const existing = nameHolders.get(name);
  if (existing && existing.socketId !== socket.id) {
    const other = io.sockets.sockets.get(existing.socketId);
    if (other && cid && existing.clientId && existing.clientId === cid) {
      other.emit("sessionReplaced", {
        message: "同一浏览器已重新连接，旧连接已断开",
      });
      other.disconnect(true);
      nameHolders.delete(name);
    } else if (other) {
      return {
        ok: false,
        message: `昵称「${name}」已被其他人使用，请换一个`,
      };
    } else {
      nameHolders.delete(name);
    }
  }

  nameHolders.set(name, { socketId: socket.id, clientId: cid });
  socket.data.userName = name;
  socket.data.clientId = cid;
  return { ok: true, name };
}

function getOrCreateRoom(roomId) {
  const id = String(roomId || "").trim().slice(0, 32) || DEFAULT_ROOM_ID;
  if (!rooms.has(id)) {
    const room = makeRoom();
    room.pairListenTotalMs = pairListenStore.loadRoomTotals(id);
    const extras = roomExtrasStore.loadRoomExtras(id);
    room.queue = extras.queue;
    room.currentIndex = extras.currentIndex;
    room.isPlaying = extras.isPlaying;
    room.anchorPosSec = extras.anchorPosSec;
    room.anchorWallMs = extras.anchorWallMs;
    room.playMode = extras.playMode;
    room.volume = roomExtrasStore.normalizeRoomVolume(extras.volume);
    room.roomPlaylists = extras.roomPlaylists;
    room.roomFavorites = extras.roomFavorites;
    room.recentPlays = extras.recentPlays;
    room.playStats = extras.playStats;
    stabilizeRoomPlayback(room);
    rooms.set(id, room);
  }
  const room = rooms.get(id);
  /* 仅冻结「在播但无人」的异常状态，避免每次 getOrCreateRoom 清空同听本场 */
  if (room.listeners.size === 0 && room.isPlaying) {
    freezePlayback(room);
    persistRoomExtras(id, room);
  }
  return { id, room };
}

function displayNameForSocket(socketId) {
  const s = io.sockets.sockets.get(socketId);
  const n = s?.data?.userName;
  if (n && String(n).trim()) return String(n).trim();
  return `游客${String(socketId).slice(-4)}`;
}

function countAllListeners() {
  let n = 0;
  for (const r of rooms.values()) n += r.listeners.size;
  return n;
}

function logRoomOp(socket, roomId, action, detail = {}, source = "server") {
  opsLog.appendOp({
    source,
    roomId: roomId || "",
    user: socket?.id ? displayNameForSocket(socket.id) : "",
    socketId: socket?.id || "",
    action,
    detail,
  });
}

function logTrackChange(socket, roomId, room, reason, extra = {}) {
  const track = currentTrack(room);
  logRoomOp(socket, roomId, "trackChange", {
    reason,
    index: room.currentIndex,
    title: track?.title || null,
    url: track?.url ? String(track.url).slice(0, 160) : null,
    isPlaying: room.isPlaying,
    playMode: normalizePlayMode(room.playMode),
    ...extra,
  });
}

function adminAuth(req, res, next) {
  if (!opsLog.isAdminEnabled()) {
    return res.status(503).json({ error: "未配置 ADMIN_TOKEN，管理页已禁用" });
  }
  const token =
    req.query.token ||
    req.headers["x-admin-token"] ||
    String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!opsLog.adminTokenValid(token)) {
    return res.status(401).json({ error: "无效的管理员令牌" });
  }
  next();
}

app.get("/api/admin/status", adminAuth, (_req, res) => {
  res.json({ ok: true, enabled: true });
});

app.get("/api/admin/logs", adminAuth, (req, res) => {
  res.json({
    logs: opsLog.getLogs({
      since: req.query.since,
      limit: req.query.limit,
    }),
  });
});

app.get("/api/admin/stats", adminAuth, (_req, res) => {
  res.json(
    opsLog.getServerStats({
      countRooms: () => rooms.size,
      countListeners: countAllListeners,
    }),
  );
});

function listenerNameSet(room) {
  const names = new Set();
  for (const sid of room.listeners) {
    const n = normalizeUserName(displayNameForSocket(sid));
    if (n) names.add(n);
  }
  return names;
}

function rememberPeerName(room, socketId) {
  room.lastKnownNames.set(socketId, displayNameForSocket(socketId));
}

function peerDisplayName(room, socketId) {
  const live = io.sockets.sockets.get(socketId);
  if (live) return displayNameForSocket(socketId);
  const cached = room.lastKnownNames.get(socketId);
  if (cached && String(cached).trim()) return String(cached).trim();
  return `已离开·${String(socketId).slice(-4)}`;
}

/** 房间内 ≥2 人时，为所有同时在房的无序对各增加 deltaMs */
function tickRoomPairListen(roomId, room, deltaMs) {
  if (room.listeners.size < 2) return;
  const entries = [...room.listeners].map((sid) => ({
    sid,
    name: displayNameForSocket(sid),
  }));
  const n = entries.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const k = pairListenNameKey(entries[i].name, entries[j].name);
      if (!k) continue;
      room.pairListenSessionMs.set(
        k,
        (room.pairListenSessionMs.get(k) || 0) + deltaMs,
      );
      room.pairListenTotalMs.set(k, (room.pairListenTotalMs.get(k) || 0) + deltaMs);
    }
  }
  pairListenStore.persistRoomTotals(roomId, room.pairListenTotalMs);
}

function buildTogetherWithPeers(room, selfId) {
  const selfName = normalizeUserName(displayNameForSocket(selfId));
  const onlineNames = listenerNameSet(room);
  const keySet = new Set([
    ...room.pairListenSessionMs.keys(),
    ...room.pairListenTotalMs.keys(),
  ]);
  const rows = [];
  for (const key of keySet) {
    const sessionMs = room.pairListenSessionMs.get(key) || 0;
    const totalMs = room.pairListenTotalMs.get(key) || 0;
    if (!sessionMs && !totalMs) continue;
    const parts = key.split("|");
    if (parts.length !== 2) continue;
    const [x, y] = parts;
    let otherName = null;
    if (x === selfName) otherName = y;
    else if (y === selfName) otherName = x;
    if (!otherName) continue;
    rows.push({
      otherId: otherName,
      otherName,
      sessionMs,
      totalMs,
      otherOnline: onlineNames.has(otherName),
    });
  }
  rows.sort((a, b) => {
    if (b.totalMs !== a.totalMs) return b.totalMs - a.totalMs;
    if (b.sessionMs !== a.sessionMs) return b.sessionMs - a.sessionMs;
    try {
      return a.otherName.localeCompare(b.otherName, "zh-Hans-CN");
    } catch {
      return a.otherName < b.otherName ? -1 : a.otherName > b.otherName ? 1 : 0;
    }
  });
  return rows;
}

/** 全员离开后仅清零「本次」；保留昵称与「累计」 */
function clearRoomSessionStats(room) {
  room.pairListenSessionMs.clear();
}

/** 房间内无人时冻结进度并暂停，避免重进房时锚点漂移 */
function onRoomLastListenerLeft(room, roomId) {
  if (!room || room.listeners.size > 0) return;
  clearRoomSessionStats(room);
  freezePlayback(room);
  if (roomId) persistRoomExtras(roomId, room);
}

function buildRoomMembers(room) {
  const members = [];
  for (const sid of room.listeners) {
    members.push({
      id: sid,
      name: displayNameForSocket(sid),
      online: true,
    });
  }
  members.sort((a, b) => {
    try {
      const c = a.name.localeCompare(b.name, "zh-Hans-CN");
      return c !== 0 ? c : a.id.localeCompare(b.id);
    } catch {
      const c = a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      return c !== 0 ? c : a.id.localeCompare(b.id);
    }
  });
  return members;
}

function buildRoomStatePayload(roomId, room, socketId) {
  const track = currentTrack(room);
  return {
    roomId,
    queue: room.queue,
    currentIndex: room.currentIndex,
    isPlaying: room.isPlaying,
    anchorWallMs: room.anchorWallMs,
    anchorPosSec: room.anchorPosSec,
    currentUrl: track ? track.url : null,
    currentTitle: track ? track.title : null,
    listenerCount: room.listeners.size,
    members: buildRoomMembers(room),
    playMode: normalizePlayMode(room.playMode),
    volume: roomExtrasStore.normalizeRoomVolume(room.volume),
    togetherWithPeers: buildTogetherWithPeers(room, socketId),
    roomPlaylists: room.roomPlaylists || [],
    roomFavorites: room.roomFavorites || [],
    recentPlays: (room.recentPlays || []).slice(0, 10),
    topPlays: getTopPlays(room, 10),
  };
}

function persistRoomExtras(roomId, room) {
  roomExtrasStore.persistRoomExtras(roomId, room);
}

function getTopPlays(room, limit = 25) {
  const stats = room.playStats || { counts: {}, tracks: {} };
  return Object.entries(stats.counts || {})
    .map(([key, count]) => ({
      count: Number(count) || 0,
      track: stats.tracks?.[key] || null,
    }))
    .filter((x) => x.track && x.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function findRoomPlaylist(room, playlistId) {
  const pid = String(playlistId || "").trim();
  return (room.roomPlaylists || []).find((p) => p.id === pid) || null;
}

function emitStateToSocket(roomId, socketId) {
  const room = rooms.get(roomId);
  if (!room) return;
  const sock = io.sockets.sockets.get(socketId);
  if (!sock) return;
  sock.emit("state", buildRoomStatePayload(roomId, room, socketId));
}

function broadcastRoom(roomId) {
  const { room } = getOrCreateRoom(roomId);
  stabilizeRoomPlayback(room);
  persistRoomExtras(roomId, room);
  for (const sid of room.listeners) {
    emitStateToSocket(roomId, sid);
  }
}

/** 新听众进房：通知房间内其他人（不含进房者本人） */
function notifyRoomListenerJoined(roomId, room, joinerSocketId) {
  const joinerName = displayNameForSocket(joinerSocketId);
  const payload = {
    roomId,
    userName: joinerName,
    listenerCount: room.listeners.size,
    joinedAt: Date.now(),
  };
  for (const sid of room.listeners) {
    if (sid === joinerSocketId) continue;
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    sock.emit("listenerJoined", payload);
  }
}

/* ---------- NetEase HTTP API (secondary proxy) ---------- */

app.get("/api/netease/status", async (_req, res) => {
  try {
    const st = await netease.loginStatus();
    res.json(st);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.post("/api/netease/cookie", (req, res) => {
  const raw = String(req.body?.cookie || "").trim();
  if (!raw) {
    res.status(400).json({ error: "cookie 不能为空" });
    return;
  }
  netease.saveCookie(raw);
  res.json({ ok: true });
});

app.post("/api/netease/logout", (_req, res) => {
  netease.clearCookie();
  res.json({ ok: true });
});

app.post("/api/netease/login/qr/start", async (_req, res) => {
  try {
    const data = await netease.startQrLogin();
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/login/qr/check", async (req, res) => {
  try {
    const key = String(req.query.key || "");
    if (!key) {
      res.status(400).json({ error: "missing key" });
      return;
    }
    const data = await netease.checkQrLogin(key);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/search", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ error: "missing q" });
      return;
    }
    const type = String(req.query.type || "song").toLowerCase();
    const limit = req.query.limit;
    if (type === "playlist") {
      const playlists = await netease.searchPlaylists(q, limit);
      res.json({ playlists, total: playlists.length });
      return;
    }
    if (type === "lyric") {
      const songs = await netease.searchLyrics(q, limit);
      res.json({ songs, total: songs.length });
      return;
    }
    if (type === "artist") {
      const artists = await netease.searchArtists(q, limit);
      res.json({ artists, total: artists.length });
      return;
    }
    const songs = await netease.searchSongs(q, limit);
    res.json({ songs, total: songs.length });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/search/playlists", async (req, res) => {
  try {
    const q = String(req.query.q || "").trim();
    if (!q) {
      res.status(400).json({ error: "missing q" });
      return;
    }
    const playlists = await netease.searchPlaylists(q, req.query.limit);
    res.json({ playlists });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/playlists", async (_req, res) => {
  try {
    const playlists = await netease.getUserPlaylists();
    res.json({ playlists });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/xiaoyan/playlists", async (_req, res) => {
  try {
    const playlists = await netease.getXiaoyanPlaylists();
    res.json({
      playlists,
      creator: netease.XIAOYAN_NETEASE_CREATOR,
    });
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/xiaoyan/comments", async (req, res) => {
  try {
    const limit = req.query.limit;
    const time = req.query.time;
    const data = await netease.getXiaoyanComments({ limit, time });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

app.get("/api/netease/playlist/:id", async (req, res) => {
  try {
    const data = await netease.getPlaylistTracks(req.params.id);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: String(e.message || e) });
  }
});

/** Pipe upstream audio; supports Range for seek. */
app.get("/api/netease/stream/:id", async (req, res) => {
  const id = String(req.params.id || "").replace(/\D/g, "");
  if (!id) {
    res.status(400).end();
    return;
  }
  try {
    const upstreamUrl = await netease.resolveUpstreamUrl(id);
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    if (netease.getCookie()) headers.Cookie = netease.getCookie();

    const upstream = await fetch(upstreamUrl, { headers, redirect: "follow" });
    if (!upstream.ok) {
      res.status(upstream.status).json({ error: "upstream failed" });
      return;
    }

    res.status(upstream.status);
    const pass = ["content-type", "content-length", "content-range", "accept-ranges"];
    pass.forEach((h) => {
      const v = upstream.headers.get(h);
      if (v) res.setHeader(h, v);
    });
    res.setHeader("Cache-Control", "no-store");

    if (upstream.body) {
      Readable.fromWeb(upstream.body).pipe(res);
    } else {
      res.end();
    }
  } catch (e) {
    console.warn("[netease] stream %s:", id, e.message);
    if (!res.headersSent) {
      res.status(502).json({ error: String(e.message || e) });
    }
  }
});

/* ---------- Socket.io rooms ---------- */

io.on("connection", (socket) => {
  let joinedRoomId = null;

  socket.on("userOp", (raw) => {
    if (!joinedRoomId) return;
    const action = String(raw?.action || "").trim().slice(0, 48);
    if (!action) return;
    const detail =
      raw?.detail && typeof raw.detail === "object" ? raw.detail : {};
    opsLog.appendOp({
      source: "client",
      roomId: joinedRoomId,
      user: displayNameForSocket(socket.id),
      socketId: socket.id,
      action,
      detail,
    });
  });

  socket.on("setDisplayName", (payload) => {
    const raw = typeof payload === "string" ? payload : payload?.name;
    const clientId =
      typeof payload === "object" && payload ? payload.clientId : undefined;
    const claimed = claimDisplayName(socket, raw, clientId);
    if (!claimed.ok) {
      socket.emit("displayNameError", { message: claimed.message });
      return;
    }
    socket.emit("displayNameOk", { name: claimed.name });
    if (joinedRoomId) {
      const r = rooms.get(joinedRoomId);
      if (r) rememberPeerName(r, socket.id);
      broadcastRoom(joinedRoomId);
    }
  });

  socket.on("join", (payload) => {
    let rawRoomId;
    let userNameOpt = null;
    let clientIdOpt = null;
    if (payload == null) {
      rawRoomId = DEFAULT_ROOM_ID;
    } else if (typeof payload === "string") {
      rawRoomId = payload;
    } else if (typeof payload === "object") {
      rawRoomId = payload.roomId;
      userNameOpt = payload.userName;
      clientIdOpt = payload.clientId;
    }
    const claimed = claimDisplayName(socket, userNameOpt, clientIdOpt);
    if (!claimed.ok) {
      socket.emit("joinError", { message: claimed.message });
      return;
    }

    if (joinedRoomId) {
      socket.leave(joinedRoomId);
      const prev = rooms.get(joinedRoomId);
      if (prev) {
        rememberPeerName(prev, socket.id);
        prev.listeners.delete(socket.id);
        onRoomLastListenerLeft(prev, joinedRoomId);
        broadcastRoom(joinedRoomId);
      }
    }
    const { id, room } = getOrCreateRoom(rawRoomId);
    joinedRoomId = id;
    socket.join(id);
    const listenersBeforeJoin = room.listeners.size;
    room.listeners.add(socket.id);
    rememberPeerName(room, socket.id);
    socket.emit("joined", { roomId: id, selfId: socket.id });
    logRoomOp(socket, id, "join", { listeners: room.listeners.size });
    if (listenersBeforeJoin > 0) {
      notifyRoomListenerJoined(id, room, socket.id);
    }
    broadcastRoom(id);
  });

  socket.on("leaveRoom", () => {
    if (!joinedRoomId) return;
    const leftId = joinedRoomId;
    logRoomOp(socket, leftId, "leave", {});
    socket.leave(leftId);
    const room = rooms.get(leftId);
    if (room) {
      rememberPeerName(room, socket.id);
      room.listeners.delete(socket.id);
      onRoomLastListenerLeft(room, leftId);
      broadcastRoom(leftId);
    }
    joinedRoomId = null;
    socket.emit("leftRoom", { roomId: leftId });
  });

  socket.on("playStatTrack", async (raw) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    try {
      let track = null;
      const songId = netease.parseSongId(raw?.id ?? raw?.neteaseId ?? raw?.url);
      if (songId) {
        track = await netease.buildTrack(
          songId,
          String(raw?.title || "").trim(),
        );
      } else if (raw?.url) {
        track = {
          url: String(raw.url).trim(),
          title: String(raw?.title || raw.url).trim(),
          source: "url",
        };
      }
      if (!track) {
        socket.emit("errorMsg", { message: "无法播放该曲目" });
        return;
      }
      if (!playTrackNow(room, track)) {
        socket.emit("errorMsg", {
          message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
        });
        return;
      }
      logTrackChange(socket, joinedRoomId, room, "playStatTrack");
      broadcastRoom(joinedRoomId);
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("addTrack", async ({ url, title }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const u = String(url || "").trim();
    if (!u) return;

    const neteaseId = netease.parseSongId(u);
    if (neteaseId) {
      try {
        const track = await netease.buildTrack(neteaseId, String(title || "").trim());
        if (!pushTrack(room, track)) {
          socket.emit("errorMsg", {
            message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
          });
          return;
        }
        logRoomOp(socket, joinedRoomId, "addTrack", {
          title: track.title,
          queueLen: room.queue.length,
        });
        broadcastRoom(joinedRoomId);
        socket.emit("infoMsg", {
          message: `已加入队列「${track.title || "曲目"}」`,
        });
      } catch (e) {
        socket.emit("errorMsg", { message: String(e.message || e) });
      }
      return;
    }

    const t = String(title || path.basename(u) || "Track").slice(0, 200);
    if (!pushTrack(room, { url: u, title: t, source: "url" })) {
      socket.emit("errorMsg", {
        message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
      });
      return;
    }
    logRoomOp(socket, joinedRoomId, "addTrack", {
      title: t,
      queueLen: room.queue.length,
    });
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: `已加入队列「${t}」` });
  });

  socket.on("addNeteaseTrack", async ({ id, title }) => {
    if (!joinedRoomId) return;
    const songId = netease.parseSongId(id);
    if (!songId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    try {
      const track = await netease.buildTrack(songId, String(title || "").trim());
      if (!pushTrack(room, track)) {
        socket.emit("errorMsg", {
          message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
        });
        return;
      }
      logRoomOp(socket, joinedRoomId, "addNeteaseTrack", {
        title: track.title,
        neteaseId: track.neteaseId,
        queueLen: room.queue.length,
      });
      broadcastRoom(joinedRoomId);
      socket.emit("infoMsg", {
        message: `已加入队列「${track.title || "曲目"}」`,
      });
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("addNeteaseTracks", async ({ tracks }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const list = Array.isArray(tracks) ? tracks : [];
    if (!list.length) return;
    const built = [];
    for (const item of list.slice(0, MAX_QUEUE_SIZE)) {
      const songId = netease.parseSongId(item?.id);
      if (!songId) continue;
      const title = String(item?.title || "").trim();
      built.push(
        netease.trackFromFormatted({
          id: songId,
          title: title || undefined,
          name: title || `#${songId}`,
        }),
      );
    }
    if (!built.length) return;
    const { added, dropped } = pushTracks(room, built);
    broadcastRoom(joinedRoomId);
    if (added === 0) {
      socket.emit("errorMsg", {
        message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
      });
      return;
    }
    if (dropped > 0) {
      socket.emit("infoMsg", {
        message: `已加入 ${added} 首，另有 ${dropped} 首因队列上限（${MAX_QUEUE_SIZE} 首）未加入`,
      });
    } else {
      socket.emit("infoMsg", {
        message: added === 1 ? "已加入 1 首" : `已加入 ${added} 首`,
      });
    }
  });

  socket.on("addNeteasePlaylist", async ({ playlistId }) => {
    if (!joinedRoomId) return;
    const pid = String(playlistId || "").replace(/\D/g, "");
    if (!pid) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    try {
      const pl = await netease.getPlaylistTracks(pid);
      const tracks = pl.tracks.map((song) => netease.trackFromFormatted(song));
      const { added, dropped } = pushTracks(room, tracks);
      broadcastRoom(joinedRoomId);
      if (added === 0 && tracks.length > 0) {
        socket.emit("errorMsg", {
          message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
        });
        return;
      }
      if (dropped > 0) {
        socket.emit("infoMsg", {
          message: `歌单「${pl.name}」播放队列最多 ${MAX_QUEUE_SIZE} 首，仅加入了前 ${added} 首`,
        });
        return;
      }
      socket.emit("infoMsg", {
        message: `歌单「${pl.name}」已加入 ${added} 首`,
      });
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("removeTrack", (index) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const i = Number(index);
    const title = room.queue[i]?.title || "曲目";
    const n = removeQueueIndices(room, [index]);
    if (!n) return;
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: `已从队列移除「${title}」` });
  });

  socket.on("removeTracks", (payload) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    let indices = [];
    if (Array.isArray(payload)) indices = payload;
    else if (payload && typeof payload === "object") {
      indices = payload.indices ?? payload.indexes ?? [];
    } else if (payload != null && payload !== "") {
      indices = [payload];
    }
    const n = removeQueueIndices(room, indices);
    if (!n) return;
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", {
      message: n === 1 ? "已从队列移除 1 首" : `已从队列移除 ${n} 首`,
    });
  });

  socket.on("clearQueue", () => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (!room.queue.length) return;
    room.queue.length = 0;
    room.currentIndex = -1;
    room.isPlaying = false;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: "已清空播放队列" });
  });

  /** direction: -1 = up (swap with i-1), +1 = down (swap with i+1) */
  socket.on("moveTrack", ({ index, direction }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const i = Number(index);
    const d = Number(direction);
    if (i < 0 || i >= room.queue.length) return;
    if (d !== -1 && d !== 1) return;
    const j = i + d;
    if (j < 0 || j >= room.queue.length) return;
    const tmp = room.queue[i];
    room.queue[i] = room.queue[j];
    room.queue[j] = tmp;
    if (room.currentIndex === i) room.currentIndex = j;
    else if (room.currentIndex === j) room.currentIndex = i;
    broadcastRoom(joinedRoomId);
  });

  socket.on("play", () => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (!currentTrack(room)) return;
    if (room.isPlaying) return;
    room.isPlaying = true;
    room.anchorWallMs = nowMs();
    if (room.anchorPosSec < 0) room.anchorPosSec = 0;
    logRoomOp(socket, joinedRoomId, "play", {
      posSec: Math.round(room.anchorPosSec * 10) / 10,
    });
    broadcastRoom(joinedRoomId);
  });

  socket.on("pause", () => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (!room.isPlaying) return;
    room.anchorPosSec = logicalPositionSec(room);
    room.isPlaying = false;
    room.anchorWallMs = nowMs();
    logRoomOp(socket, joinedRoomId, "pause", {
      posSec: Math.round(room.anchorPosSec * 10) / 10,
    });
    broadcastRoom(joinedRoomId);
  });

  socket.on("seek", (sec) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (!currentTrack(room)) return;
    const s = Math.max(0, Number(sec) || 0);
    room.anchorPosSec = s;
    room.anchorWallMs = nowMs();
    const track = currentTrack(room);
    logRoomOp(socket, joinedRoomId, "seek", {
      posSec: Math.round(s * 10) / 10,
      title: track?.title || null,
    });
    broadcastRoom(joinedRoomId);
  });

  socket.on("setPlayMode", (raw) => {
    if (!joinedRoomId) return;
    const mode = normalizePlayMode(
      typeof raw === "string" ? raw : raw?.mode || raw?.playMode,
    );
    const { room } = getOrCreateRoom(joinedRoomId);
    room.playMode = mode;
    logRoomOp(socket, joinedRoomId, "setPlayMode", { mode });
    broadcastRoom(joinedRoomId);
  });

  socket.on("setVolume", (raw) => {
    if (!joinedRoomId) return;
    const v = roomExtrasStore.normalizeRoomVolume(
      typeof raw === "number" ? raw : raw?.volume,
    );
    const { room } = getOrCreateRoom(joinedRoomId);
    room.volume = v;
    logRoomOp(socket, joinedRoomId, "setVolume", {
      volume: v,
      pct: Math.round(v * 100),
    });
    broadcastRoom(joinedRoomId);
  });

  /** 客户端音频自然结束；atIndex 须与服务器当前曲一致 */
  socket.on("trackNaturalEnd", ({ atIndex }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const idx = Number(atIndex);
    if (idx !== room.currentIndex) {
      /* A 已切歌而 B 仍停在旧曲结尾：单独补发状态，避免 B 卡在 ended */
      emitStateToSocket(joinedRoomId, socket.id);
      return;
    }
    const now = nowMs();
    if (
      room.lastNaturalEndIndex === room.currentIndex &&
      now - room.lastNaturalEndAt < 1200
    ) {
      emitStateToSocket(joinedRoomId, socket.id);
      return;
    }
    room.lastNaturalEndIndex = room.currentIndex;
    room.lastNaturalEndAt = now;
    if (!currentTrack(room)) {
      room.isPlaying = false;
      room.anchorPosSec = 0;
      room.anchorWallMs = nowMs();
      logRoomOp(socket, joinedRoomId, "trackNaturalEnd", {
        atIndex: idx,
        result: "queueEmpty",
      });
      broadcastRoom(joinedRoomId);
      return;
    }
    goNext(room);
    logTrackChange(socket, joinedRoomId, room, "naturalEnd", { atIndex: idx });
    broadcastRoom(joinedRoomId);
  });

  socket.on("next", () => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (goNext(room)) {
      logTrackChange(socket, joinedRoomId, room, "next");
      broadcastRoom(joinedRoomId);
    }
  });

  socket.on("prev", () => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if (goPrev(room)) {
      logTrackChange(socket, joinedRoomId, room, "prev");
      broadcastRoom(joinedRoomId);
    }
  });

  socket.on("select", (index) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const i = Number(index);
    if (i < 0 || i >= room.queue.length) return;
    room.currentIndex = i;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    room.isPlaying = true;
    const t = currentTrack(room);
    if (t) recordRoomPlay(room, t);
    logTrackChange(socket, joinedRoomId, room, "select", { selectIndex: i });
    broadcastRoom(joinedRoomId);
  });

  socket.on("playNeteaseNow", async ({ id, title }) => {
    if (!joinedRoomId) return;
    const songId = netease.parseSongId(id);
    if (!songId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    try {
      const track = await netease.buildTrack(songId, String(title || "").trim());
      if (!playTrackNow(room, track)) {
        socket.emit("errorMsg", {
          message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
        });
        return;
      }
      logTrackChange(socket, joinedRoomId, room, "playNeteaseNow", {
        neteaseId: songId,
      });
      broadcastRoom(joinedRoomId);
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  /** 播放第一首并将其余曲目按顺序追加到队列 */
  socket.on("playNeteaseTracks", async ({ tracks }) => {
    if (!joinedRoomId) return;
    const list = Array.isArray(tracks) ? tracks : [];
    if (!list.length) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const built = [];
    for (const item of list.slice(0, MAX_QUEUE_SIZE)) {
      const songId = netease.parseSongId(item?.id);
      if (!songId) continue;
      const title = String(item?.title || "").trim();
      try {
        built.push(await netease.buildTrack(songId, title));
      } catch (_) {
        built.push(
          netease.trackFromFormatted({
            id: songId,
            title: title || undefined,
            name: title || `#${songId}`,
          }),
        );
      }
    }
    if (!built.length) return;
    if (!playTrackNow(room, built[0])) {
      socket.emit("errorMsg", {
        message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
      });
      return;
    }
    let capDropped = 0;
    let skippedDup = 0;
    if (built.length > 1) {
      const restBuilt = built.slice(1);
      const toQueue = filterTracksNotInQueue(room, restBuilt);
      skippedDup = restBuilt.length - toQueue.length;
      const rest = pushTracks(room, toQueue);
      capDropped = rest.dropped;
    }
    logTrackChange(socket, joinedRoomId, room, "playNeteaseTracks", {
      count: built.length,
    });
    broadcastRoom(joinedRoomId);
    if (capDropped > 0) {
      socket.emit("infoMsg", {
        message: `正在播放第 1 首，另有 ${capDropped} 首因队列上限（${MAX_QUEUE_SIZE} 首）未加入`,
      });
    } else if (skippedDup > 0) {
      socket.emit("infoMsg", {
        message: `正在播放第 1 首，另有 ${skippedDup} 首已在队列中`,
      });
    }
  });

  socket.on("createRoomPlaylist", ({ name }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if ((room.roomPlaylists || []).length >= 20) {
      socket.emit("errorMsg", { message: "房间歌单数量已达上限（20）" });
      return;
    }
    const n = String(name || "新歌单").trim().slice(0, 32) || "新歌单";
    room.roomPlaylists.push({
      id: roomExtrasStore.newPlaylistId(),
      name: n,
      tracks: [],
    });
    persistRoomExtras(joinedRoomId, room);
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: `已创建歌单「${n}」` });
  });

  socket.on("renameRoomPlaylist", ({ playlistId, name }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const pl = findRoomPlaylist(room, playlistId);
    if (!pl) return;
    pl.name = String(name || pl.name).trim().slice(0, 32) || pl.name;
    persistRoomExtras(joinedRoomId, room);
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: `已重命名为「${pl.name}」` });
  });

  socket.on("deleteRoomPlaylist", ({ playlistId }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    if ((room.roomPlaylists || []).length <= 1) {
      socket.emit("errorMsg", { message: "至少保留一个房间歌单" });
      return;
    }
    const pid = String(playlistId || "").trim();
    const removed = room.roomPlaylists.find((p) => p.id === pid);
    room.roomPlaylists = room.roomPlaylists.filter((p) => p.id !== pid);
    persistRoomExtras(joinedRoomId, room);
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", {
      message: removed?.name ? `已删除歌单「${removed.name}」` : "已删除歌单",
    });
  });

  socket.on("addRoomPlaylistTrack", async (raw) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const pl = findRoomPlaylist(room, raw?.playlistId);
    if (!pl) {
      socket.emit("errorMsg", { message: "歌单不存在" });
      return;
    }
    try {
      let track = null;
      const songId = netease.parseSongId(raw?.id ?? raw?.neteaseId);
      if (songId) {
        track = await netease.buildTrack(
          songId,
          String(raw?.title || "").trim(),
        );
      }
      if (!track) {
        socket.emit("errorMsg", { message: "请从搜索选择歌曲添加" });
        return;
      }
      if (pl.tracks.length >= MAX_ROOM_EXTRA) {
        socket.emit("errorMsg", {
          message: `该歌单已满（最多 ${MAX_ROOM_EXTRA} 首）`,
        });
        return;
      }
      const key = trackMatchKey(track);
      if (key && pl.tracks.some((t) => trackMatchKey(t) === key)) {
        socket.emit("infoMsg", { message: "歌曲已在该歌单中" });
        return;
      }
      pl.tracks.push(track);
      persistRoomExtras(joinedRoomId, room);
      broadcastRoom(joinedRoomId);
      socket.emit("infoMsg", {
        message: `已加入歌单「${pl.name}」`,
      });
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("removeRoomPlaylistTrack", ({ playlistId, index }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const pl = findRoomPlaylist(room, playlistId);
    if (!pl) return;
    const i = Number(index);
    if (i < 0 || i >= pl.tracks.length) return;
    pl.tracks.splice(i, 1);
    persistRoomExtras(joinedRoomId, room);
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: `已从歌单「${pl.name}」移除` });
  });

  socket.on("addRoomFavorite", async (raw) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    try {
      let track = null;
      if (raw?.fromQueueIndex != null) {
        const qi = Number(raw.fromQueueIndex);
        if (qi >= 0 && qi < room.queue.length) {
          track = { ...room.queue[qi] };
        }
      }
      if (!track) {
        const url = String(raw?.url || "").trim();
        const songId = netease.parseSongId(raw?.id ?? raw?.neteaseId ?? url);
        if (songId) {
          track = await netease.buildTrack(
            songId,
            String(raw?.title || "").trim(),
          );
        } else if (url) {
          track = {
            url,
            title: String(raw?.title || url).trim(),
            source: "url",
          };
        }
      }
      if (!track) {
        socket.emit("errorMsg", { message: "当前无可用曲目" });
        return;
      }
      const userName = normalizeUserName(displayNameForSocket(socket.id));
      const favResult = addRoomFavorite(room, track, userName);
      if (favResult === false) {
        socket.emit("errorMsg", {
          message: userName
            ? `房间喜欢已满（最多 ${MAX_ROOM_EXTRA} 首）`
            : "请先设置昵称再加入喜欢",
        });
        return;
      }
      if (favResult === "duplicate") {
        socket.emit("infoMsg", { message: "你已喜欢过这首歌" });
        return;
      }
      persistRoomExtras(joinedRoomId, room);
      broadcastRoom(joinedRoomId);
      socket.emit("infoMsg", {
        message:
          favResult === "added_user" ? "已加入你的喜欢" : "已加入房间喜欢",
      });
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("removeRoomFavorite", (index) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    const i = Number(index);
    const userName = normalizeUserName(displayNameForSocket(socket.id));
    if (!removeRoomFavoriteLike(room, i, userName)) {
      socket.emit("errorMsg", { message: "未能取消喜欢" });
      return;
    }
    persistRoomExtras(joinedRoomId, room);
    broadcastRoom(joinedRoomId);
    socket.emit("infoMsg", { message: "已取消喜欢" });
  });

  socket.on("playRoomExtra", async ({ list, playlistId, index }) => {
    if (!joinedRoomId) return;
    const { room } = getOrCreateRoom(joinedRoomId);
    let item = null;
    const i = Number(index);
    if (list === "favorites") {
      if (i < 0 || i >= room.roomFavorites.length) return;
      item = favoriteAsTrack(room.roomFavorites[i]);
    } else {
      const pl = findRoomPlaylist(room, playlistId);
      if (!pl || i < 0 || i >= pl.tracks.length) return;
      item = pl.tracks[i];
    }
    try {
      let track = item;
      if (item.neteaseId && !item.url?.includes("/api/netease/stream/")) {
        track = await netease.buildTrack(item.neteaseId, item.title);
      }
      if (!playTrackNow(room, track)) {
        socket.emit("errorMsg", {
          message: `播放队列已满（最多 ${MAX_QUEUE_SIZE} 首）`,
        });
        return;
      }
      logTrackChange(socket, joinedRoomId, room, "playRoomExtra", {
        list: list || "playlist",
        index: i,
      });
      broadcastRoom(joinedRoomId);
    } catch (e) {
      socket.emit("errorMsg", { message: String(e.message || e) });
    }
  });

  socket.on("disconnect", () => {
    releaseNameForSocket(socket);
    if (!joinedRoomId) return;
    const room = rooms.get(joinedRoomId);
    if (room) {
      rememberPeerName(room, socket.id);
      room.listeners.delete(socket.id);
      onRoomLastListenerLeft(room, joinedRoomId);
      broadcastRoom(joinedRoomId);
    }
  });
});

function broadcastTogetherListen(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;
  for (const sid of room.listeners) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    sock.emit("togetherListen", {
      listenerCount: room.listeners.size,
      members: buildRoomMembers(room),
      togetherWithPeers: buildTogetherWithPeers(room, sid),
    });
  }
}

const PAIR_LISTEN_TICK_MS = 1000;
/** 同听 UI 广播间隔（计时仍每秒累加，降低两人同听时的 socket/DOM 压力） */
const PAIR_LISTEN_BROADCAST_MS = 3000;
const pairListenLastBroadcastAt = new Map();

setInterval(() => {
  try {
    const now = Date.now();
    for (const [rid, room] of rooms) {
      if (room.listeners.size < 2) continue;
      tickRoomPairListen(rid, room, PAIR_LISTEN_TICK_MS);
      const lastAt = pairListenLastBroadcastAt.get(rid) || 0;
      if (now - lastAt < PAIR_LISTEN_BROADCAST_MS) continue;
      pairListenLastBroadcastAt.set(rid, now);
      broadcastTogetherListen(rid);
    }
  } catch (e) {
    console.warn("[pairListen] tick:", e?.message || e);
  }
}, PAIR_LISTEN_TICK_MS);

server.listen(PORT, HOST, () => {
  const hostHint = HOST === "0.0.0.0" ? "127.0.0.1" : HOST;
  console.log(`Together Listen: http://${hostHint}:${PORT}`);
  console.log(`Public site (share): ${PUBLIC_SITE_ORIGIN}/`);
  console.log(`NetEase proxy: POST /api/netease/cookie or QR login on web UI`);
  console.log(`Pair-listen store: data/pair-listen.json`);
  if (opsLog.isAdminEnabled()) {
    console.log(`Admin debug: http://${hostHint}:${PORT}/admin.html`);
  } else {
    console.log("Admin debug: disabled (set ADMIN_TOKEN to enable)");
  }
});

function flushAllStores() {
  roomExtrasStore.flushStore();
  pairListenStore.flushStore();
}

process.on("SIGINT", () => {
  flushAllStores();
  process.exit(0);
});
process.on("SIGTERM", () => {
  flushAllStores();
  process.exit(0);
});
