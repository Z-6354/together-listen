/**
 * 房间播放队列与进度相关的纯逻辑（可单元测试，server 复用）
 */
const MAX_QUEUE_SIZE = 100;
const MAX_ROOM_EXTRA = 100;

function nowMs() {
  return Date.now();
}

function trackMatchKey(t) {
  if (!t) return "";
  if (t.neteaseId) return `n:${t.neteaseId}`;
  return `u:${String(t.url || "").trim()}`;
}

function currentTrack(room) {
  if (room.currentIndex < 0 || room.currentIndex >= room.queue.length) return null;
  return room.queue[room.currentIndex];
}

function normalizePlayMode(m) {
  return m === "random" ? "random" : "loop";
}

function logicalPositionSec(room, atMs = nowMs()) {
  if (!room.isPlaying) return room.anchorPosSec;
  const elapsed = (atMs - room.anchorWallMs) / 1000;
  return room.anchorPosSec + elapsed;
}

/** 冻结播放进度（全员离开或空房异常在播） */
function freezePlayback(room, atMs = nowMs()) {
  if (!room.isPlaying) return false;
  room.anchorPosSec = logicalPositionSec(room, atMs);
  room.isPlaying = false;
  room.anchorWallMs = atMs;
  return true;
}

function recordRoomPlay(room, track) {
  if (!track) return;
  const key = trackMatchKey(track);
  if (!key) return;
  if (!room.playStats) room.playStats = { counts: {}, tracks: {} };
  room.playStats.counts[key] = (room.playStats.counts[key] || 0) + 1;
  room.playStats.tracks[key] = {
    url: track.url,
    title: track.title,
    neteaseId: track.neteaseId,
    source: track.source,
  };
  if (!room.recentPlays) room.recentPlays = [];
  room.recentPlays.unshift({
    ...room.playStats.tracks[key],
    playedAt: nowMs(),
  });
  if (room.recentPlays.length > 40) room.recentPlays.length = 40;
}

function findQueueIndex(room, track) {
  const key = trackMatchKey(track);
  if (!key) return -1;
  return room.queue.findIndex((t) => trackMatchKey(t) === key);
}

function filterTracksNotInQueue(room, tracks) {
  return tracks.filter((t) => findQueueIndex(room, t) < 0);
}

function queueRemaining(room) {
  return Math.max(0, MAX_QUEUE_SIZE - room.queue.length);
}

function ensurePlaybackAnchor(room) {
  if (room.currentIndex < 0 && room.queue.length > 0) {
    room.currentIndex = 0;
    room.isPlaying = false;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
  }
}

function pushTrack(room, track) {
  if (room.queue.length >= MAX_QUEUE_SIZE) return false;
  room.queue.push(track);
  ensurePlaybackAnchor(room);
  return true;
}

function pushTracks(room, tracks) {
  const remaining = queueRemaining(room);
  if (remaining <= 0) return { added: 0, dropped: tracks.length };
  const slice = tracks.slice(0, remaining);
  for (const track of slice) {
    room.queue.push(track);
  }
  ensurePlaybackAnchor(room);
  return { added: slice.length, dropped: tracks.length - slice.length };
}

function playTrackNow(room, track) {
  let idx = findQueueIndex(room, track);
  if (idx < 0) {
    if (!pushTrack(room, track)) return false;
    idx = room.queue.length - 1;
  }
  room.currentIndex = idx;
  room.anchorPosSec = 0;
  room.anchorWallMs = nowMs();
  room.isPlaying = true;
  recordRoomPlay(room, track);
  return true;
}

/** @returns {"added"|"duplicate"|false} */
function pushRoomExtra(room, listKey, track) {
  const list = room[listKey];
  if (!Array.isArray(list)) return false;
  const key = trackMatchKey(track);
  if (key && list.some((t) => trackMatchKey(t) === key)) return "duplicate";
  if (list.length >= MAX_ROOM_EXTRA) return false;
  list.push(track);
  return "added";
}

function findRoomFavoriteIndex(room, track) {
  const key = trackMatchKey(track);
  if (!key) return -1;
  return room.roomFavorites.findIndex((f) => trackMatchKey(f) === key);
}

/** 从喜欢条目取出可播放的曲目字段 */
function favoriteAsTrack(fav) {
  if (!fav) return null;
  return {
    url: fav.url,
    title: fav.title,
    neteaseId: fav.neteaseId,
    source: fav.source,
  };
}

/**
 * 房间喜欢：按曲目聚合，记录多位用户
 * @returns {"added"|"added_user"|"duplicate"|false}
 */
function addRoomFavorite(room, track, userName) {
  if (!Array.isArray(room.roomFavorites)) room.roomFavorites = [];
  const name = String(userName || "").trim().slice(0, 24);
  if (!name) return false;
  const idx = findRoomFavoriteIndex(room, track);
  if (idx >= 0) {
    const fav = room.roomFavorites[idx];
    if (!Array.isArray(fav.likedBy)) fav.likedBy = [];
    if (fav.likedBy.includes(name)) return "duplicate";
    fav.likedBy.push(name);
    return "added_user";
  }
  if (room.roomFavorites.length >= MAX_ROOM_EXTRA) return false;
  room.roomFavorites.push({
    url: track.url,
    title: track.title,
    neteaseId: track.neteaseId,
    source: track.source,
    likedBy: [name],
    likedAt: nowMs(),
  });
  return "added";
}

/** 取消当前用户对某条喜欢的标记；若无用户则移除整条 */
function removeRoomFavoriteLike(room, index, userName) {
  if (!Array.isArray(room.roomFavorites)) return false;
  const i = Number(index);
  if (i < 0 || i >= room.roomFavorites.length) return false;
  const fav = room.roomFavorites[i];
  const name = String(userName || "").trim().slice(0, 24);
  if (!Array.isArray(fav.likedBy) || !fav.likedBy.length) {
    room.roomFavorites.splice(i, 1);
    return true;
  }
  if (!name || !fav.likedBy.includes(name)) return false;
  fav.likedBy = fav.likedBy.filter((n) => n !== name);
  if (!fav.likedBy.length) room.roomFavorites.splice(i, 1);
  return true;
}

function stabilizeRoomPlayback(room) {
  if (!room.queue.length) {
    room.currentIndex = -1;
    room.isPlaying = false;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    return;
  }
  if (room.currentIndex < 0 || room.currentIndex >= room.queue.length) {
    room.currentIndex = 0;
    room.anchorPosSec = Math.max(0, Number(room.anchorPosSec) || 0);
    room.anchorWallMs = nowMs();
    room.isPlaying = false;
  }
}

function goNext(room) {
  const n = room.queue.length;
  if (n === 0 || room.currentIndex < 0) return false;
  if (n === 1) {
    room.currentIndex = 0;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    room.isPlaying = true;
  } else {
    const mode = normalizePlayMode(room.playMode);
    if (mode === "random") {
      let ni = room.currentIndex;
      let guard = 0;
      while (ni === room.currentIndex && guard < 32) {
        ni = Math.floor(Math.random() * n);
        guard += 1;
      }
      room.currentIndex = ni;
    } else {
      room.currentIndex = (room.currentIndex + 1) % n;
    }
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    room.isPlaying = true;
  }
  const t = currentTrack(room);
  if (t) recordRoomPlay(room, t);
  return true;
}

function goPrev(room) {
  const n = room.queue.length;
  if (n === 0 || room.currentIndex < 0) return false;
  if (n === 1) {
    room.currentIndex = 0;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    room.isPlaying = true;
  } else {
    room.currentIndex = (room.currentIndex - 1 + n) % n;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    room.isPlaying = true;
  }
  const t = currentTrack(room);
  if (t) recordRoomPlay(room, t);
  return true;
}

function removeQueueIndices(room, indices) {
  const toRemove = [
    ...new Set(
      (Array.isArray(indices) ? indices : [])
        .map((x) => Number(x))
        .filter((i) => i >= 0 && i < room.queue.length),
    ),
  ];
  if (!toRemove.length) return 0;
  const oldCurrent = room.currentIndex;
  const removedCurrent = toRemove.includes(oldCurrent);
  toRemove.sort((a, b) => b - a);
  for (const i of toRemove) {
    room.queue.splice(i, 1);
  }
  if (!room.queue.length) {
    room.currentIndex = -1;
    room.isPlaying = false;
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
    return toRemove.length;
  }
  if (removedCurrent) {
    room.currentIndex = Math.min(oldCurrent, room.queue.length - 1);
    room.anchorPosSec = 0;
    room.anchorWallMs = nowMs();
  } else {
    let dec = 0;
    for (const i of toRemove) {
      if (i < oldCurrent) dec += 1;
    }
    room.currentIndex = oldCurrent - dec;
  }
  return toRemove.length;
}

/** 测试用：最小房间对象 */
function makeTestRoom(overrides = {}) {
  return {
    queue: [],
    currentIndex: -1,
    isPlaying: false,
    anchorWallMs: nowMs(),
    anchorPosSec: 0,
    playMode: "loop",
    roomFavorites: [],
    roomPlaylists: [],
    recentPlays: [],
    playStats: { counts: {}, tracks: {} },
    ...overrides,
  };
}

module.exports = {
  MAX_QUEUE_SIZE,
  MAX_ROOM_EXTRA,
  nowMs,
  trackMatchKey,
  currentTrack,
  normalizePlayMode,
  logicalPositionSec,
  freezePlayback,
  recordRoomPlay,
  findQueueIndex,
  filterTracksNotInQueue,
  queueRemaining,
  ensurePlaybackAnchor,
  pushTrack,
  pushTracks,
  playTrackNow,
  pushRoomExtra,
  findRoomFavoriteIndex,
  favoriteAsTrack,
  addRoomFavorite,
  removeRoomFavoriteLike,
  stabilizeRoomPlayback,
  goNext,
  goPrev,
  removeQueueIndices,
  makeTestRoom,
};
