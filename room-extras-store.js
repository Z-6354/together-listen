/**
 * 房间数据持久化：播放队列、播放状态、自建歌单、统计 — data/room-extras.json
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE =
  process.env.ROOM_EXTRAS_STORE_FILE ||
  path.join(DATA_DIR, "room-extras.json");

let cache = { rooms: {} };
let saveTimer = null;
let dirty = false;

function readFileSafe() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { rooms: {} };
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data?.rooms || typeof data.rooms !== "object") return { rooms: {} };
    return data;
  } catch (err) {
    console.warn("[room-extras-store] read failed:", err.message);
    return { rooms: {} };
  }
}

function loadStore() {
  cache = readFileSafe();
  return cache;
}

function normalizeTrack(t) {
  if (!t || typeof t !== "object") return null;
  const url = String(t.url || "").trim();
  const title = String(t.title || "").trim();
  const neteaseId = t.neteaseId != null ? Number(t.neteaseId) : null;
  if (!url && !neteaseId) return null;
  return {
    url: url || (neteaseId ? `/api/netease/stream/${neteaseId}` : ""),
    title: title || "未知曲目",
    neteaseId: neteaseId || undefined,
    source: t.source || (neteaseId ? "netease" : "url"),
  };
}

function normalizeTrackList(list) {
  if (!Array.isArray(list)) return [];
  return list.map(normalizeTrack).filter(Boolean);
}

function normalizeUserName(raw) {
  let s = String(raw ?? "")
    .trim()
    .replace(/[\r\n\t]/g, " ");
  if (s.length > 24) s = s.slice(0, 24);
  return s;
}

function normalizeRoomFavorites(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const track = normalizeTrack(item);
    if (!track) continue;
    let likedBy = [];
    if (Array.isArray(item.likedBy)) {
      likedBy = [...new Set(item.likedBy.map(normalizeUserName).filter(Boolean))];
    } else if (item.likedByName) {
      const n = normalizeUserName(item.likedByName);
      if (n) likedBy = [n];
    }
    const key = track.neteaseId
      ? `n:${track.neteaseId}`
      : `u:${String(track.url || "").trim()}`;
    const existing = out.find((f) => {
      const fk = f.neteaseId
        ? `n:${f.neteaseId}`
        : `u:${String(f.url || "").trim()}`;
      return fk === key;
    });
    if (existing) {
      for (const n of likedBy) {
        if (!existing.likedBy.includes(n)) existing.likedBy.push(n);
      }
      continue;
    }
    out.push({
      ...track,
      likedBy,
      likedAt: Number(item.likedAt) || Date.now(),
    });
  }
  return out;
}

function newPlaylistId() {
  return crypto.randomBytes(6).toString("hex");
}

function normalizePlayMode(m) {
  return String(m || "").trim().toLowerCase() === "random" ? "random" : "loop";
}

function normalizeRoomVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

function normalizeQueueIndex(idx, queueLen) {
  const i = Number(idx);
  if (!Number.isFinite(i) || queueLen <= 0) return -1;
  if (i < 0 || i >= queueLen) return -1;
  return i;
}

function normalizeRoomPlaylists(raw, legacyFlat) {
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((p) => {
        if (!p || typeof p !== "object") return null;
        const id = String(p.id || "").trim() || newPlaylistId();
        const name = String(p.name || "未命名").trim().slice(0, 32) || "未命名";
        return { id, name, tracks: normalizeTrackList(p.tracks) };
      })
      .filter(Boolean);
  }
  const legacy = normalizeTrackList(legacyFlat);
  if (legacy.length) {
    return [{ id: newPlaylistId(), name: "默认歌单", tracks: legacy }];
  }
  return [{ id: newPlaylistId(), name: "默认歌单", tracks: [] }];
}

function emptyRoomSnapshot() {
  return {
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    anchorPosSec: 0,
    anchorWallMs: Date.now(),
    playMode: "loop",
    volume: 1,
    roomPlaylists: [{ id: newPlaylistId(), name: "默认歌单", tracks: [] }],
    roomFavorites: [],
    recentPlays: [],
    playStats: { counts: {}, tracks: {} },
  };
}

function loadRoomExtras(roomId) {
  const id = String(roomId || "").trim();
  if (!id) return emptyRoomSnapshot();
  const rec = cache.rooms[id] || {};
  const queue = normalizeTrackList(rec.queue);
  let currentIndex = normalizeQueueIndex(rec.currentIndex, queue.length);
  if (queue.length > 0 && currentIndex < 0) currentIndex = 0;
  return {
    queue,
    currentIndex,
    /** 服务重启后从磁盘恢复时一律暂停，避免锚点时间失效 */
    isPlaying: false,
    anchorPosSec: Math.max(0, Number(rec.anchorPosSec) || 0),
    anchorWallMs: Date.now(),
    playMode: normalizePlayMode(rec.playMode),
    volume: normalizeRoomVolume(rec.volume),
    roomPlaylists: normalizeRoomPlaylists(
      rec.roomPlaylists,
      rec.roomPlaylist,
    ),
    roomFavorites: normalizeRoomFavorites(rec.roomFavorites),
    recentPlays: Array.isArray(rec.recentPlays) ? rec.recentPlays : [],
    playStats:
      rec.playStats && typeof rec.playStats === "object"
        ? rec.playStats
        : { counts: {}, tracks: {} },
  };
}

function persistRoomExtras(roomId, room) {
  const id = String(roomId || "").trim();
  if (!id || !room) return;
  if (!cache.rooms) cache.rooms = {};
  cache.rooms[id] = {
    queue: normalizeTrackList(room.queue),
    currentIndex: normalizeQueueIndex(room.currentIndex, room.queue?.length || 0),
    isPlaying: Boolean(room.isPlaying),
    anchorPosSec: Math.max(0, Number(room.anchorPosSec) || 0),
    anchorWallMs: Number(room.anchorWallMs) || Date.now(),
    playMode: normalizePlayMode(room.playMode),
    volume: normalizeRoomVolume(room.volume),
    roomPlaylists: (room.roomPlaylists || []).map((p) => ({
      id: p.id,
      name: p.name,
      tracks: normalizeTrackList(p.tracks),
    })),
    roomFavorites: normalizeRoomFavorites(room.roomFavorites),
    recentPlays: (room.recentPlays || []).slice(0, 50),
    playStats: room.playStats || { counts: {}, tracks: {} },
    updatedAt: Date.now(),
  };
  dirty = true;
  scheduleSave();
}

function scheduleSave() {
  if (saveTimer) return;
  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (!dirty) return;
    dirty = false;
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2), "utf8");
    } catch (err) {
      console.warn("[room-extras-store] write failed:", err.message);
      dirty = true;
    }
  }, 800);
}

function flushStore() {
  if (!dirty) return;
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  dirty = false;
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(STORE_FILE, JSON.stringify(cache, null, 2), "utf8");
  } catch (err) {
    console.warn("[room-extras-store] flush failed:", err.message);
    dirty = true;
  }
}

loadStore();

module.exports = {
  loadRoomExtras,
  persistRoomExtras,
  flushStore,
  newPlaylistId,
  normalizeRoomVolume,
};
