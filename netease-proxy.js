/**
 * NetEase Cloud Music secondary proxy (unofficial API).
 * Server holds one login cookie (VIP on Linux / QR / paste) and exposes
 * search + same-origin audio stream for the web player.
 */
const fs = require("fs");
const path = require("path");
const neteaseApi = require("NeteaseCloudMusicApi");

const DATA_DIR = path.join(__dirname, "data");
const COOKIE_FILE = path.join(DATA_DIR, "netease-cookie.txt");

/** 「小彦的歌单」对应网易云用户 */
const XIAOYAN_NETEASE_UID = 1505742284;
const XIAOYAN_NETEASE_CREATOR = "橙子味的小x";

let cookieString = "";

function loadCookie() {
  try {
    if (fs.existsSync(COOKIE_FILE)) {
      cookieString = fs.readFileSync(COOKIE_FILE, "utf8").trim();
    }
  } catch (err) {
    console.warn("[netease] load cookie failed:", err.message);
  }
}

function getCookie() {
  return cookieString;
}

function saveCookie(raw) {
  cookieString = String(raw || "").trim();
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(COOKIE_FILE, cookieString, "utf8");
}

function clearCookie() {
  cookieString = "";
  try {
    if (fs.existsSync(COOKIE_FILE)) fs.unlinkSync(COOKIE_FILE);
  } catch (_) {
    /* ignore */
  }
}

function cookieFromResult(result) {
  if (result?.body?.cookie && typeof result.body.cookie === "string") {
    return result.body.cookie;
  }
  if (Array.isArray(result?.cookie)) {
    return result.cookie.join(";");
  }
  return "";
}

function formatArtists(song) {
  const list = song?.ar || song?.artists || [];
  return list
    .map((a) => a?.name)
    .filter(Boolean)
    .join(" / ");
}

function formatAlbum(song) {
  const al = song?.al || song?.album;
  return al?.name || "";
}

function formatSong(song) {
  const name = song?.name || "未知歌曲";
  const artists = formatArtists(song);
  const album = formatAlbum(song);
  return {
    id: song.id,
    name,
    artists,
    album,
    title: artists ? `${name} — ${artists}` : name,
  };
}

async function loginStatus() {
  if (!cookieString) {
    return { loggedIn: false, nickname: null, userId: null };
  }
  try {
    const res = await neteaseApi.login_status({ cookie: cookieString });
    const profile = res.body?.data?.profile;
    if (profile?.userId) {
      return {
        loggedIn: true,
        nickname: profile.nickname || "用户",
        userId: profile.userId,
      };
    }
  } catch (err) {
    console.warn("[netease] login_status:", err.message);
  }
  return { loggedIn: false, nickname: null, userId: null };
}

async function startQrLogin() {
  const keyRes = await neteaseApi.login_qr_key({ cookie: cookieString });
  const key = keyRes.body?.data?.unikey;
  if (!key) throw new Error("无法获取二维码 key");
  const qrRes = await neteaseApi.login_qr_create({
    key,
    qrimg: true,
    cookie: cookieString,
  });
  return {
    key,
    qrimg: qrRes.body?.data?.qrimg || "",
    qrurl: qrRes.body?.data?.qrurl || "",
  };
}

/** @returns {{ code: number, loggedIn: boolean, nickname?: string }} */
async function checkQrLogin(key) {
  const res = await neteaseApi.login_qr_check({ key, cookie: cookieString });
  const code = Number(res.body?.code ?? 0);
  if (code === 803) {
    const next = cookieFromResult(res);
    if (next) saveCookie(next);
    const st = await loginStatus();
    return { code, loggedIn: true, nickname: st.nickname };
  }
  return { code, loggedIn: false };
}

const SEARCH_LIMIT = {
  song: 40,
  playlist: 30,
  lyric: 40,
  artist: 30,
};

async function searchSongs(keywords, limit) {
  const lim = Math.min(Number(limit) || SEARCH_LIMIT.song, 50);
  const res = await neteaseApi.cloudsearch({
    keywords: String(keywords || "").trim(),
    type: 1,
    limit: lim,
    cookie: cookieString,
  });
  const songs = res.body?.result?.songs || [];
  return songs.map(formatSong);
}

/** type 1000 = 歌单 */
async function searchPlaylists(keywords, limit) {
  const lim = Math.min(Number(limit) || SEARCH_LIMIT.playlist, 50);
  const res = await neteaseApi.cloudsearch({
    keywords: String(keywords || "").trim(),
    type: 1000,
    limit: lim,
    cookie: cookieString,
  });
  const playlists = res.body?.result?.playlists || [];
  return playlists.map((p) => ({
    id: p.id,
    name: p.name || "未命名歌单",
    trackCount: p.trackCount ?? 0,
    creator: p.creator?.nickname || "",
    playCount: p.playCount ?? 0,
  }));
}

/** type 1006 = 歌词（结果为歌曲） */
async function searchLyrics(keywords, limit) {
  const lim = Math.min(Number(limit) || SEARCH_LIMIT.lyric, 50);
  const res = await neteaseApi.cloudsearch({
    keywords: String(keywords || "").trim(),
    type: 1006,
    limit: lim,
    cookie: cookieString,
  });
  const songs = res.body?.result?.songs || [];
  return songs.map((s) => {
    const f = formatSong(s);
    return { ...f, matchLyric: true };
  });
}

/** type 100 = 歌手 */
async function searchArtists(keywords, limit) {
  const lim = Math.min(Number(limit) || SEARCH_LIMIT.artist, 50);
  const res = await neteaseApi.cloudsearch({
    keywords: String(keywords || "").trim(),
    type: 100,
    limit: lim,
    cookie: cookieString,
  });
  const artists = res.body?.result?.artists || [];
  return artists.map((a) => ({
    id: a.id,
    name: a.name || "未知歌手",
    alias: (a.alias || []).join(" / "),
    albumSize: a.albumSize ?? 0,
    musicSize: a.musicSize ?? 0,
  }));
}

async function getXiaoyanPlaylists() {
  return getUserPlaylists(XIAOYAN_NETEASE_UID);
}

function parseCommentResource(resourceInfo) {
  if (!resourceInfo) {
    return { songId: null, songTitle: null, songName: null, artists: null };
  }
  try {
    const r =
      typeof resourceInfo === "string" ? JSON.parse(resourceInfo) : resourceInfo;
    const songId = r.id != null ? Number(r.id) : null;
    const songName = r.name || r.title || null;
    const artists =
      r.artist?.name ||
      (Array.isArray(r.artists) && r.artists[0]?.name) ||
      null;
    const songTitle = songName
      ? artists
        ? `${songName} — ${artists}`
        : songName
      : null;
    return { songId, songTitle, songName, artists };
  } catch (_) {
    return { songId: null, songTitle: null, songName: null, artists: null };
  }
}

async function getUserCommentHistory(uid, opts = {}) {
  const userId = uid || XIAOYAN_NETEASE_UID;
  const limit = Math.min(Number(opts.limit) || 30, 50);
  const time = Number(opts.time) || 0;
  const res = await neteaseApi.user_comment_history({
    uid: userId,
    limit,
    time,
    cookie: cookieString,
  });
  const data = res.body?.data;
  if (!data || res.body?.code !== 200) {
    throw new Error(res.body?.message || "无法获取用户评论");
  }
  const comments = (data.comments || []).map((c) => {
    const song = parseCommentResource(c.resourceInfo);
    return {
      id: c.commentId ?? c.time,
      time: c.time,
      content: String(c.content || "").trim(),
      likedCount: Number(c.likedCount) || 0,
      songId: song.songId,
      songTitle: song.songTitle || song.songName || "未知曲目",
      songName: song.songName,
      artists: song.artists,
      resourceType: c.resourceType,
    };
  });
  return {
    comments,
    hasMore: Boolean(data.hasMore),
    total: data.commentCount ?? comments.length,
  };
}

async function getXiaoyanComments(opts = {}) {
  const result = await getUserCommentHistory(XIAOYAN_NETEASE_UID, opts);
  return {
    ...result,
    creator: XIAOYAN_NETEASE_CREATOR,
    uid: XIAOYAN_NETEASE_UID,
  };
}

async function getUserPlaylists(uid) {
  let userId = uid;
  if (!userId) {
    const st = await loginStatus();
    if (!st.loggedIn || !st.userId) {
      throw new Error("请先登录网易云账号");
    }
    userId = st.userId;
  }
  const res = await neteaseApi.user_playlist({
    uid: userId,
    limit: 100,
    offset: 0,
    cookie: cookieString,
  });
  const list = res.body?.playlist || [];
  return list.map((p) => ({
    id: p.id,
    name: p.name,
    trackCount: p.trackCount ?? p.tracks?.length ?? 0,
    cover: p.coverImgUrl || "",
    creator: p.creator?.nickname || "",
  }));
}

async function getPlaylistTracks(playlistId) {
  const res = await neteaseApi.playlist_detail({
    id: String(playlistId),
    cookie: cookieString,
  });
  const pl = res.body?.playlist;
  if (!pl) throw new Error("歌单不存在或无权访问");
  const tracks = (pl.tracks || [])
    .filter((t) => t?.id)
    .map(formatSong);
  return {
    id: pl.id,
    name: pl.name,
    trackCount: pl.trackCount ?? tracks.length,
    creator: pl.creator?.nickname || "",
    tracks,
  };
}

async function getSongMeta(id) {
  const res = await neteaseApi.song_detail({
    ids: String(id),
    cookie: cookieString,
  });
  const song = res.body?.songs?.[0];
  if (!song) return null;
  const formatted = formatSong(song);
  return { id: formatted.id, title: formatted.title };
}

async function resolveUpstreamUrl(id) {
  const res = await neteaseApi.song_url({
    id: String(id),
    br: 999000,
    cookie: cookieString,
  });
  const item = res.body?.data?.[0];
  if (!item?.url) {
    const reason = item?.fee === 1 ? "VIP/付费" : "无可用链接";
    throw new Error(`歌曲 ${id} 无法播放（${reason}，请确认已登录会员账号）`);
  }
  return item.url;
}

function streamPath(id) {
  return `/api/netease/stream/${id}`;
}

function parseSongId(input) {
  const s = String(input || "").trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return Number(s);
  const m =
    s.match(/[?&]id=(\d+)/) ||
    s.match(/song\/(\d+)/) ||
    s.match(/music\.163\.com\/#\/song\?id=(\d+)/);
  return m ? Number(m[1]) : null;
}

function trackFromFormatted(song) {
  const s = song.title ? song : formatSong(song);
  return {
    url: streamPath(s.id),
    title: s.title || (s.artists ? `${s.name} — ${s.artists}` : s.name),
    neteaseId: Number(s.id),
    source: "netease",
  };
}

async function buildTrack(id, titleHint) {
  if (titleHint) return trackFromFormatted({ id: Number(id), title: titleHint, name: titleHint });
  const meta = await getSongMeta(id);
  return trackFromFormatted({ id: Number(id), title: meta?.title, name: meta?.title || `#${id}` });
}

loadCookie();

module.exports = {
  getCookie,
  saveCookie,
  clearCookie,
  loadCookie,
  loginStatus,
  startQrLogin,
  checkQrLogin,
  searchSongs,
  searchPlaylists,
  searchLyrics,
  searchArtists,
  SEARCH_LIMIT,
  getXiaoyanPlaylists,
  getXiaoyanComments,
  getUserCommentHistory,
  getUserPlaylists,
  XIAOYAN_NETEASE_UID,
  XIAOYAN_NETEASE_CREATOR,
  getPlaylistTracks,
  formatSong,
  getSongMeta,
  resolveUpstreamUrl,
  streamPath,
  parseSongId,
  buildTrack,
  trackFromFormatted,
};
