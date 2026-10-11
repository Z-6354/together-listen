/* global io */

const $ = (id) => document.getElementById(id);

const roomInput = $("roomInput");
const joinBtn = $("joinBtn");
const newRoomBtn = $("newRoomBtn");
const roomStatus = $("roomStatus");
const audioEl = $("player");
const nowPlaying = $("nowPlaying");
const togglePlayBtn = $("togglePlayBtn");
const nextBtn = $("nextBtn");
const prevBtn = $("prevBtn");
const playModeLoop = $("playModeLoop");
const playModeRandom = $("playModeRandom");
const seekBar = $("seekBar");
const tCur = $("tCur");
const tDur = $("tDur");
const volumeBar = $("volumeBar");
const volumePct = $("volumePct");
const urlInput = $("urlInput");
const titleInput = $("titleInput");
const addBtn = $("addBtn");
const queueList = $("queueList");
const queueSelectAllBtn = $("queueSelectAllBtn");
const queueClearSelectionBtn = $("queueClearSelectionBtn");
const queueRemoveSelectedBtn = $("queueRemoveSelectedBtn");
const queueDeleteAllBtn = $("queueDeleteAllBtn");
const queueClearBtn = $("queueClearBtn");
const queueSelectionHint = $("queueSelectionHint");
const listenersEl = $("listeners");
const neteaseStatus = $("neteaseStatus");
const neteaseQrBtn = $("neteaseQrBtn");
const neteaseLogoutBtn = $("neteaseLogoutBtn");
const qrBox = $("qrBox");
const qrImg = $("qrImg");
const searchInput = $("searchInput");
const searchBtn = $("searchBtn");
const searchResults = $("searchResults");
const loadPlaylistsBtn = $("loadPlaylistsBtn");
const loadXiaoyanPlaylistsBtn = $("loadXiaoyanPlaylistsBtn");
const xiaoyanPlaylistList = $("xiaoyanPlaylistList");
const xiaoyanPlaylistHint = $("xiaoyanPlaylistHint");
const xiaoyanCommentsList = $("xiaoyanCommentsList");
const xiaoyanCommentsHint = $("xiaoyanCommentsHint");
const loadXiaoyanCommentsBtn = $("loadXiaoyanCommentsBtn");
const playlistList = $("playlistList");
const playlistHint = $("playlistHint");
const playlistDetail = $("playlistDetail");
const playlistTitle = $("playlistTitle");
const playlistTracks = $("playlistTracks");
const addAllPlaylistBtn = $("addAllPlaylistBtn");
const addSelectedTracksBtn = $("addSelectedTracksBtn");
const selectAllTracksBtn = $("selectAllTracksBtn");
const clearTrackSelectionBtn = $("clearTrackSelectionBtn");
const playlistCreator = $("playlistCreator");
const playlistSelectionHint = $("playlistSelectionHint");
const closePlaylistBtn = $("closePlaylistBtn");
const displayNameInput = $("displayNameInput");
const saveNameBtn = $("saveNameBtn");
const displayNameHint = $("displayNameHint");
const selfStatus = $("selfStatus");
const roomAudienceHeader = $("roomAudienceHeader");
const roomAudienceList = $("roomAudienceList");
const togetherListenHint = $("togetherListenHint");
const togetherListenList = $("togetherListenList");
const listenerJoinModal = $("listenerJoinModal");
const listenerJoinText = $("listenerJoinText");
const listenerJoinMeta = $("listenerJoinMeta");
const yanWelcomeModal = $("yanWelcomeModal");
const yanWelcomeText = $("yanWelcomeText");
const yanWelcomeClose = $("yanWelcomeClose");
const searchResultHint = $("searchResultHint");
const favoriteBtn = $("favoriteBtn");
const roomPlaylistNames = $("roomPlaylistNames");
const roomPlaylistTracks = $("roomPlaylistTracks");
const roomPlNewBtn = $("roomPlNewBtn");
const roomPlRenameBtn = $("roomPlRenameBtn");
const roomPlDeleteBtn = $("roomPlDeleteBtn");
const roomPlHint = $("roomPlHint");
const roomFavoritesList = $("roomFavoritesList");
const roomFavoritesHint = $("roomFavoritesHint");
const appToast = $("appToast");
const roomRecentList = $("roomRecentList");
const roomTopList = $("roomTopList");
const playSelectedTracksBtn = $("playSelectedTracksBtn");
const queuePeekText = $("queuePeekText");
const goQueueBtn = $("goQueueBtn");
const roomWelcomeModal = $("roomWelcomeModal");
const roomWelcomeId = $("roomWelcomeId");
const roomWelcomeQueueHint = $("roomWelcomeQueueHint");
const roomWelcomeCopy = $("roomWelcomeCopy");
const roomWelcomeSearch = $("roomWelcomeSearch");
const roomWelcomeQueue = $("roomWelcomeQueue");
const roomWelcomeClose = $("roomWelcomeClose");
const confirmModal = $("confirmModal");
const confirmModalTitle = $("confirmModalTitle");
const confirmModalMessage = $("confirmModalMessage");
const confirmModalCancel = $("confirmModalCancel");
const confirmModalOk = $("confirmModalOk");
const mobileBottomNav = $("mobileBottomNav");
const mobileMiniPlayer = $("mobileMiniPlayer");
const mobileRoomChip = $("mobileRoomChip");

const socket = io({ transports: ["websocket", "polling"] });
let toastHideTimer = null;
let listenerJoinHideTimer = null;
/** 进房提示音（需用户曾与本页交互以解锁 AudioContext） */
let dingAudioCtx = null;
const LISTENER_JOIN_MODAL_MS = 5000;

/** 用户操作：控制台打印并上报服务器（管理调试页） */
function logUserOp(action, detail = {}) {
  const payload = {
    action: String(action || "").slice(0, 48),
    detail: detail && typeof detail === "object" ? detail : {},
    ts: Date.now(),
  };
  console.log("[TogetherListen op]", payload.action, payload.detail);
  if (socket?.connected && roomJoined) {
    socket.emit("userOp", payload);
  }
}
const MOBILE_MQ = "(max-width: 767px)";
/** 播放进度与百分比展示统一为 0–100，与滑块 max 一致 */
const SLIDER_PCT_MAX = 100;
let qrPollTimer = null;
let neteaseLoggedIn = false;
let activePlaylistId = null;
/** @type {Array<{id:number,name:string,creator?:string,trackCount?:number}>} */
let cachedXiaoyanPlaylists = [];
/** @type {Array<{id:number,name:string,creator?:string,trackCount?:number}>} */
let cachedMyPlaylists = [];
/** @type {Array<{id:number,name:string,creator?:string,trackCount?:number}>} */
let cachedSearchPlaylists = [];
/** @type {Array<{id:number,name:string,title?:string,artists?:string}>} */
let activePlaylistTracks = [];
const selectedTrackIds = new Set();
const selectedQueueIndices = new Set();
/** @type {"song"|"playlist"|"lyric"|"artist"} */
let searchMode = "song";
let mySocketId = null;
let activeRoomPlaylistId = null;
let pendingSelectNewRoomPl = false;
let activePlaylistSourceTab = "xiaoyan";
let pendingRoomWelcomeId = null;
/** @type {((v: boolean) => void) | null} */
let confirmResolve = null;
/** @type {((name: string) => void) | null} */
let activateMainView = null;
/** @type {((hub: string) => void) | null} */
let activateMainHub = null;
/** @type {((page: string) => void) | null} */
let mobileNavigate = null;

const DISPLAY_NAME_KEY = "togetherListenDisplayName";
const CLIENT_ID_KEY = "togetherListenClientId";
const ROOM_KEY = "togetherListenLastRoom";
const DEFAULT_ROOM_ID = "reserved";

let roomId = "";
/** 已成功 join 到服务器 */
let roomJoined = false;
let lastPlaybackSig = "";
let lastAnchorPosSig = "";
let lastAnchorWallMs = 0;
let lastMembersRenderKey = "";
let lastTogetherRenderKey = "";
/** last server state */
let state = null;
let localSeeking = false;
let lastAppliedUrl = "";
/** 刚换源后短时间内忽略 ended，避免误触发「下一首」 */
let endedCooldownUntil = 0;
let pendingNaturalEndIndex = null;
let pendingNaturalEndAt = 0;
let pendingNaturalEndAnchorMs = 0;
/** 已就本轮 anchor 上报曲终，避免双人/单曲循环时重复 emit 或无法重开 */
let naturalEndReportedAnchorMs = 0;
const AWAITING_ADVANCE_TIMEOUT_MS = 8000;
let audioLoadRetryCount = 0;
/** 当前曲目可开始漂移校正的时间（loadedmetadata 后） */
let driftSyncEnabledAfter = 0;
/** 漂移校正：连续超阈值次数、上次 seek 时间（避免播放中频繁跳进度卡顿） */
let driftOverThresholdCount = 0;
let lastDriftSeekAt = 0;
let lastEnsureSyncAt = 0;
const DRIFT_CORRECT_THRESHOLD_SEC = 2.5;
const DRIFT_SEEK_COOLDOWN_MS = 5000;
const DRIFT_SAMPLES_REQUIRED = 2;
const PLAYBACK_ENSURE_MIN_MS = 2000;
const PLAYBACK_ENSURE_MIN_MS_ACTIVE = 800;

function clearAwaitingTrackAdvance() {
  pendingNaturalEndIndex = null;
  pendingNaturalEndAt = 0;
  pendingNaturalEndAnchorMs = 0;
}

/** 已上报曲终、等待服务器切歌；此期间勿按旧进度 seek/重载同一曲 */
function isAwaitingTrackAdvance() {
  if (pendingNaturalEndIndex == null) return false;
  if (state?.currentIndex !== pendingNaturalEndIndex) {
    clearAwaitingTrackAdvance();
    return false;
  }
  if (Date.now() - pendingNaturalEndAt > AWAITING_ADVANCE_TIMEOUT_MS) {
    clearAwaitingTrackAdvance();
    return false;
  }
  return true;
}

function randomRoom() {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 6; i += 1) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

function fmt(sec) {
  if (!Number.isFinite(sec) || sec < 0) return "0:00";
  const total = Math.floor(sec);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** 音频元素报告的有效时长（秒）；流媒体/未知时为 null */
function audioDurationSec() {
  const d = audioEl.duration;
  if (!Number.isFinite(d) || d <= 0) return null;
  return d;
}

function trackMatchKeyClient(t) {
  if (!t) return "";
  if (t.neteaseId) return `n:${t.neteaseId}`;
  if (t.id != null && /^\d+$/.test(String(t.id))) return `n:${Number(t.id)}`;
  return `u:${String(t.url || "").trim()}`;
}

function findFavoriteIndexForTrack(track) {
  const key = trackMatchKeyClient(track);
  if (!key) return -1;
  return (state?.roomFavorites || []).findIndex(
    (f) => trackMatchKeyClient(f) === key,
  );
}

function isTrackFavoritedByMe(track) {
  const me = currentDisplayName();
  if (!me || !track) return false;
  const idx = findFavoriteIndexForTrack(track);
  if (idx < 0) return false;
  const fav = state.roomFavorites[idx];
  return Array.isArray(fav.likedBy) && fav.likedBy.includes(me);
}

function getCurrentQueueTrack() {
  if (!state || state.currentIndex == null || state.currentIndex < 0) return null;
  return state.queue?.[state.currentIndex] || null;
}

function updateFavoriteBtnUi() {
  if (!favoriteBtn) return;
  const track = getCurrentQueueTrack();
  const liked = isTrackFavoritedByMe(track);
  favoriteBtn.classList.toggle("is-favorited", liked);
  const label = liked ? "取消房间喜欢" : "加入房间喜欢";
  favoriteBtn.title = label;
  favoriteBtn.setAttribute("aria-label", label);
}

/** 同听累计毫秒 → 可读时长 */
function fmtListenMs(ms) {
  const sec = Math.max(0, Math.floor((Number(ms) || 0) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function serverNowPos(stateObj) {
  if (!stateObj || !stateObj.currentUrl) return 0;
  if (!stateObj.isPlaying) return stateObj.anchorPosSec || 0;
  const drift = (Date.now() - stateObj.anchorWallMs) / 1000;
  return (stateObj.anchorPosSec || 0) + drift;
}

/** 音频是否已播完或停在结尾（会导致 play() 无效） */
function needsPlaybackRestart() {
  if (!audioEl.src) return true;
  if (audioEl.ended) return true;
  const d = audioDurationSec();
  if (d != null && audioEl.currentTime >= d - 0.15) return true;
  return false;
}

/** 当前源对应曲目已自然播完（应收尾切歌，勿重载同一 URL） */
function isTrackNaturallyComplete() {
  if (!state?.currentUrl || !audioEl.src) return false;
  if (lastAppliedUrl !== state.currentUrl) return false;
  if (audioEl.ended) return true;
  const d = audioDurationSec();
  if (d != null && audioEl.currentTime >= d - 0.15) return true;
  return false;
}

/** 曲终上报服务器；返回 true 表示已处理，调用方勿再 load 同一曲 */
function tryEmitNaturalEndIfComplete() {
  if (!isTrackNaturallyComplete()) return false;
  if (state.currentIndex == null || state.currentIndex < 0) return false;

  const anchor = state.anchorWallMs ?? 0;
  if (naturalEndReportedAnchorMs) {
    if (anchor !== naturalEndReportedAnchorMs) {
      /* 对方或服务器已 goNext/单曲重头，应重载而非再次上报 */
      naturalEndReportedAnchorMs = 0;
      return false;
    }
    if (
      pendingNaturalEndAt &&
      Date.now() - pendingNaturalEndAt > AWAITING_ADVANCE_TIMEOUT_MS
    ) {
      naturalEndReportedAnchorMs = 0;
      pendingNaturalEndIndex = null;
      return false;
    }
    return true;
  }

  if (isAwaitingTrackAdvance()) return true;
  if (Date.now() < endedCooldownUntil) return true;
  endedCooldownUntil = Date.now() + 1000;
  naturalEndReportedAnchorMs = anchor;
  logUserOp("trackNaturalEnd", {
    atIndex: state.currentIndex,
    title: state?.currentTitle || null,
  });
  emitTrackNaturalEnd(state.currentIndex);
  return true;
}

/** 将服务器进度映射为可 seek 的安全位置 */
function syncTargetSec(stateObj) {
  if (isAwaitingTrackAdvance()) return 0;
  if (!stateObj?.currentUrl) return 0;
  let t = serverNowPos(stateObj);
  const d = audioDurationSec();
  const cur = Number.isFinite(audioEl.currentTime) ? audioEl.currentTime : 0;
  if (d != null) {
    if (t >= d - 0.25) {
      /* 仅当音频确已接近结尾才回到 0，避免上一首残留进度把新歌反复 seek 到开头 */
      if (cur >= d - 1.5) return 0;
      return Math.max(0, cur);
    }
    if (t > d + 1) t = Math.max(0, d - 0.05);
    return Math.min(Math.max(0, t), d - 0.05);
  }
  if (t > 86400) return 0;
  return Math.max(0, t);
}

function notePlaybackTrackChange() {
  driftSyncEnabledAfter = 0;
  driftOverThresholdCount = 0;
  lastDriftSeekAt = 0;
  clearAwaitingTrackAdvance();
  naturalEndReportedAnchorMs = 0;
}

/** 媒体就绪后再对齐进度，避免切歌瞬间 seek 失败导致无声 */
function scheduleApplyPositionWhenReady(anchorPosChanged) {
  if (!anchorPosChanged || !state?.currentUrl) return;
  const url = state.currentUrl;
  const apply = () => {
    if (!state?.currentUrl || state.currentUrl !== url || lastAppliedUrl !== url) return;
    applyServerPlaybackPosition({ force: true, immediate: true });
  };
  if (audioEl.readyState >= 2) apply();
  else audioEl.addEventListener("canplay", apply, { once: true });
}

/** 切歌 / 换源后：重载音频并尝试本地 play（解决进度在走但无声） */
function syncPlaybackAfterTrackChange(s, opts = {}) {
  const { anchorPosChanged = false } = opts;
  if (!s?.currentUrl) {
    ensurePlaybackSynced();
    return;
  }
  const url = s.currentUrl;
  if (!s.isPlaying) {
    ensurePlaybackSynced();
    return;
  }
  if (lastAppliedUrl !== url || needsPlaybackRestart() || !audioEl.src) {
    loadAudioSource(url, true);
  }
  lastEnsureSyncAt = 0;
  ensurePlaybackSynced();
  scheduleApplyPositionWhenReady(anchorPosChanged);
  if (audioUnlocked) {
    startLocalPlaybackIfNeeded();
  } else {
    pendingPlaySync = true;
    playBlocked = true;
  }
}

function markDriftSyncReady() {
  if (!state?.currentUrl || lastAppliedUrl !== state.currentUrl) return;
  driftSyncEnabledAfter = Date.now();
}

function canApplyDriftCorrection() {
  if (!roomJoined || !state?.currentUrl || localSeeking) return false;
  if (lastAppliedUrl !== state.currentUrl) return false;
  if (!state.isPlaying || audioEl.paused) return false;
  if (audioDurationSec() == null) return false;
  if (isAwaitingTrackAdvance()) return false;
  if (!driftSyncEnabledAfter) return false;
  if (Date.now() - driftSyncEnabledAfter < 2000) return false;
  return true;
}

/** 与服务器偏差过大时校正进度；连续采样 + 冷却，避免听感卡顿 */
function maybeCorrectPlaybackDrift() {
  if (!canApplyDriftCorrection()) {
    driftOverThresholdCount = 0;
    return;
  }
  const target = syncTargetSec(state);
  const diff = Math.abs(audioEl.currentTime - target);
  if (diff > DRIFT_CORRECT_THRESHOLD_SEC) {
    driftOverThresholdCount += 1;
  } else {
    driftOverThresholdCount = 0;
    return;
  }
  if (driftOverThresholdCount < DRIFT_SAMPLES_REQUIRED) return;
  if (Date.now() - lastDriftSeekAt < DRIFT_SEEK_COOLDOWN_MS) return;
  try {
    audioEl.currentTime = target;
    lastDriftSeekAt = Date.now();
    driftOverThresholdCount = 0;
  } catch (_) {
    /* ignore */
  }
}

function shouldRunEnsurePlaybackSynced() {
  const now = Date.now();
  const playingLocally = state?.isPlaying && !audioEl.paused && !playBlocked;
  const minGap = playingLocally ? PLAYBACK_ENSURE_MIN_MS : PLAYBACK_ENSURE_MIN_MS_ACTIVE;
  if (now - lastEnsureSyncAt < minGap) return false;
  lastEnsureSyncAt = now;
  return true;
}

let pendingPlaySync = false;
/** 用户已与页面交互，可尝试 audio.play() */
let audioUnlocked = false;
/** play() 被浏览器拦截，需用户点播放 */
let playBlocked = false;

function markAudioUnlocked() {
  audioUnlocked = true;
  primeJoinDingAudioContext();
}

function primeJoinDingAudioContext() {
  try {
    if (!dingAudioCtx) {
      dingAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (dingAudioCtx.state === "suspended") {
      dingAudioCtx.resume().catch(() => {});
    }
  } catch (_) {
    /* ignore */
  }
}

/** 新听众进房提示音（短促「叮」） */
function playJoinDing() {
  try {
    const ctx = dingAudioCtx || new (window.AudioContext || window.webkitAudioContext)();
    dingAudioCtx = ctx;
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(880, t0);
    osc.frequency.exponentialRampToValueAtTime(660, t0 + 0.1);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.28, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.38);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.42);
  } catch (_) {
    /* ignore */
  }
}

function hideListenerJoinModal() {
  if (listenerJoinHideTimer) {
    clearTimeout(listenerJoinHideTimer);
    listenerJoinHideTimer = null;
  }
  if (!listenerJoinModal) return;
  listenerJoinModal.classList.add("hidden");
  listenerJoinModal.setAttribute("aria-hidden", "true");
}

function showListenerJoinNotice({ userName, listenerCount, roomId: rid }) {
  if (!roomJoined) return;
  if (rid && roomId && rid !== roomId) return;
  const name = String(userName || "").trim() || "新听众";
  playJoinDing();
  if (!listenerJoinModal || !listenerJoinText) return;
  hideListenerJoinModal();
  listenerJoinText.textContent = `「${name}」进入了房间`;
  if (listenerJoinMeta) {
    const n = Number(listenerCount);
    listenerJoinMeta.textContent = Number.isFinite(n) && n > 0
      ? `当前共 ${n} 人在线`
      : "";
  }
  listenerJoinModal.classList.remove("hidden");
  listenerJoinModal.setAttribute("aria-hidden", "false");
  listenerJoinHideTimer = setTimeout(hideListenerJoinModal, LISTENER_JOIN_MODAL_MS);
}

function installAudioUnlockListeners() {
  const onGesture = () => {
    markAudioUnlocked();
    tryResumePlaybackIfNeeded();
    ensurePlaybackSynced();
  };
  document.addEventListener("pointerdown", onGesture, { capture: true });
  document.addEventListener("keydown", onGesture, { capture: true });
}

/** 用户在本页点了暂停，避免与「后台被系统暂停」恢复逻辑冲突 */
let lastUserPausedAt = 0;
let backgroundKeepAliveTimer = null;
let backgroundResumeTimer = null;
let lastMediaPositionSyncAt = 0;

function initBackgroundPlayback() {
  if ("audioSession" in navigator) {
    try {
      navigator.audioSession.type = "playback";
    } catch (_) {
      /* Safari 16+ */
    }
  }
  setupMediaSessionHandlers();
  audioEl.addEventListener("pause", onAudioUnexpectedPause);
  document.addEventListener("visibilitychange", onPageVisibilityChange);
  window.addEventListener("pagehide", onPageHideKeepAlive);
  window.addEventListener("pageshow", onPageShowResume);
}

function setupMediaSessionHandlers() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  const bind = (action, fn) => {
    try {
      ms.setActionHandler(action, fn);
    } catch (_) {
      /* 部分浏览器不支持某项 */
    }
  };
  bind("play", () => {
    markAudioUnlocked();
    if (!roomJoined || !state?.currentUrl) return;
    socket.emit("play");
    resumeSyncedPlayback();
  });
  bind("pause", () => {
    lastUserPausedAt = Date.now();
    if (!roomJoined || !state?.isPlaying) return;
    socket.emit("pause");
  });
  bind("previoustrack", () => {
    if (!roomJoined) return;
    markAudioUnlocked();
    socket.emit("prev");
  });
  bind("nexttrack", () => {
    if (!roomJoined) return;
    markAudioUnlocked();
    socket.emit("next");
  });
  bind("seekto", (details) => {
    if (!roomJoined || details?.seekTime == null) return;
    const sec = Math.max(0, Number(details.seekTime) || 0);
    markAudioUnlocked();
    try {
      audioEl.currentTime = sec;
    } catch (_) {
      /* ignore */
    }
    socket.emit("seek", sec);
  });
}

function syncMediaSession() {
  if (!("mediaSession" in navigator)) return;
  const ms = navigator.mediaSession;
  if (!state?.currentUrl) {
    ms.playbackState = "none";
    return;
  }
  const title = state.currentTitle || "未知曲目";
  const artist = roomId ? `房间 ${roomId}` : "一起听歌";
  try {
    ms.metadata = new MediaMetadata({
      title,
      artist,
      album: "一起听歌",
    });
  } catch (_) {
    try {
      ms.metadata = new MediaMetadata({ title, artist });
    } catch (e2) {
      /* ignore */
    }
  }
  ms.playbackState = state.isPlaying ? "playing" : "paused";
  syncMediaSessionPosition(true);
}

function syncMediaSessionPosition(force) {
  if (!("mediaSession" in navigator)) return;
  if (!("setPositionState" in navigator.mediaSession)) return;
  const now = Date.now();
  if (!force && now - lastMediaPositionSyncAt < 1500) return;
  const d = audioDurationSec();
  if (d == null || !Number.isFinite(d)) return;
  try {
    navigator.mediaSession.setPositionState({
      duration: d,
      playbackRate: audioEl.playbackRate || 1,
      position: Math.min(d, Math.max(0, audioEl.currentTime)),
    });
    lastMediaPositionSyncAt = now;
  } catch (_) {
    /* 部分 WebView 在切歌瞬间会抛错 */
  }
}

function scheduleBackgroundResume() {
  clearTimeout(backgroundResumeTimer);
  backgroundResumeTimer = setTimeout(() => {
    if (!roomJoined || !state?.isPlaying || !audioEl.paused) return;
    if (localSeeking || playBlocked) return;
    if (Date.now() - lastUserPausedAt < 1200) return;
    safePlay();
  }, 250);
}

function onAudioUnexpectedPause() {
  if (localSeeking) return;
  if (!roomJoined || !state?.isPlaying) return;
  if (Date.now() - lastUserPausedAt < 1200) return;
  scheduleBackgroundResume();
}

function startBackgroundKeepAlive() {
  stopBackgroundKeepAlive();
  if (!state?.isPlaying) return;
  syncMediaSession();
  backgroundKeepAliveTimer = setInterval(() => {
    if (!roomJoined || !state?.isPlaying) {
      stopBackgroundKeepAlive();
      return;
    }
    syncMediaSessionPosition(true);
    if (audioEl.paused && !playBlocked && audioUnlocked && !localSeeking) {
      if (Date.now() - lastUserPausedAt >= 1200) safePlay();
    }
  }, 2500);
}

function stopBackgroundKeepAlive() {
  if (backgroundKeepAliveTimer) {
    clearInterval(backgroundKeepAliveTimer);
    backgroundKeepAliveTimer = null;
  }
}

function onPageVisibilityChange() {
  if (document.hidden) {
    if (state?.isPlaying) startBackgroundKeepAlive();
    syncMediaSession();
    return;
  }
  stopBackgroundKeepAlive();
  tryResumePlaybackIfNeeded();
  ensurePlaybackSynced();
  syncMediaSession();
}

function onPageHideKeepAlive() {
  if (state?.isPlaying) startBackgroundKeepAlive();
}

function onPageShowResume() {
  stopBackgroundKeepAlive();
  tryResumePlaybackIfNeeded();
  ensurePlaybackSynced();
  syncMediaSession();
}

function formatNowPlayingLabel(s) {
  if (!s?.currentUrl) return "队列为空，先添加音频链接";
  const base = s.currentTitle || s.currentUrl;
  if (
    playBlocked ||
    (s.isPlaying && audioEl.paused && (!audioUnlocked || playBlocked))
  ) {
    return `${base} · 点击 ▶ 播放声音`;
  }
  return base;
}

function safePlay() {
  const p = audioEl.play();
  if (!p || typeof p.then !== "function") {
    playBlocked = false;
    return Promise.resolve(true);
  }
  return p
    .then(() => {
      playBlocked = false;
      return true;
    })
    .catch((err) => {
      if (err?.name === "NotAllowedError" || err?.name === "AbortError") {
        playBlocked = true;
        pendingPlaySync = true;
      }
      return false;
    });
}

/** 房间在播但本机未出声（手机常见：进度在走、听不到声音） */
function needsLocalPlaybackStart() {
  return Boolean(
    roomJoined &&
      state?.isPlaying &&
      state?.currentUrl &&
      (audioEl.paused || playBlocked || pendingPlaySync),
  );
}

/** 在用户已交互解锁后，启动本地音频播放 */
async function startLocalPlaybackIfNeeded() {
  if (!needsLocalPlaybackStart()) return true;
  markAudioUnlocked();
  playBlocked = false;
  resumeSyncedPlayback();
  if (!audioEl.paused) {
    updateTransportState(state);
    syncMobileChrome();
    return true;
  }
  const ok = await safePlay();
  if (!ok) {
    playBlocked = true;
    if (state && nowPlaying) {
      nowPlaying.textContent = formatNowPlayingLabel(state);
    }
    if (isMobileLayout()) {
      showToast("请轻触 ▶ 开始播放声音", { ms: 3000 });
    }
    return false;
  }
  updateTransportState(state);
  syncMobileChrome();
  return true;
}

/** 进度条：播放中用音频时间；未出声但服务器在播时用服务器时间（不 seek 音频） */
function refreshPlaybackUi() {
  if (!state?.currentUrl || localSeeking) {
    syncMobileChrome();
    return;
  }
  if (state?.isPlaying && !document.hidden) {
    syncMediaSessionPosition(false);
  }
  const dur = audioDurationSec();
  let pos;
  if (state.isPlaying && !audioEl.paused && dur != null) {
    pos = audioEl.currentTime;
  } else if (state.isPlaying) {
    pos = serverNowPos(state);
  } else {
    pos = state.anchorPosSec || 0;
  }
  if (dur != null && pos > dur) pos = dur;
  tCur.textContent = fmt(pos);
  tDur.textContent = dur != null ? fmt(dur) : "--:--";
  if (seekBar) {
    seekBar.disabled = dur == null;
    if (dur != null) {
      const ratio = Math.min(1, Math.max(0, pos / dur));
      seekBar.value = String(
        Math.min(SLIDER_PCT_MAX, Math.max(0, ratio * SLIDER_PCT_MAX)),
      );
    }
  }
  syncMobileChrome();
}

function loadAudioSource(url, shouldPlay) {
  if (!url) return;
  endedCooldownUntil = Date.now() + 800;
  driftSyncEnabledAfter = 0;
  lastAppliedUrl = url;
  audioEl.src = url;
  pendingPlaySync = shouldPlay;
  if (tCur) tCur.textContent = "0:00";
  if (tDur) tDur.textContent = "--:--";
  if (seekBar) seekBar.value = "0";
  audioEl.load();
}

function resumeSyncedPlayback() {
  if (!state?.isPlaying || !state.currentUrl) return;
  if (isAwaitingTrackAdvance()) return;
  const url = state.currentUrl;

  if (!audioUnlocked) {
    pendingPlaySync = true;
    playBlocked = true;
    if (state && nowPlaying) nowPlaying.textContent = formatNowPlayingLabel(state);
    return;
  }

  if (lastAppliedUrl !== url) {
    loadAudioSource(url, true);
    return;
  }
  if (needsPlaybackRestart()) {
    if (tryEmitNaturalEndIfComplete()) return;
    loadAudioSource(url, true);
    return;
  }

  const target = syncTargetSec(state);
  try {
    if (Math.abs(audioEl.currentTime - target) > 0.85) {
      audioEl.currentTime = target;
    }
    safePlay().then((ok) => {
      if (!ok && state) {
        nowPlaying.textContent = formatNowPlayingLabel(state);
      }
    });
  } catch (_) {
    /* ignore */
  }
}

function tryResumePlaybackIfNeeded() {
  if (isAwaitingTrackAdvance()) return;
  if (!state?.isPlaying || !state.currentUrl) return;
  if (!pendingPlaySync && !audioEl.paused && !playBlocked) return;
  resumeSyncedPlayback();
}

/** 服务器在播但本地无声 / 源未加载时主动对齐（含重复 state 广播场景） */
function ensurePlaybackSynced() {
  if (!roomJoined || !state || localSeeking) return;
  if (isAwaitingTrackAdvance()) return;

  if (!state.currentUrl) {
    if (lastAppliedUrl) {
      endedCooldownUntil = Date.now() + 600;
      audioEl.removeAttribute("src");
      audioEl.load();
      lastAppliedUrl = "";
    }
    return;
  }

  const url = state.currentUrl;

  if (!state.isPlaying) {
    pendingPlaySync = false;
    if (!audioEl.paused) audioEl.pause();
    if (lastAppliedUrl === url && audioEl.src) {
      const target = syncTargetSec(state);
      if (Math.abs(audioEl.currentTime - target) > 0.85) {
        try {
          audioEl.currentTime = target;
        } catch (_) {
          /* ignore */
        }
      }
    }
    return;
  }

  if (lastAppliedUrl !== url) {
    loadAudioSource(url, true);
    return;
  }

  if (needsPlaybackRestart()) {
    if (lastAppliedUrl === url && tryEmitNaturalEndIfComplete()) return;
    if (pendingPlaySync && audioEl.readyState < 2) return;
    loadAudioSource(url, true);
    return;
  }

  if (audioEl.paused || playBlocked || pendingPlaySync) {
    if (audioEl.readyState >= 2) {
      resumeSyncedPlayback();
    } else {
      pendingPlaySync = true;
    }
    return;
  }

  /* 正常播放中不在此处 seek，避免两人同听时周期性跳进度；大偏差由 maybeCorrectPlaybackDrift 处理 */
}

function getClientId() {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `c-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch (_) {
    return `ephemeral-${Math.random().toString(36).slice(2, 12)}`;
  }
}

function currentDisplayName() {
  const inp = displayNameInput?.value?.trim();
  if (inp) return inp.slice(0, 24);
  try {
    return (localStorage.getItem(DISPLAY_NAME_KEY) || "").trim().slice(0, 24);
  } catch (_) {
    return "";
  }
}

function initMainViewTabs() {
  const tabs = document.querySelectorAll("[data-main-view]");
  const panels = {
    play: $("viewPanelPlay"),
    discover: $("viewPanelDiscover"),
    comments: $("viewPanelComments"),
  };
  if (!tabs.length) return;
  function activate(name) {
    tabs.forEach((btn) => {
      const on = btn.dataset.mainView === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
    if (name === "comments") loadXiaoyanComments();
  }
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.mainView || "play"));
  });
  activateMainView = activate;
  activate("play");
}

function switchToDiscover(hub = "search") {
  activateMainView?.("discover");
  if (hub) activateMainHub?.(hub);
  mobileNavigate?.("discover");
}

function isNativeApp() {
  return (
    window.TOGETHER_LISTEN_NATIVE === true ||
    /TogetherListenApp/i.test(navigator.userAgent || "") ||
    Boolean(window.Capacitor?.isNativePlatform?.())
  );
}

function isMobileLayout() {
  return isNativeApp() || document.body.classList.contains("is-mobile");
}

function updateRoomJoinUi() {
  document.body.classList.toggle("room-joined", Boolean(roomJoined && roomId));
}

function syncMobileChrome() {
  const mobile = isMobileLayout();
  updateRoomJoinUi();
  if (mobileRoomChip) {
    if (mobile && roomJoined && roomId) {
      mobileRoomChip.textContent = roomId;
      mobileRoomChip.title = `房间「${roomId}」· 点击退出`;
      mobileRoomChip.setAttribute("aria-label", `房间 ${roomId}，点击退出`);
      mobileRoomChip.classList.remove("hidden");
      mobileRoomChip.hidden = false;
    } else {
      mobileRoomChip.classList.add("hidden");
      mobileRoomChip.hidden = true;
    }
  }
  if (!mobile || !mobileMiniPlayer) {
    document.body.classList.remove("has-mobile-mini");
    return;
  }

  const page = document.body.dataset.mobilePage || "play";
  const hasTrack = Boolean(state?.currentUrl);
  const showMini = hasTrack && page !== "play";
  mobileMiniPlayer.classList.toggle("hidden", !showMini);
  mobileMiniPlayer.hidden = !showMini;
  mobileMiniPlayer.setAttribute("aria-hidden", showMini ? "false" : "true");
  document.body.classList.toggle("has-mobile-mini", showMini);

  const titleEl = $("mobileMiniTitle");
  const subEl = $("mobileMiniSub");
  const toggleEl = $("mobileMiniToggle");
  if (titleEl) {
    titleEl.textContent =
      state?.currentTitle || (state?.currentUrl ? "正在播放" : "未在播放");
  }
  if (subEl) {
    if (!hasTrack) subEl.textContent = "";
    else if (
      playBlocked ||
      (state.isPlaying && audioEl.paused)
    ) {
      subEl.textContent = "点击 ▶ 播放声音";
    } else if (state.isPlaying) {
      const dur = audioDurationSec();
      const pos = serverNowPos(state);
      subEl.textContent =
        dur != null ? `${fmt(pos)} / ${fmt(dur)}` : fmt(pos);
    } else {
      subEl.textContent = "已暂停";
    }
  }
  if (toggleEl) {
    const playing = Boolean(state?.isPlaying && !audioEl.paused);
    toggleEl.innerHTML = playing
      ? '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
    toggleEl.setAttribute(
      "aria-label",
      playing ? "暂停" : "播放",
    );
  }
}

function initMobileShell() {
  if (!mobileBottomNav) return;

  function goToPage(page) {
    if (!isMobileLayout()) return;
    const p = page || "play";
    document.body.dataset.mobilePage = p;
    mobileBottomNav.querySelectorAll("[data-mobile-page]").forEach((btn) => {
      const on = btn.dataset.mobilePage === p;
      btn.classList.toggle("active", on);
      if (on) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    if (p === "play") activateMainView?.("play");
    if (p === "discover") activateMainView?.("discover");
    if (p === "comments") activateMainView?.("comments");
    syncMobileChrome();
  }

  mobileNavigate = goToPage;

  mobileBottomNav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-mobile-page]");
    if (!btn) return;
    goToPage(btn.dataset.mobilePage);
  });

  $("mobileMiniMain")?.addEventListener("click", () => goToPage("play"));
  $("mobileMiniToggle")?.addEventListener("click", (e) => {
    e.stopPropagation();
    markAudioUnlocked();
    if (togglePlayBtn && !togglePlayBtn.disabled) togglePlayBtn.click();
  });

  function applyMq() {
    const mobile = isNativeApp() || window.matchMedia(MOBILE_MQ).matches;
    document.body.classList.toggle("is-mobile", mobile);
    if (mobile) {
      if (!document.body.dataset.mobilePage) goToPage("play");
    } else {
      delete document.body.dataset.mobilePage;
      document.body.classList.remove("has-mobile-mini");
      if (mobileMiniPlayer) {
        mobileMiniPlayer.classList.add("hidden");
        mobileMiniPlayer.hidden = true;
      }
    }
    syncMobileChrome();
  }

  window.matchMedia(MOBILE_MQ).addEventListener("change", applyMq);
  applyMq();
}

function initMainHubTabs() {
  const tabs = document.querySelectorAll("[data-hub]");
  const panels = {
    search: $("hubPanelSearch"),
    playlists: $("hubPanelPlaylists"),
    queue: $("hubPanelQueue"),
  };
  if (!tabs.length) return;
  function activate(name) {
    tabs.forEach((btn) => {
      const on = btn.dataset.hub === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(panels).forEach(([key, el]) => {
      if (!el) return;
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
  }
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.hub || "search"));
  });
  activateMainHub = activate;
}

function showConfirmDialog({ title, message, okLabel = "确定", danger = false }) {
  if (!confirmModal) {
    return Promise.resolve(window.confirm(message || title || "确认？"));
  }
  return new Promise((resolve) => {
    confirmResolve = resolve;
    if (confirmModalTitle) confirmModalTitle.textContent = title || "确认";
    if (confirmModalMessage) confirmModalMessage.textContent = message || "";
    if (confirmModalOk) {
      confirmModalOk.textContent = okLabel;
      confirmModalOk.classList.toggle("btn-danger", Boolean(danger));
    }
    confirmModal.classList.remove("hidden");
    confirmModal.setAttribute("aria-hidden", "false");
  });
}

function closeConfirmDialog(result) {
  if (confirmModal) {
    confirmModal.classList.add("hidden");
    confirmModal.setAttribute("aria-hidden", "true");
  }
  if (confirmResolve) confirmResolve(result);
  confirmResolve = null;
}

function hideRoomWelcomeModal() {
  roomWelcomeModal?.classList.add("hidden");
  roomWelcomeModal?.setAttribute("aria-hidden", "true");
}

function showRoomWelcomeModal(id) {
  if (!roomWelcomeModal || !id) return;
  const n = state?.queue?.length ?? 0;
  if (roomWelcomeId) roomWelcomeId.textContent = id;
  if (roomWelcomeQueueHint) {
    roomWelcomeQueueHint.textContent = n
      ? `当前队列 ${n} 首。可去「发现」继续添加，或管理播放顺序。`
      : "播放队列为空。切换到「发现」搜索歌曲，或打开队列粘贴链接。";
  }
  roomWelcomeModal.classList.remove("hidden");
  roomWelcomeModal.setAttribute("aria-hidden", "false");
}

function maybeShowRoomWelcome() {
  if (!pendingRoomWelcomeId) return;
  showRoomWelcomeModal(pendingRoomWelcomeId);
  pendingRoomWelcomeId = null;
}

function updateQueuePeek() {
  if (!queuePeekText) return;
  if (!roomJoined || !roomId) {
    queuePeekText.textContent = "播放队列 · 未进房";
    return;
  }
  const n = state?.queue?.length ?? 0;
  const cur = state?.currentIndex;
  if (n > 0 && cur != null && cur >= 0 && state.queue[cur]) {
    queuePeekText.textContent = `播放队列 · ${n} 首 · 正在第 ${cur + 1} 首`;
  } else {
    queuePeekText.textContent = `播放队列 · ${n} 首`;
  }
}

function initRoomPanelTabs() {
  const tabs = document.querySelectorAll("[data-room-panel]");
  const sections = {
    audience: $("roomPanelAudience"),
    recent: $("roomPanelRecent"),
    top: $("roomPanelTop"),
    together: $("roomPanelTogether"),
  };
  if (!tabs.length) return;
  function activate(name) {
    tabs.forEach((btn) => {
      const on = btn.dataset.roomPanel === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    Object.entries(sections).forEach(([key, el]) => {
      if (!el) return;
      const on = key === name;
      el.classList.toggle("active", on);
      el.hidden = !on;
    });
  }
  tabs.forEach((btn) => {
    btn.addEventListener("click", () => activate(btn.dataset.roomPanel || "audience"));
  });
}

function showToast(message, opts = {}) {
  if (!appToast || !message) return;
  appToast.textContent = message;
  appToast.classList.remove("hidden", "is-error", "is-success");
  appToast.hidden = false;
  if (opts.error) appToast.classList.add("is-error");
  else if (opts.success !== false) appToast.classList.add("is-success");
  if (toastHideTimer) clearTimeout(toastHideTimer);
  const ms = opts.ms ?? (opts.error ? 3200 : 2600);
  toastHideTimer = setTimeout(() => {
    appToast.classList.add("hidden");
    appToast.hidden = true;
    appToast.classList.remove("is-error", "is-success");
    toastHideTimer = null;
  }, ms);
}

function initPlaylistTabs() {
  const tabs = document.querySelectorAll("[data-playlist-tab]");
  const panelX = $("playlistPanelXiaoyan");
  const panelM = $("playlistPanelMine");
  const panelR = $("playlistPanelRoom");
  if (!tabs.length) return;

  function activate(tabName) {
    activePlaylistSourceTab = tabName;
    tabs.forEach((btn) => {
      const on = btn.dataset.playlistTab === tabName;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (panelX) {
      panelX.classList.toggle("active", tabName === "xiaoyan");
      panelX.hidden = tabName !== "xiaoyan";
    }
    if (panelM) {
      panelM.classList.toggle("active", tabName === "mine");
      panelM.hidden = tabName !== "mine";
    }
    if (panelR) {
      panelR.classList.toggle("active", tabName === "room");
      panelR.hidden = tabName !== "room";
    }
    if (playlistDetail && tabName === "room") {
      playlistDetail.classList.add("hidden");
    }
  }

  tabs.forEach((btn) => {
    btn.addEventListener("click", () => {
      activate(btn.dataset.playlistTab || "xiaoyan");
    });
  });
}

/** 按本地时间返回 上午 / 下午 / 晚上 */
function dayPeriodLabel() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "上午";
  if (h >= 12 && h < 18) return "下午";
  return "晚上";
}

function isYanDisplayName(name) {
  return String(name || "").trim() === "彦";
}

function hideYanWelcomeModal() {
  if (!yanWelcomeModal) return;
  yanWelcomeModal.classList.add("hidden");
  yanWelcomeModal.setAttribute("aria-hidden", "true");
}

function showYanWelcomeModal() {
  if (!yanWelcomeModal || !yanWelcomeText) return;
  const period = dayPeriodLabel();
  yanWelcomeText.textContent = `${period}好，又来一起听歌咯，要天天开心`;
  yanWelcomeModal.classList.remove("hidden");
  yanWelcomeModal.setAttribute("aria-hidden", "false");
}

function maybeWelcomeYanOnJoin() {
  if (isYanDisplayName(currentDisplayName())) {
    showYanWelcomeModal();
  }
}

yanWelcomeClose?.addEventListener("click", hideYanWelcomeModal);
yanWelcomeModal?.querySelectorAll("[data-yan-welcome-close]").forEach((el) => {
  el.addEventListener("click", hideYanWelcomeModal);
});

listenerJoinModal?.querySelectorAll("[data-listener-join-close]").forEach((el) => {
  el.addEventListener("click", hideListenerJoinModal);
});

function updateTransportState(s) {
  if (!togglePlayBtn) return;
  const has = Boolean(s?.currentUrl);
  togglePlayBtn.disabled = !has;
  const localPlaying = Boolean(
    has && s?.isPlaying && !audioEl.paused && !playBlocked,
  );
  togglePlayBtn.classList.toggle("is-playing", localPlaying);
  let t = "无曲目";
  if (has) {
    if (needsLocalPlaybackStart()) t = "播放声音";
    else if (s.isPlaying) t = localPlaying ? "暂停" : "播放";
    else t = "播放";
  }
  togglePlayBtn.title = t;
  togglePlayBtn.setAttribute("aria-label", t);
  syncMediaSession();
}

const SEARCH_PLACEHOLDERS = {
  song: "搜索单曲、歌手名",
  playlist: "搜索歌单名称、创建者",
  lyric: "搜索歌词关键词",
  artist: "搜索歌手名",
};

function updateSearchModeUi() {
  document.querySelectorAll("[data-search-mode]").forEach((btn) => {
    const on = btn.dataset.searchMode === searchMode;
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-selected", on ? "true" : "false");
  });
  if (searchInput) {
    searchInput.placeholder =
      SEARCH_PLACEHOLDERS[searchMode] || SEARCH_PLACEHOLDERS.song;
  }
}

document.querySelectorAll("[data-search-mode]").forEach((btn) => {
  btn.addEventListener("click", () => {
    searchMode = btn.dataset.searchMode || "song";
    updateSearchModeUi();
  });
});
updateSearchModeUi();

function songDisplayTitle(song) {
  return (
    song.title ||
    (song.artists ? `${song.name} — ${song.artists}` : song.name || "未知歌曲")
  );
}

function playSongNow(song) {
  if (!requireRoom() || !song?.id) return;
  markAudioUnlocked();
  socket.emit("playNeteaseNow", {
    id: song.id,
    title: songDisplayTitle(song),
  });
}

function playStatTrack(track) {
  if (!requireRoom() || !track) return;
  if (!track.neteaseId && !track.url) return;
  markAudioUnlocked();
  socket.emit("playStatTrack", {
    id: track.neteaseId,
    neteaseId: track.neteaseId,
    url: track.url,
    title: track.title,
  });
}

function appendSongActionButtons(container, song, opts = {}) {
  const play = document.createElement("button");
  play.type = "button";
  play.className = "secondary";
  play.textContent = "播放";
  play.addEventListener("click", (e) => {
    e.stopPropagation();
    playSongNow(song);
  });
  const add = document.createElement("button");
  add.type = "button";
  add.textContent = opts.addLabel || "加入";
  add.addEventListener("click", (e) => {
    e.stopPropagation();
    if (opts.onAdd) opts.onAdd(song);
    else addSongToQueue(song);
  });
  container.appendChild(play);
  container.appendChild(add);
  if (opts.showFavorite) {
    const fav = document.createElement("button");
    fav.type = "button";
    fav.className = "secondary";
    fav.textContent = "♥";
    fav.title = "房间喜欢";
    fav.classList.toggle("is-favorited", isTrackFavoritedByMe({ neteaseId: song.id, id: song.id }));
    fav.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleRoomFavorite(song);
    });
    container.appendChild(fav);
  }
}

function addToRoomPlaylist(song) {
  if (!requireRoom() || !activeRoomPlaylistId || !song?.id) return;
  socket.emit("addRoomPlaylistTrack", {
    playlistId: activeRoomPlaylistId,
    id: song.id,
    title: songDisplayTitle(song),
  });
}

function toggleRoomFavorite(songOrTrack) {
  if (!requireRoom()) return;
  let target = null;
  if (songOrTrack?.id != null) {
    target = { neteaseId: Number(songOrTrack.id), id: songOrTrack.id };
  } else {
    target = getCurrentQueueTrack();
  }
  if (!target && state?.currentIndex < 0) return;

  const idx = findFavoriteIndexForTrack(target);
  const me = currentDisplayName();
  if (
    idx >= 0 &&
    me &&
    Array.isArray(state.roomFavorites[idx]?.likedBy) &&
    state.roomFavorites[idx].likedBy.includes(me)
  ) {
    socket.emit("removeRoomFavorite", idx);
    return;
  }

  if (songOrTrack?.id != null) {
    socket.emit("addRoomFavorite", {
      id: songOrTrack.id,
      title: songDisplayTitle(songOrTrack),
    });
    return;
  }
  if (state?.currentIndex >= 0) {
    socket.emit("addRoomFavorite", { fromQueueIndex: state.currentIndex });
  }
}

function renderStatTrackRow(track, extra, onPlay) {
  const li = document.createElement("li");
  li.className = "stat-track-row";
  const meta = document.createElement("div");
  meta.className = "meta";
  const name = document.createElement("span");
  name.className = "song-name";
  name.textContent = track?.title || "未知曲目";
  meta.appendChild(name);
  if (extra) {
    const sub = document.createElement("span");
    sub.className = "song-album";
    sub.textContent = extra;
    meta.appendChild(sub);
  }
  const play = document.createElement("button");
  play.type = "button";
  play.className = "secondary";
  play.textContent = "播";
  play.addEventListener("click", () => onPlay?.());
  li.appendChild(meta);
  li.appendChild(play);
  return li;
}

function formatRecentTime(ms) {
  if (!ms) return "";
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCommentTime(ms) {
  if (!ms) return "";
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const now = new Date();
  const showYear = y !== now.getFullYear();
  const date = `${d.getMonth() + 1}月${d.getDate()}日`;
  const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  return showYear ? `${y}年${date} ${time}` : `${date} ${time}`;
}

function renderXiaoyanCommentRow(c) {
  const li = document.createElement("li");
  li.className = "xiaoyan-comment-row";

  const meta = document.createElement("div");
  meta.className = "meta";

  const timeEl = document.createElement("span");
  timeEl.className = "comment-time";
  timeEl.textContent = formatCommentTime(c.time);
  meta.appendChild(timeEl);

  const songEl = document.createElement("span");
  songEl.className = "comment-song song-name";
  songEl.textContent = c.songTitle || "未知曲目";
  meta.appendChild(songEl);

  const body = document.createElement("p");
  body.className = "comment-content";
  body.textContent = c.content || "（无文字）";

  const actions = document.createElement("div");
  actions.className = "row-actions";
  if (c.songId) {
    const play = document.createElement("button");
    play.type = "button";
    play.className = "secondary";
    play.textContent = "播放";
    play.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!requireRoom()) return;
      markAudioUnlocked();
      playSongNow({
        id: c.songId,
        name: c.songName || c.songTitle,
        title: c.songTitle,
      });
    });
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "入队";
    add.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!requireRoom()) return;
      socket.emit("addNeteaseTrack", {
        id: c.songId,
        title: c.songTitle,
      });
    });
    actions.append(play, add);
  }

  li.append(meta, body, actions);
  return li;
}

async function loadXiaoyanComments() {
  if (!xiaoyanCommentsList) return;
  xiaoyanCommentsList.innerHTML = "<li class=\"room-extra-empty\">加载中…</li>";
  try {
    const res = await fetch("/api/netease/xiaoyan/comments?limit=50");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载失败");
    const creator = data.creator || "橙子味的小x";
    const total = data.total ?? data.comments?.length ?? 0;
    if (xiaoyanCommentsHint) {
      xiaoyanCommentsHint.textContent =
        total > 0
          ? `「${creator}」共 ${total} 条乐评`
          : `「${creator}」暂无公开乐评`;
    }
    xiaoyanCommentsList.innerHTML = "";
    if (!data.comments?.length) {
      xiaoyanCommentsList.innerHTML =
        "<li class=\"room-extra-empty\">暂无评论</li>";
      return;
    }
    data.comments.forEach((c) => {
      xiaoyanCommentsList.appendChild(renderXiaoyanCommentRow(c));
    });
  } catch (e) {
    xiaoyanCommentsList.innerHTML =
      `<li class="room-extra-empty">${e.message || "加载失败"}</li>`;
    if (xiaoyanCommentsHint) {
      xiaoyanCommentsHint.textContent = "橙子味的小x 的网易云乐评";
    }
  }
}

function renderRoomPlaylistsUI(s) {
  if (!roomPlaylistNames || !roomPlaylistTracks) return;
  const lists = s?.roomPlaylists || [];
  if (!lists.length) {
    roomPlaylistNames.innerHTML = "";
    roomPlaylistTracks.innerHTML = "<li class=\"room-extra-empty\">暂无歌单</li>";
    activeRoomPlaylistId = null;
    return;
  }
  if (pendingSelectNewRoomPl) {
    activeRoomPlaylistId = lists[lists.length - 1].id;
    pendingSelectNewRoomPl = false;
  } else if (!activeRoomPlaylistId || !lists.some((p) => p.id === activeRoomPlaylistId)) {
    activeRoomPlaylistId = lists[0].id;
  }
  roomPlaylistNames.innerHTML = "";
  lists.forEach((pl) => {
    const li = document.createElement("li");
    li.className = "room-pl-name";
    if (pl.id === activeRoomPlaylistId) li.classList.add("active");
    li.textContent = `${pl.name} (${pl.tracks?.length || 0})`;
    li.addEventListener("click", () => {
      activeRoomPlaylistId = pl.id;
      renderRoomPlaylistsUI(state || s);
    });
    roomPlaylistNames.appendChild(li);
  });
  const current = lists.find((p) => p.id === activeRoomPlaylistId);
  roomPlaylistTracks.innerHTML = "";
  if (!current?.tracks?.length) {
    roomPlaylistTracks.innerHTML = "<li class=\"room-extra-empty\">空歌单，请从搜索添加</li>";
    return;
  }
  current.tracks.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "playlist-row";
    const meta = document.createElement("div");
    meta.className = "meta";
    const name = document.createElement("span");
    name.className = "song-name";
    name.textContent = track.title || "未知";
    meta.appendChild(name);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "secondary";
    play.textContent = "播放";
    play.addEventListener("click", () => {
      if (!requireRoom()) return;
      socket.emit("playRoomExtra", {
        list: "playlist",
        playlistId: activeRoomPlaylistId,
        index: i,
      });
    });
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "入队";
    add.addEventListener("click", () => {
      if (track.neteaseId) {
        socket.emit("addNeteaseTrack", { id: track.neteaseId, title: track.title });
      }
    });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "secondary";
    del.textContent = "删";
    del.addEventListener("click", () => {
      socket.emit("removeRoomPlaylistTrack", {
        playlistId: activeRoomPlaylistId,
        index: i,
      });
    });
    actions.append(play, add, del);
    li.append(meta, actions);
    roomPlaylistTracks.appendChild(li);
  });
  if (roomPlHint && current) {
    roomPlHint.textContent = `当前：${current.name}，在搜索页点「入房单」添加`;
  }
}

function renderRoomFavoritesUI(s) {
  if (!roomFavoritesList) return;
  const favs = s?.roomFavorites || [];
  const me = currentDisplayName();
  roomFavoritesList.innerHTML = "";
  if (!favs.length) {
    roomFavoritesList.innerHTML =
      "<li class=\"room-extra-empty\">暂无喜欢。播放时点 ♥，或在搜索结果点 ♥ 添加。</li>";
    if (roomFavoritesHint) {
      roomFavoritesHint.textContent = "房间内共享 · 显示喜欢该曲的用户";
    }
    return;
  }
  if (roomFavoritesHint) {
    roomFavoritesHint.textContent = `共 ${favs.length} 首 · 房间内共享`;
  }
  favs.forEach((track, i) => {
    const li = document.createElement("li");
    li.className = "playlist-row room-fav-row";
    const meta = document.createElement("div");
    meta.className = "meta";
    const likers = document.createElement("span");
    likers.className = "room-fav-likers";
    const names = Array.isArray(track.likedBy) ? track.likedBy : [];
    likers.textContent = names.length
      ? `喜欢：${names.join("、")}`
      : "喜欢：—";
    meta.appendChild(likers);
    const name = document.createElement("span");
    name.className = "song-name";
    name.textContent = track.title || "未知曲目";
    meta.appendChild(name);
    const actions = document.createElement("div");
    actions.className = "row-actions";
    const play = document.createElement("button");
    play.type = "button";
    play.className = "secondary";
    play.textContent = "播放";
    play.addEventListener("click", () => {
      if (!requireRoom()) return;
      socket.emit("playRoomExtra", { list: "favorites", index: i });
    });
    const add = document.createElement("button");
    add.type = "button";
    add.textContent = "入队";
    add.addEventListener("click", () => {
      if (!requireRoom()) return;
      if (track.neteaseId) {
        socket.emit("addNeteaseTrack", {
          id: track.neteaseId,
          title: track.title,
        });
      } else if (track.url) {
        socket.emit("addTrack", { url: track.url, title: track.title });
      }
    });
    const canUnlike = !names.length || (me && names.includes(me));
    if (canUnlike) {
      const unlike = document.createElement("button");
      unlike.type = "button";
      unlike.className = "secondary";
      unlike.textContent = "取消喜欢";
      unlike.addEventListener("click", () => {
        if (!requireRoom()) return;
        socket.emit("removeRoomFavorite", i);
      });
      actions.append(unlike);
    }
    actions.prepend(add, play);
    li.append(meta, actions);
    roomFavoritesList.appendChild(li);
  });
}

function renderRoomSidePanels(s) {
  renderRoomFavoritesUI(s);
  if (roomRecentList) {
    roomRecentList.innerHTML = "";
    const recent = (s?.recentPlays || [])
      .slice()
      .sort((a, b) => (b.playedAt || 0) - (a.playedAt || 0))
      .slice(0, 10);
    if (!recent.length) {
      roomRecentList.innerHTML = "<li class=\"room-extra-empty\">暂无播放记录</li>";
    } else {
      recent.forEach((t) => {
        roomRecentList.appendChild(
          renderStatTrackRow(t, formatRecentTime(t.playedAt), () => playStatTrack(t)),
        );
      });
    }
  }
  if (roomTopList) {
    roomTopList.innerHTML = "";
    const top = (s?.topPlays || []).slice(0, 10);
    if (!top.length) {
      roomTopList.innerHTML = "<li class=\"room-extra-empty\">暂无统计</li>";
    } else {
      top.forEach((item) => {
        const t = item.track;
        if (!t) return;
        roomTopList.appendChild(
          renderStatTrackRow(t, `播放 ${item.count} 次`, () => playStatTrack(t)),
        );
      });
    }
  }
}

function updatePlayModeUi(mode) {
  const m = mode === "random" ? "random" : "loop";
  if (playModeLoop) {
    playModeLoop.classList.toggle("active", m === "loop");
    playModeLoop.setAttribute("aria-selected", m === "loop" ? "true" : "false");
  }
  if (playModeRandom) {
    playModeRandom.classList.toggle("active", m === "random");
    playModeRandom.setAttribute("aria-selected", m === "random" ? "true" : "false");
  }
}

playModeLoop?.addEventListener("click", () => {
  logUserOp("setPlayMode", { mode: "loop" });
  socket.emit("setPlayMode", { mode: "loop" });
});
playModeRandom?.addEventListener("click", () => {
  logUserOp("setPlayMode", { mode: "random" });
  socket.emit("setPlayMode", { mode: "random" });
});

function persistDisplayName(name) {
  const n = String(name || "").trim().slice(0, 24);
  if (!n) return;
  try {
    localStorage.setItem(DISPLAY_NAME_KEY, n);
  } catch (_) {
    /* ignore */
  }
}

function restoreSavedSession() {
  try {
    const savedName = (localStorage.getItem(DISPLAY_NAME_KEY) || "").trim();
    if (savedName && displayNameInput) displayNameInput.value = savedName;
  } catch (_) {
    /* ignore */
  }

  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("room")?.trim();
  let savedRoom = "";
  try {
    savedRoom = (localStorage.getItem(ROOM_KEY) || "").trim();
  } catch (_) {
    /* ignore */
  }
  const targetRoom = fromUrl || savedRoom;
  if (targetRoom && roomInput) roomInput.value = targetRoom;

  if (selfStatus && currentDisplayName()) {
    selfStatus.textContent = `当前昵称：${currentDisplayName()}（进入房间后他人可见）`;
  }
}

function initSeekBar() {
  if (!seekBar) return;

  function previewSeek() {
    if (!localSeeking) return;
    const dur = audioDurationSec();
    if (dur == null || !tCur) return;
    const ratio = Math.min(1, Math.max(0, Number(seekBar.value) / SLIDER_PCT_MAX));
    tCur.textContent = fmt(ratio * dur);
  }

  function onSeekStart(e) {
    localSeeking = true;
    markAudioUnlocked();
    e.stopPropagation();
    if (e.pointerId != null && seekBar.setPointerCapture) {
      try {
        seekBar.setPointerCapture(e.pointerId);
      } catch (_) {
        /* ignore */
      }
    }
  }

  function onSeekEnd() {
    if (!localSeeking) return;
    try {
      if (!roomJoined || !roomId || !state) return;
      const dur = audioDurationSec();
      if (dur == null) return;
      const ratio = Math.min(1, Math.max(0, Number(seekBar.value) / SLIDER_PCT_MAX));
      const sec = ratio * dur;
      markAudioUnlocked();
      try {
        audioEl.currentTime = sec;
      } catch (_) {
        /* ignore */
      }
      logUserOp("seek", {
        posSec: Math.round(sec * 10) / 10,
        title: state?.currentTitle || null,
      });
      socket.emit("seek", sec);
    } finally {
      localSeeking = false;
      refreshPlaybackUi();
    }
  }

  seekBar.addEventListener("pointerdown", onSeekStart);
  seekBar.addEventListener("pointerup", onSeekEnd);
  seekBar.addEventListener("pointercancel", onSeekEnd);
  seekBar.addEventListener("lostpointercapture", onSeekEnd);
  seekBar.addEventListener("touchstart", onSeekStart, { passive: true });
  seekBar.addEventListener("touchend", onSeekEnd, { passive: true });
  seekBar.addEventListener("input", previewSeek);
  seekBar.addEventListener("change", onSeekEnd);
}

function persistRoomId(rid) {
  const id = String(rid || "").trim();
  if (!id) return;
  try {
    localStorage.setItem(ROOM_KEY, id);
  } catch (_) {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("room", id);
    window.history.replaceState(null, "", url);
  } catch (_) {
    /* ignore */
  }
}

function scheduleAutoRejoin() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("room")?.trim();
  let saved = "";
  try {
    saved = (localStorage.getItem(ROOM_KEY) || "").trim();
  } catch (_) {
    /* ignore */
  }
  const target = fromUrl || saved;
  if (!target) return;
  /* 断线重连时 roomId 仍在但 roomJoined=false，须重新 join */
  if (roomJoined && roomId === target) return;
  if (roomInput) roomInput.value = target;
  if (!currentDisplayName()) return;
  join(target, { silent: true });
}

function invalidatePlaybackSig() {
  lastPlaybackSig = "";
}

function applyLocalQueueEmpty() {
  if (!state) return;
  state = {
    ...state,
    queue: [],
    currentIndex: -1,
    currentUrl: null,
    currentTitle: null,
    isPlaying: false,
    anchorPosSec: 0,
    anchorWallMs: Date.now(),
  };
  invalidatePlaybackSig();
  applyState(state);
}

function join(room, opts = {}) {
  if (!opts.silent) markAudioUnlocked();
  const rid = String(room || "").trim() || DEFAULT_ROOM_ID;
  const userName = currentDisplayName();
  if (!userName) {
    if (!opts.silent) {
      window.alert("请先在左侧填写「显示名称」，可点击「保存昵称」存到本机。");
      displayNameInput?.focus();
    }
    return;
  }
  roomJoined = false;
  updateRoomJoinUi();
  roomId = rid;
  if (roomInput) roomInput.value = rid;
  persistRoomId(rid);
  persistDisplayName(userName);
  logUserOp("join", { roomId: rid, userName });
  socket.emit("join", { roomId: rid, userName, clientId: getClientId() });
}

function resetClientAfterLeave() {
  stopBackgroundKeepAlive();
  hideListenerJoinModal();
  roomJoined = false;
  updateRoomJoinUi();
  state = null;
  lastAppliedUrl = "";
  lastPlaybackSig = "";
  invalidateAnchorSig();
  lastMembersRenderKey = "";
  lastTogetherRenderKey = "";
  pendingPlaySync = false;
  playBlocked = false;
  localSeeking = false;
  endedCooldownUntil = 0;
  pendingNaturalEndIndex = null;
  pendingNaturalEndAt = 0;
  pendingNaturalEndAnchorMs = 0;
  naturalEndReportedAnchorMs = 0;
  driftSyncEnabledAfter = 0;
  driftOverThresholdCount = 0;
  lastDriftSeekAt = 0;
  lastEnsureSyncAt = 0;
  try {
    localStorage.removeItem(ROOM_KEY);
  } catch (_) {
    /* ignore */
  }
  if (audioEl) {
    audioEl.pause();
    audioEl.removeAttribute("src");
  }
  if (nowPlaying) nowPlaying.textContent = "未在播放";
  if (tCur) tCur.textContent = "0:00";
  if (tDur) tDur.textContent = "0:00";
  if (seekBar) {
    seekBar.value = "0";
    seekBar.disabled = true;
  }
  if (queueList) queueList.innerHTML = "";
  selectedQueueIndices.clear();
  updateQueueSelectionHint?.();
  renderRoomSidePanels({});
  updateTransportState(null);
  syncMobileChrome();
}

function leaveRoom() {
  if (!roomJoined) return;
  socket.emit("leaveRoom");
}

function playbackSignature(s) {
  if (!s) return "";
  return [
    s.currentUrl || "",
    s.currentIndex,
    s.isPlaying ? 1 : 0,
  ].join("\x1e");
}

/** 播放锚点位置（秒，百分位取整）；与 anchorWallMs 分开判断，避免仅 resume 时误 seek */
function anchorPosSignature(s) {
  if (!s) return "";
  return String(Math.round((s.anchorPosSec || 0) * 100));
}

function invalidateAnchorSig() {
  lastAnchorPosSig = "";
  lastAnchorWallMs = 0;
}

/**
 * 本地进度对齐服务器（电脑拖进度条后，手机须立即跟随）
 * @param {{ force?: boolean, immediate?: boolean }} opts
 */
function applyServerPlaybackPosition(opts = {}) {
  const { force = false, immediate = false } = opts;
  if (!roomJoined || !state?.currentUrl || localSeeking) return;
  if (isAwaitingTrackAdvance()) return;
  if (lastAppliedUrl !== state.currentUrl || !audioEl.src) return;

  const target = syncTargetSec(state);
  const diff = Math.abs(audioEl.currentTime - target);
  const threshold = immediate ? 0.35 : 0.85;
  if (!force && diff <= threshold) return;

  try {
    audioEl.currentTime = target;
    if (immediate) {
      driftOverThresholdCount = 0;
      lastDriftSeekAt = Date.now();
    }
  } catch (_) {
    /* ignore */
  }
  if (state.isPlaying && audioEl.paused && audioUnlocked && !localSeeking) {
    safePlay();
  }
  refreshPlaybackUi();
  syncMediaSessionPosition(true);
}

function clearPendingNaturalEnd(s) {
  if (pendingNaturalEndIndex == null) return;
  const track = s?.queue?.[s.currentIndex];
  const url = track?.url || s?.currentUrl || "";
  const prevTrack = state?.queue?.[pendingNaturalEndIndex];
  const prevUrl = prevTrack?.url || state?.currentUrl || "";
  if (
    s.currentIndex !== pendingNaturalEndIndex ||
    s.anchorWallMs !== pendingNaturalEndAnchorMs ||
    url !== prevUrl
  ) {
    clearAwaitingTrackAdvance();
    naturalEndReportedAnchorMs = 0;
  }
}

function emitTrackNaturalEnd(atIndex) {
  const idx = Number(atIndex);
  if (idx < 0) return;
  const now = Date.now();
  if (
    pendingNaturalEndIndex === idx &&
    now - pendingNaturalEndAt < 2500
  ) {
    return;
  }
  pendingNaturalEndIndex = idx;
  pendingNaturalEndAt = now;
  pendingNaturalEndAnchorMs = state?.anchorWallMs ?? 0;
  socket.emit("trackNaturalEnd", { atIndex: idx });
}

function applyAudienceAndTogether(s) {
  renderRoomAudience(s);
  renderTogetherListen(s);
  if (listenersEl) {
    listenersEl.textContent = `房间「${s.roomId || roomId}」· 在线 ${s.listenerCount ?? 0} 人`;
  }
}

function membersRenderKey(s) {
  const members = s?.members || [];
  return `${s?.listenerCount ?? 0}:${members.map((m) => `${m.id}:${m.name}`).join(",")}`;
}

function renderRoomAudience(s) {
  if (!roomAudienceHeader || !roomAudienceList) return;
  if (!roomId) {
    roomAudienceHeader.textContent = "未进入房间";
    roomAudienceList.innerHTML = "";
    lastMembersRenderKey = "";
    return;
  }
  const rid = s?.roomId ?? roomId;
  const n = s?.listenerCount ?? s?.members?.length ?? 0;
  const mKey = membersRenderKey(s);
  if (mKey === lastMembersRenderKey) {
    roomAudienceHeader.textContent = `「${rid}」${n} 人在线`;
    return;
  }
  lastMembersRenderKey = mKey;
  roomAudienceHeader.textContent = `「${rid}」${n} 人在线`;
  roomAudienceList.innerHTML = "";
  const members = s?.members || [];
  if (!members.length) {
    const li = document.createElement("li");
    li.className = "audience-empty";
    li.textContent = "（等待同步…）";
    roomAudienceList.appendChild(li);
    return;
  }
  members.forEach((m) => {
    const li = document.createElement("li");
    if (mySocketId && m.id === mySocketId) li.classList.add("self");
    const dot = document.createElement("span");
    dot.className = "dot";
    dot.title = "在线";
    const name = document.createElement("span");
    name.className = "name";
    name.textContent = m.name || "访客";
    li.appendChild(dot);
    li.appendChild(name);
    if (mySocketId && m.id === mySocketId) {
      const badge = document.createElement("span");
      badge.className = "badge";
      badge.textContent = "我";
      li.appendChild(badge);
    }
    roomAudienceList.appendChild(li);
  });
}

function togetherListenRenderKey(s) {
  const peers = Array.isArray(s?.togetherWithPeers) ? s.togetherWithPeers : [];
  const peerPart = peers
    .map(
      (p) =>
        `${p.otherName}:${Math.floor((Number(p.sessionMs ?? p.ms) || 0) / 1000)}:${Math.floor((Number(p.totalMs ?? p.ms) || 0) / 1000)}:${p.otherOnline === false ? 0 : 1}`,
    )
    .join("|");
  return `${s?.listenerCount ?? 0}|${peerPart}`;
}

function renderTogetherListen(s) {
  if (!togetherListenList) return;
  if (!roomId) {
    togetherListenList.innerHTML = "";
    lastTogetherRenderKey = "";
    if (togetherListenHint) {
      togetherListenHint.textContent =
        "「本次」全员离开后清零；「累计」保存在服务器本地（data/pair-listen.json），刷新页面不会丢失。至少两人在线时计时增加。";
    }
    return;
  }
  const peers = Array.isArray(s?.togetherWithPeers) ? s.togetherWithPeers : [];
  const tKey = togetherListenRenderKey(s);
  const n = s?.listenerCount ?? 0;
  if (togetherListenHint) {
    const hintText =
      n < 2
        ? "当前不足两人：计时暂停；等人齐后「本次」「累计」会同步增加，对方离线或离开后暂停增长。"
        : "与每位同伴两列时长：左侧本场会话，右侧历史累计（进程内）。对方离线后数字冻结。";
    if (tKey !== lastTogetherRenderKey || togetherListenHint.textContent !== hintText) {
      togetherListenHint.textContent = hintText;
    }
  }
  if (tKey === lastTogetherRenderKey) return;
  lastTogetherRenderKey = tKey;
  togetherListenList.innerHTML = "";
  if (!peers.length) {
    const li = document.createElement("li");
    li.className = "together-empty";
    li.textContent = "暂无记录（需两人同时在房过一段时间）";
    togetherListenList.appendChild(li);
    return;
  }
  peers.forEach((p) => {
    const sessionMs = Number(p.sessionMs ?? p.ms ?? 0);
    const totalMs = Number(p.totalMs ?? p.ms ?? sessionMs);
    const li = document.createElement("li");
    li.className = "together-peer-card";

    const head = document.createElement("div");
    head.className = "together-peer-head";
    const name = document.createElement("span");
    name.className = "together-name";
    name.textContent = p.otherName || "同伴";
    head.appendChild(name);
    if (p.otherOnline === false) {
      const off = document.createElement("span");
      off.className = "together-offline";
      off.textContent = "离线";
      head.appendChild(off);
    } else {
      const on = document.createElement("span");
      on.className = "together-online";
      on.textContent = "在线";
      head.appendChild(on);
    }

    const stats = document.createElement("div");
    stats.className = "together-stats";
    const boxS = document.createElement("div");
    boxS.className = "together-stat together-stat--session";
    const labS = document.createElement("span");
    labS.className = "together-stat-label";
    labS.textContent = "本次";
    const valS = document.createElement("span");
    valS.className = "together-stat-val";
    valS.textContent = fmtListenMs(sessionMs);
    boxS.appendChild(labS);
    boxS.appendChild(valS);
    const boxT = document.createElement("div");
    boxT.className = "together-stat together-stat--total";
    const labT = document.createElement("span");
    labT.className = "together-stat-label";
    labT.textContent = "累计";
    const valT = document.createElement("span");
    valT.className = "together-stat-val";
    valT.textContent = fmtListenMs(totalMs);
    boxT.appendChild(labT);
    boxT.appendChild(valT);
    stats.appendChild(boxS);
    stats.appendChild(boxT);

    li.appendChild(head);
    li.appendChild(stats);
    togetherListenList.appendChild(li);
  });
}

joinBtn.addEventListener("click", () => {
  markAudioUnlocked();
  join(roomInput.value);
});

mobileRoomChip?.addEventListener("click", async () => {
  if (!roomJoined || !roomId) return;
  const ok = await showConfirmDialog({
    title: "退出房间",
    message: `确定退出房间「${roomId}」？`,
    okLabel: "退出",
    danger: true,
  });
  if (ok) leaveRoom();
});

newRoomBtn.addEventListener("click", () => {
  markAudioUnlocked();
  const r = randomRoom();
  roomInput.value = r;
  pendingRoomWelcomeId = r;
  join(r);
});

goQueueBtn?.addEventListener("click", () => switchToDiscover("queue"));

roomWelcomeCopy?.addEventListener("click", async () => {
  const id = roomWelcomeId?.textContent?.trim();
  if (!id) return;
  try {
    await navigator.clipboard.writeText(id);
    if (roomWelcomeQueueHint) {
      roomWelcomeQueueHint.textContent = "房间号已复制到剪贴板";
    }
  } catch (_) {
    window.prompt("复制房间号", id);
  }
});

roomWelcomeSearch?.addEventListener("click", () => {
  hideRoomWelcomeModal();
  switchToDiscover("search");
  searchInput?.focus();
});

roomWelcomeQueue?.addEventListener("click", () => {
  hideRoomWelcomeModal();
  switchToDiscover("queue");
});

roomWelcomeClose?.addEventListener("click", hideRoomWelcomeModal);
document.querySelectorAll("[data-room-welcome-close]").forEach((el) => {
  el.addEventListener("click", hideRoomWelcomeModal);
});

confirmModalCancel?.addEventListener("click", () => closeConfirmDialog(false));
confirmModalOk?.addEventListener("click", () => closeConfirmDialog(true));
document.querySelectorAll("[data-confirm-close]").forEach((el) => {
  el.addEventListener("click", () => closeConfirmDialog(false));
});

try {
  restoreSavedSession();
} catch (_) {
  /* ignore */
}

let displayNameSaveTimer = null;
displayNameInput?.addEventListener("input", () => {
  if (displayNameSaveTimer) clearTimeout(displayNameSaveTimer);
  displayNameSaveTimer = setTimeout(() => {
    persistDisplayName(displayNameInput?.value);
    if (selfStatus && currentDisplayName()) {
      selfStatus.textContent = `当前昵称：${currentDisplayName()}（进入房间后他人可见）`;
    }
  }, 400);
});
displayNameInput?.addEventListener("blur", () => {
  persistDisplayName(displayNameInput?.value);
});

if (saveNameBtn && displayNameInput) {
  saveNameBtn.addEventListener("click", () => {
    const name = displayNameInput.value.trim().slice(0, 24);
    if (!name) {
      window.alert("请输入 1～24 字的显示名称");
      displayNameInput.focus();
      return;
    }
    persistDisplayName(name);
    socket.emit("setDisplayName", { name, clientId: getClientId() });
    if (displayNameHint) displayNameHint.textContent = "已保存到本机；若已在房间内，听众列表会更新。";
    if (selfStatus) selfStatus.textContent = `当前昵称：${name}`;
    scheduleAutoRejoin();
  });
}

const VOLUME_KEY = "togetherListenVolume";
let suppressVolumeEmit = false;
let volumeEmitTimer = null;

function clampVolume(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return 1;
  return Math.min(1, Math.max(0, n));
}

/** 更新本地音量 UI 与 audio；进房时 emit 同步到其他端 */
function setVolumeUi(v, { emit = false } = {}) {
  const vol = clampVolume(v);
  audioEl.volume = vol;
  const pct = Math.round(vol * SLIDER_PCT_MAX);
  if (volumeBar) volumeBar.value = String(pct);
  if (volumePct) volumePct.textContent = `${pct}%`;
  if (emit && roomJoined && roomId && !suppressVolumeEmit) {
    clearTimeout(volumeEmitTimer);
    volumeEmitTimer = setTimeout(() => {
      socket.emit("setVolume", { volume: vol });
    }, 200);
  }
}

function applyStoredVolume() {
  let v = 1;
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    if (raw != null) {
      const n = Number(raw);
      if (Number.isFinite(n)) v = clampVolume(n);
    }
  } catch (_) {
    /* ignore */
  }
  setVolumeUi(v);
}

/** 应用服务器房间音量（网页调音量后手机端 state 同步） */
function applyRoomVolume(s) {
  if (!roomJoined || s?.volume == null) return;
  const vol = clampVolume(s.volume);
  const pct = Math.round(vol * SLIDER_PCT_MAX);
  const barPct = volumeBar ? Math.round(Number(volumeBar.value)) : pct;
  if (
    Math.abs(clampVolume(audioEl.volume) - vol) < 0.005 &&
    barPct === pct
  ) {
    return;
  }
  suppressVolumeEmit = true;
  setVolumeUi(vol);
  suppressVolumeEmit = false;
}

applyStoredVolume();

if (volumeBar) {
  const onVolumeInput = () => {
    if (suppressVolumeEmit) return;
    const pct = Math.round(Number(volumeBar.value));
    const v = clampVolume(pct / SLIDER_PCT_MAX);
    setVolumeUi(v, { emit: roomJoined });
    if (!roomJoined) {
      try {
        localStorage.setItem(VOLUME_KEY, String(v));
      } catch (_) {
        /* ignore */
      }
    }
  };
  const onVolumeCommit = () => {
    onVolumeInput();
    if (suppressVolumeEmit) return;
    const pct = Math.round(Number(volumeBar.value));
    logUserOp("volume", { pct, volume: clampVolume(pct / SLIDER_PCT_MAX) });
  };
  volumeBar.addEventListener("input", onVolumeInput);
  volumeBar.addEventListener("change", onVolumeCommit);
}

addBtn.addEventListener("click", () => {
  if (!requireRoom()) return;
  const url = urlInput.value.trim();
  const title = titleInput.value.trim();
  if (!url) return;
  logUserOp("addTrack", { title: title || url.slice(0, 80) });
  socket.emit("addTrack", { url, title });
  urlInput.value = "";
  titleInput.value = "";
});

togglePlayBtn?.addEventListener("pointerdown", () => markAudioUnlocked());
togglePlayBtn?.addEventListener("click", async () => {
  if (!requireRoom() || !state?.currentUrl) return;
  markAudioUnlocked();
  if (needsLocalPlaybackStart()) {
    await startLocalPlaybackIfNeeded();
    return;
  }
  if (state.isPlaying) {
    lastUserPausedAt = Date.now();
    logUserOp("pause", { title: state.currentTitle || null });
    socket.emit("pause");
    return;
  }
  if (needsPlaybackRestart()) {
    loadAudioSource(state.currentUrl, true);
    logUserOp("seek", { posSec: 0, reason: "playFromStart" });
    socket.emit("seek", 0);
  }
  logUserOp("play", { title: state.currentTitle || null });
  socket.emit("play");
  if (state.currentUrl && lastAppliedUrl === state.currentUrl) {
    resumeSyncedPlayback();
  }
});

prevBtn.addEventListener("click", () => {
  if (!requireRoom()) return;
  markAudioUnlocked();
  logUserOp("prev", { fromTitle: state?.currentTitle || null });
  socket.emit("prev");
});
nextBtn.addEventListener("click", () => {
  if (!requireRoom()) return;
  markAudioUnlocked();
  logUserOp("next", { fromTitle: state?.currentTitle || null });
  socket.emit("next");
});

function onAudioDurationReady() {
  const dur = audioDurationSec();
  if (tDur) tDur.textContent = dur != null ? fmt(dur) : "--:--";
  refreshPlaybackUi();
}

audioEl.addEventListener("loadedmetadata", () => {
  onAudioDurationReady();
  markDriftSyncReady();
  if (state?.isPlaying && state.currentUrl && lastAppliedUrl === state.currentUrl) {
    tryResumePlaybackIfNeeded();
  }
});

audioEl.addEventListener("durationchange", onAudioDurationReady);

audioEl.addEventListener("canplay", () => {
  tryResumePlaybackIfNeeded();
  ensurePlaybackSynced();
  if (audioUnlocked && state?.isPlaying) {
    startLocalPlaybackIfNeeded();
  }
});

audioEl.addEventListener("playing", () => {
  audioLoadRetryCount = 0;
  playBlocked = false;
  pendingPlaySync = false;
  if (state) nowPlaying.textContent = formatNowPlayingLabel(state);
  syncMediaSession();
});

audioEl.addEventListener("error", () => {
  if (!state?.currentUrl || !roomJoined) return;
  if (audioLoadRetryCount >= 2) {
    playBlocked = true;
    pendingPlaySync = true;
    if (nowPlaying && state) {
      nowPlaying.textContent = formatNowPlayingLabel(state);
    }
    showToast("音频加载失败，请点 ▶ 重试", { error: true, ms: 3200 });
    return;
  }
  audioLoadRetryCount += 1;
  lastAppliedUrl = "";
  endedCooldownUntil = Date.now() + 600;
  loadAudioSource(state.currentUrl, state.isPlaying);
});

audioEl.addEventListener("stalled", () => {
  if (state?.isPlaying && audioEl.paused) ensurePlaybackSynced();
});

audioEl.addEventListener("timeupdate", () => {
  if (localSeeking) return;
  if (audioEl.paused && state?.isPlaying) return;
  refreshPlaybackUi();
});

audioEl.addEventListener("ended", () => {
  if (Date.now() < endedCooldownUntil) return;
  if (!roomJoined || !roomId || state == null) return;
  if (state.currentIndex == null || state.currentIndex < 0) return;
  if (!state.currentUrl) return;
  endedCooldownUntil = Date.now() + 1000;
  emitTrackNaturalEnd(state.currentIndex);
});

function applyState(s) {
  clearPendingNaturalEnd(s);
  state = s;
  if (s.roomId) roomId = s.roomId;
  updatePlayModeUi(s.playMode);
  applyAudienceAndTogether(s);

  const sig = playbackSignature(s);
  const posSig = anchorPosSignature(s);
  const wallMs = s.anchorWallMs || 0;
  const playbackChanged = sig !== lastPlaybackSig;
  const anchorPosChanged = posSig !== lastAnchorPosSig;
  const anchorWallChanged = wallMs !== lastAnchorWallMs;
  const anchorChanged = anchorPosChanged || anchorWallChanged;
  lastPlaybackSig = sig;
  lastAnchorPosSig = posSig;
  lastAnchorWallMs = wallMs;

  applyRoomVolume(s);

  if (!playbackChanged && !anchorChanged) {
    renderQueue();
    updateQueuePeek();
    updateFavoriteBtnUi();
    refreshPlaybackUi();
    syncMobileChrome();
    if (s.isPlaying && audioEl.paused && !playBlocked) {
      lastEnsureSyncAt = 0;
      ensurePlaybackSynced();
    }
    return;
  }

  if (anchorChanged && !playbackChanged) {
    /* 单曲循环等：仅 anchor 变但音频仍在 ended，须重载同一 URL */
    if (s.currentUrl && s.isPlaying && (needsPlaybackRestart() || audioEl.ended)) {
      loadAudioSource(s.currentUrl, true);
      lastEnsureSyncAt = 0;
      ensurePlaybackSynced();
      scheduleApplyPositionWhenReady(anchorPosChanged);
      if (audioUnlocked) startLocalPlaybackIfNeeded();
      else {
        pendingPlaySync = true;
        playBlocked = true;
      }
    } else {
      applyServerPlaybackPosition({
        force: anchorPosChanged,
        immediate: anchorPosChanged,
      });
      if (s.isPlaying && audioEl.paused && !playBlocked) {
        lastEnsureSyncAt = 0;
        ensurePlaybackSynced();
      }
      if (needsLocalPlaybackStart() && audioUnlocked) {
        startLocalPlaybackIfNeeded();
      }
    }
    refreshPlaybackUi();
    syncMobileChrome();
    return;
  }

  if (playbackChanged) notePlaybackTrackChange();

  if (!s.currentUrl) {
    nowPlaying.textContent = "队列为空，先添加音频链接";
    if (tCur) tCur.textContent = "0:00";
    if (tDur) tDur.textContent = "0:00";
  } else {
    nowPlaying.textContent = formatNowPlayingLabel(s);
  }

  renderQueue();
  renderRoomSidePanels(s);
  updateTransportState(s);
  updateQueuePeek();
  maybeShowRoomWelcome();
  updateFavoriteBtnUi();
  refreshPlaybackUi();
  syncMobileChrome();
  syncPlaybackAfterTrackChange(s, { anchorPosChanged });
  if (!audioUnlocked && s.currentUrl && s.isPlaying && nowPlaying) {
    nowPlaying.textContent = formatNowPlayingLabel(s);
  }
}

function updateQueueSelectionHint() {
  const n = selectedQueueIndices.size;
  if (queueSelectionHint) {
    queueSelectionHint.textContent = n
      ? `已选 ${n} 首，可点击「删除选中」`
      : "可勾选多首后批量删除";
  }
  if (queueRemoveSelectedBtn) queueRemoveSelectedBtn.disabled = n === 0;
}

function clearQueueSelection() {
  selectedQueueIndices.clear();
  updateQueueSelectionHint();
}

function renderQueue() {
  if (!state) return;
  const prevSelected = new Set(selectedQueueIndices);
  selectedQueueIndices.clear();
  queueList.innerHTML = "";
  state.queue.forEach((item, i) => {
    const li = document.createElement("li");
    li.className = "queue-select-row";
    if (i === state.currentIndex) li.classList.add("active");
    if (prevSelected.has(i)) selectedQueueIndices.add(i);

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.className = "queue-check";
    cb.checked = selectedQueueIndices.has(i);
    cb.addEventListener("change", () => {
      if (cb.checked) selectedQueueIndices.add(i);
      else selectedQueueIndices.delete(i);
      li.classList.toggle("selected", cb.checked);
      updateQueueSelectionHint();
    });
    if (cb.checked) li.classList.add("selected");

    const actions = document.createElement("div");
    actions.className = "queue-actions";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "queue-move btn-chip secondary";
    up.title = "上移";
    up.textContent = "↑";
    up.disabled = i === 0;
    up.addEventListener("click", (e) => {
      e.stopPropagation();
      socket.emit("moveTrack", { index: i, direction: -1 });
    });

    const down = document.createElement("button");
    down.type = "button";
    down.className = "queue-move btn-chip secondary";
    down.title = "下移";
    down.textContent = "↓";
    down.disabled = i === state.queue.length - 1;
    down.addEventListener("click", (e) => {
      e.stopPropagation();
      socket.emit("moveTrack", { index: i, direction: 1 });
    });

    const titleSpan = document.createElement("span");
    titleSpan.className = "queue-title";
    titleSpan.textContent = `${i + 1}. ${item.title}`;

    const playThis = document.createElement("button");
    playThis.type = "button";
    playThis.className = "btn-chip";
    playThis.textContent = "播";
    playThis.addEventListener("click", (e) => {
      e.stopPropagation();
      logUserOp("select", { index: i, title: item.title });
      socket.emit("select", i);
    });

    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "btn-chip secondary";
    rm.textContent = "删";
    rm.addEventListener("click", (e) => {
      e.stopPropagation();
      socket.emit("removeTrack", i);
    });

    actions.append(up, down, playThis, rm);
    li.appendChild(cb);
    li.appendChild(titleSpan);
    li.appendChild(actions);
    queueList.appendChild(li);
  });
  updateQueueSelectionHint();
  updateQueuePeek();
}

function removeQueueOnServer(indices) {
  if (!requireRoom()) return;
  if (!indices.length) return;
  invalidatePlaybackSig();
  socket.emit("removeTracks", { indices });
}

function initQueueToolbar() {
  queueSelectAllBtn?.addEventListener("click", () => {
    if (!state?.queue?.length) return;
    state.queue.forEach((_, i) => selectedQueueIndices.add(i));
    renderQueue();
  });

  queueClearSelectionBtn?.addEventListener("click", () => {
    clearQueueSelection();
    renderQueue();
  });

  queueRemoveSelectedBtn?.addEventListener("click", () => {
    if (!selectedQueueIndices.size) return;
    const indices = [...selectedQueueIndices].sort((a, b) => a - b);
    removeQueueOnServer(indices);
    clearQueueSelection();
  });

  queueDeleteAllBtn?.addEventListener("click", async () => {
    if (!requireRoom() || !state?.queue?.length) return;
    const ok = await showConfirmDialog({
      title: "删除全部曲目",
      message: `确定删除队列中的全部 ${state.queue.length} 首？`,
      okLabel: "删全部",
      danger: true,
    });
    if (!ok) return;
    clearQueueSelection();
    invalidatePlaybackSig();
    applyLocalQueueEmpty();
    socket.emit("clearQueue");
  });

  queueClearBtn?.addEventListener("click", async () => {
    if (!requireRoom() || !state?.queue?.length) return;
    const ok = await showConfirmDialog({
      title: "清空队列",
      message: "确定清空整个播放队列？正在播放也会停止。",
      okLabel: "清空",
      danger: true,
    });
    if (!ok) return;
    clearQueueSelection();
    invalidatePlaybackSig();
    applyLocalQueueEmpty();
    socket.emit("clearQueue");
  });
}

initQueueToolbar();

socket.on("leftRoom", () => {
  resetClientAfterLeave();
  if (roomStatus) {
    roomStatus.textContent = isMobileLayout()
      ? "已退出房间，可输入房间号后点「进入」"
      : "已退出房间。";
  }
});

socket.on("joined", ({ roomId: id, selfId }) => {
  mySocketId = selfId || null;
  roomId = id;
  roomJoined = true;
  updateRoomJoinUi();
  lastAppliedUrl = "";
  lastPlaybackSig = "";
  invalidateAnchorSig();
  lastMembersRenderKey = "";
  lastTogetherRenderKey = "";
  pendingPlaySync = false;
  playBlocked = false;
  endedCooldownUntil = 0;
  pendingNaturalEndIndex = null;
  pendingNaturalEndAt = 0;
  pendingNaturalEndAnchorMs = 0;
  naturalEndReportedAnchorMs = 0;
  driftOverThresholdCount = 0;
  lastDriftSeekAt = 0;
  lastEnsureSyncAt = 0;
  audioLoadRetryCount = 0;
  persistRoomId(id);
  roomStatus.textContent = isMobileLayout()
    ? `已进房「${id}」· 点底部「房间」看听众`
    : `已连接房间「${id}」，左侧可看到听众与在线状态。`;
  syncMobileChrome();
  roomInput.value = id;
  if (selfStatus && currentDisplayName()) {
    selfStatus.textContent = `当前昵称：${currentDisplayName()}`;
  }
  maybeWelcomeYanOnJoin();
  if (isMobileLayout()) {
    showToast("进房后请轻触 ▶ 播放声音", { ms: 3200 });
  }
});

socket.on("state", (s) => {
  applyState(s);
});

socket.on("disconnect", () => {
  roomJoined = false;
  updateRoomJoinUi();
});

socket.on("togetherListen", (partial) => {
  if (!state) return;
  state = { ...state, ...partial };
  applyAudienceAndTogether(state);
});

socket.on("listenerJoined", (payload) => {
  if (!payload || !roomJoined) return;
  showListenerJoinNotice(payload);
});

socket.on("displayNameOk", ({ name }) => {
  if (displayNameHint) displayNameHint.textContent = "昵称已同步到服务器。";
  if (selfStatus && name) selfStatus.textContent = `当前昵称：${name}`;
});

socket.on("joinError", ({ message }) => {
  roomJoined = false;
  updateRoomJoinUi();
  if (roomStatus) {
    roomStatus.textContent = message || "无法进入房间";
  }
  if (!message) return;
  window.alert(message);
});

socket.on("sessionReplaced", ({ message }) => {
  roomJoined = false;
  updateRoomJoinUi();
  window.alert(
    message || "同一浏览器已重新连接，本页连接已断开。请刷新后继续使用。",
  );
});

socket.on("displayNameError", ({ message }) => {
  window.alert(message || "昵称无效");
});

socket.on("errorMsg", ({ message }) => {
  showToast(message || "操作失败", { error: true, ms: 3200 });
});

socket.on("infoMsg", ({ message }) => {
  if (message) showToast(message, { success: true });
});

function requireRoom() {
  if (!roomId) {
    window.alert("请先进入房间");
    return false;
  }
  if (!roomJoined) {
    window.alert("正在连接房间，请稍候再试…");
    return false;
  }
  if (!socket.connected) {
    window.alert("与服务器断开，请刷新页面或稍后重试");
    return false;
  }
  return true;
}

function renderSongRow(song, onAdd) {
  const li = document.createElement("li");
  const meta = document.createElement("div");
  meta.className = "meta";
  const nameEl = document.createElement("span");
  nameEl.className = "song-name";
  nameEl.textContent = song.name || "未知歌曲";
  meta.appendChild(nameEl);
  if (song.artists) {
    const ar = document.createElement("span");
    ar.className = "song-artists";
    ar.textContent = song.artists;
    meta.appendChild(ar);
  }
  if (song.matchLyric) {
    const tag = document.createElement("span");
    tag.className = "song-album";
    tag.textContent = "歌词匹配";
    meta.appendChild(tag);
  }
  if (song.album) {
    const al = document.createElement("span");
    al.className = "song-album";
    al.textContent = song.album;
    meta.appendChild(al);
  }
  const actions = document.createElement("div");
  actions.className = "row-actions";
  appendSongActionButtons(actions, song, {
    onAdd: onAdd || addSongToQueue,
    showFavorite: true,
  });
  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

function renderArtistRow(artist) {
  const li = document.createElement("li");
  li.className = "artist-row";
  const meta = document.createElement("div");
  meta.className = "meta";
  const nameEl = document.createElement("span");
  nameEl.className = "song-name";
  nameEl.textContent = artist.name || "未知歌手";
  meta.appendChild(nameEl);
  if (artist.alias) {
    const al = document.createElement("span");
    al.className = "song-artists";
    al.textContent = artist.alias;
    meta.appendChild(al);
  }
  const sub = document.createElement("span");
  sub.className = "song-album";
  sub.textContent = `单曲 ${artist.musicSize ?? 0} · 专辑 ${artist.albumSize ?? 0}`;
  meta.appendChild(sub);
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const searchBtn = document.createElement("button");
  searchBtn.type = "button";
  searchBtn.className = "secondary";
  searchBtn.textContent = "搜 TA 的歌";
  searchBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    searchMode = "song";
    updateSearchModeUi();
    if (searchInput) searchInput.value = artist.name || "";
    runSearch();
  });
  actions.appendChild(searchBtn);
  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

function addSongToQueue(song) {
  if (!requireRoom()) return;
  socket.emit("addNeteaseTrack", {
    id: song.id,
    title: songDisplayTitle(song),
  });
}

async function refreshNeteaseStatus() {
  try {
    const res = await fetch("/api/netease/status");
    const data = await res.json();
    neteaseLoggedIn = Boolean(data.loggedIn);
    if (data.loggedIn) {
      neteaseStatus.textContent = data.nickname || "已登录";
      neteaseStatus.classList.add("logged-in");
      neteaseLogoutBtn?.classList.remove("hidden");
      await loadPlaylists();
    } else {
      neteaseStatus.textContent = "未登录";
      neteaseStatus.classList.remove("logged-in");
      neteaseLogoutBtn?.classList.add("hidden");
      playlistList.innerHTML = "";
      playlistDetail.classList.add("hidden");
      activePlaylistId = null;
      playlistHint.textContent = "右上角扫码登录后加载歌单。";
    }
  } catch (_) {
    neteaseStatus.textContent = "代理不可用";
    neteaseStatus.classList.remove("logged-in");
    neteaseLogoutBtn?.classList.add("hidden");
  }
}

function stopQrPoll() {
  if (qrPollTimer) {
    clearInterval(qrPollTimer);
    qrPollTimer = null;
  }
}

neteaseQrBtn.addEventListener("click", async () => {
  if (!qrBox.classList.contains("hidden") && qrImg.src) {
    stopQrPoll();
    qrBox.classList.add("hidden");
    return;
  }
  stopQrPoll();
  try {
    const res = await fetch("/api/netease/login/qr/start", { method: "POST" });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "二维码获取失败");
    qrImg.src = data.qrimg;
    qrBox.classList.remove("hidden");
    qrPollTimer = setInterval(async () => {
      try {
        const chk = await fetch(`/api/netease/login/qr/check?key=${encodeURIComponent(data.key)}`);
        const st = await chk.json();
        if (st.code === 803 && st.loggedIn) {
          stopQrPoll();
          qrBox.classList.add("hidden");
          await refreshNeteaseStatus();
        }
      } catch (_) {
        /* keep polling */
      }
    }, 2000);
  } catch (e) {
    window.alert(e.message || "扫码登录失败");
  }
});

neteaseLogoutBtn.addEventListener("click", async () => {
  stopQrPoll();
  qrBox.classList.add("hidden");
  await fetch("/api/netease/logout", { method: "POST" });
  await refreshNeteaseStatus();
});

searchBtn.addEventListener("click", () => runSearch());
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") runSearch();
});

function clearTrackSelection() {
  selectedTrackIds.clear();
  playlistTracks.querySelectorAll(".track-check").forEach((cb) => {
    cb.checked = false;
  });
  playlistTracks.querySelectorAll(".track-select-row").forEach((row) => {
    row.classList.remove("selected");
  });
  updateSelectionHint();
}

function updateSelectionHint() {
  const n = selectedTrackIds.size;
  if (playlistSelectionHint) {
    playlistSelectionHint.textContent = n
      ? `已选 ${n} 首，可点击「加入选中」批量入队`
      : "勾选曲目后可批量加入或播放";
  }
  if (addSelectedTracksBtn) addSelectedTracksBtn.disabled = n === 0;
  if (playSelectedTracksBtn) playSelectedTracksBtn.disabled = n === 0;
}

function playSelectedTracksFromPlaylist() {
  if (!requireRoom() || !selectedTrackIds.size) return;
  const tracks = activePlaylistTracks
    .filter((s) => selectedTrackIds.has(s.id))
    .map((s) => ({ id: s.id, title: songDisplayTitle(s) }));
  if (!tracks.length) return;
  markAudioUnlocked();
  socket.emit("playNeteaseTracks", { tracks });
  clearTrackSelection();
}

function addSelectedTracksToQueue() {
  if (!requireRoom()) return;
  if (!selectedTrackIds.size) return;
  const tracks = activePlaylistTracks
    .filter((s) => selectedTrackIds.has(s.id))
    .map((s) => ({
      id: s.id,
      title: s.title || (s.artists ? `${s.name} — ${s.artists}` : s.name),
    }));
  socket.emit("addNeteaseTracks", { tracks });
  clearTrackSelection();
}

function renderSelectableSongRow(song) {
  const li = document.createElement("li");
  li.className = "track-select-row";
  if (selectedTrackIds.has(song.id)) li.classList.add("selected");

  const cb = document.createElement("input");
  cb.type = "checkbox";
  cb.className = "track-check";
  cb.checked = selectedTrackIds.has(song.id);
  cb.addEventListener("change", () => {
    if (cb.checked) selectedTrackIds.add(song.id);
    else selectedTrackIds.delete(song.id);
    li.classList.toggle("selected", cb.checked);
    updateSelectionHint();
  });

  const meta = document.createElement("div");
  meta.className = "meta";
  const nameEl = document.createElement("span");
  nameEl.className = "song-name";
  nameEl.textContent = song.name || "未知歌曲";
  meta.appendChild(nameEl);
  if (song.artists) {
    const ar = document.createElement("span");
    ar.className = "song-artists";
    ar.textContent = song.artists;
    meta.appendChild(ar);
  }
  if (song.album) {
    const al = document.createElement("span");
    al.className = "song-album";
    al.textContent = song.album;
    meta.appendChild(al);
  }

  const actions = document.createElement("div");
  actions.className = "row-actions";
  appendSongActionButtons(actions, song, {
    showFavorite: true,
  });

  li.appendChild(cb);
  li.appendChild(meta);
  li.appendChild(actions);
  return li;
}

function renderPlaylistTracksList(tracks) {
  activePlaylistTracks = tracks;
  clearTrackSelection();
  playlistTracks.innerHTML = "";
  tracks.forEach((song) => {
    playlistTracks.appendChild(renderSelectableSongRow(song));
  });
}

function fillPlaylistListEl(listEl, playlists) {
  if (!listEl) return;
  listEl.innerHTML = "";
  if (!playlists.length) {
    listEl.innerHTML = "<li>暂无歌单</li>";
    return;
  }
  playlists.forEach((pl) => listEl.appendChild(renderPlaylistRow(pl)));
  syncPlaylistListViewingState();
}

function syncPlaylistListViewingState() {
  document.querySelectorAll(".playlist-list, .search-results").forEach((container) => {
    const expanded = container.querySelector(".playlist-row.is-expanded");
    container.classList.toggle("is-viewing-playlist", Boolean(expanded));
  });
}

function rerenderCachedPlaylistLists() {
  if (xiaoyanPlaylistList && cachedXiaoyanPlaylists.length) {
    fillPlaylistListEl(xiaoyanPlaylistList, cachedXiaoyanPlaylists);
  }
  if (playlistList && cachedMyPlaylists.length) {
    fillPlaylistListEl(playlistList, cachedMyPlaylists);
  }
  if (searchMode === "playlist" && searchResults && cachedSearchPlaylists.length) {
    fillPlaylistListEl(searchResults, cachedSearchPlaylists);
  }
}

function closePlaylistView() {
  playlistDetail.classList.add("hidden");
  playlistDetail.classList.remove("is-open");
  activePlaylistId = null;
  activePlaylistTracks = [];
  clearTrackSelection();
  rerenderCachedPlaylistLists();
  syncPlaylistListViewingState();
}

function renderPlaylistRow(pl) {
  const li = document.createElement("li");
  li.className = "playlist-row";
  li.dataset.playlistId = String(pl.id);
  const isExpanded = pl.id === activePlaylistId;

  if (isExpanded) {
    li.classList.add("active", "is-expanded");
    const meta = document.createElement("div");
    meta.className = "meta meta--expanded";
    const nameEl = document.createElement("span");
    nameEl.className = "song-name";
    nameEl.textContent = pl.name || "未命名歌单";
    meta.appendChild(nameEl);

    const actions = document.createElement("div");
    actions.className = "row-actions";
    const collapseBtn = document.createElement("button");
    collapseBtn.type = "button";
    collapseBtn.className = "secondary";
    collapseBtn.textContent = "收起";
    collapseBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closePlaylistView();
    });
    actions.appendChild(collapseBtn);
    li.appendChild(meta);
    li.appendChild(actions);
    return li;
  }

  const meta = document.createElement("div");
  meta.className = "meta";
  const nameEl = document.createElement("span");
  nameEl.className = "song-name";
  nameEl.textContent = pl.name || "未命名歌单";
  meta.appendChild(nameEl);
  if (pl.creator) {
    const cr = document.createElement("span");
    cr.className = "song-creator";
    cr.textContent = `创建者：${pl.creator}`;
    meta.appendChild(cr);
  }
  const sub = document.createElement("span");
  sub.className = "song-album";
  sub.textContent = `${pl.trackCount ?? 0} 首`;
  meta.appendChild(sub);

  const actions = document.createElement("div");
  actions.className = "row-actions";
  const viewBtn = document.createElement("button");
  viewBtn.type = "button";
  viewBtn.className = "secondary";
  viewBtn.textContent = "查看";
  viewBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPlaylist(pl.id, pl.name, pl.creator);
  });
  const playBtn = document.createElement("button");
  playBtn.type = "button";
  playBtn.className = "secondary";
  playBtn.textContent = "播放";
  playBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    if (!requireRoom()) return;
    try {
      const res = await fetch(`/api/netease/playlist/${pl.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "加载失败");
      if (!data.tracks?.length) {
        window.alert("歌单为空");
        return;
      }
      playSongNow(data.tracks[0]);
    } catch (err) {
      window.alert(err.message || "播放失败");
    }
  });
  const addAll = document.createElement("button");
  addAll.type = "button";
  addAll.textContent = "整单加入";
  addAll.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!requireRoom()) return;
    socket.emit("addNeteasePlaylist", { playlistId: pl.id });
  });
  actions.appendChild(viewBtn);
  actions.appendChild(playBtn);
  actions.appendChild(addAll);

  li.appendChild(meta);
  li.appendChild(actions);
  li.addEventListener("click", () => openPlaylist(pl.id, pl.name, pl.creator));
  return li;
}

async function runSearch() {
  const q = searchInput.value.trim();
  if (!q) return;
  searchResults.innerHTML = "<li>搜索中…</li>";
  if (searchResultHint) searchResultHint.textContent = "";
  try {
    const res = await fetch(
      `/api/netease/search?q=${encodeURIComponent(q)}&type=${encodeURIComponent(searchMode)}`,
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "搜索失败");
    searchResults.innerHTML = "";

    if (searchMode === "playlist") {
      const list = data.playlists || [];
      if (searchResultHint) {
        searchResultHint.textContent = list.length
          ? `共 ${list.length} 个歌单`
          : "";
      }
      if (!list.length) {
        searchResults.innerHTML = "<li>无匹配歌单</li>";
        return;
      }
      cachedSearchPlaylists = list;
      fillPlaylistListEl(searchResults, cachedSearchPlaylists);
      return;
    }

    if (searchMode === "artist") {
      const list = data.artists || [];
      if (searchResultHint) {
        searchResultHint.textContent = list.length
          ? `共 ${list.length} 位歌手`
          : "";
      }
      if (!list.length) {
        searchResults.innerHTML = "<li>无匹配歌手</li>";
        return;
      }
      list.forEach((a) => searchResults.appendChild(renderArtistRow(a)));
      return;
    }

    const list = data.songs || [];
    const label = searchMode === "lyric" ? "首歌词相关歌曲" : "首单曲";
    if (searchResultHint) {
      searchResultHint.textContent = list.length
        ? `共 ${list.length} ${label}`
        : "";
    }
    if (!list.length) {
      searchResults.innerHTML = "<li>无结果</li>";
      return;
    }
    list.forEach((song) => {
      searchResults.appendChild(renderSongRow(song, addSongToQueue));
    });
  } catch (e) {
    searchResults.innerHTML = `<li>${e.message || "搜索失败"}</li>`;
  }
}

async function loadXiaoyanPlaylists() {
  if (!xiaoyanPlaylistList) return;
  xiaoyanPlaylistList.innerHTML = "<li>加载歌单…</li>";
  try {
    const res = await fetch("/api/netease/xiaoyan/playlists");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载失败");
    xiaoyanPlaylistList.innerHTML = "";
    if (!data.playlists?.length) {
      xiaoyanPlaylistList.innerHTML = "<li>暂无歌单</li>";
      return;
    }
    const creator = data.creator || "橙子味的小x";
    if (xiaoyanPlaylistHint) {
      xiaoyanPlaylistHint.textContent = `来自「${creator}」，共 ${data.playlists.length} 个歌单，点击查看曲目、多选或整单加入。`;
    }
    cachedXiaoyanPlaylists = data.playlists.map((pl) => ({
      ...pl,
      creator: pl.creator || creator,
    }));
    fillPlaylistListEl(xiaoyanPlaylistList, cachedXiaoyanPlaylists);
  } catch (e) {
    xiaoyanPlaylistList.innerHTML = `<li>${e.message || "加载失败"}</li>`;
  }
}

async function loadPlaylists() {
  if (!neteaseLoggedIn) return;
  playlistList.innerHTML = "<li>加载歌单…</li>";
  try {
    const res = await fetch("/api/netease/playlists");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载失败");
    playlistList.innerHTML = "";
    if (!data.playlists?.length) {
      playlistList.innerHTML = "<li>暂无歌单</li>";
      return;
    }
    playlistHint.textContent = `共 ${data.playlists.length} 个歌单，点击查看曲目、多选或整单加入。`;
    cachedMyPlaylists = data.playlists;
    fillPlaylistListEl(playlistList, cachedMyPlaylists);
  } catch (e) {
    playlistList.innerHTML = `<li>${e.message || "加载失败"}</li>`;
  }
}

async function openPlaylist(id, nameHint, creatorHint) {
  activePlaylistId = id;
  rerenderCachedPlaylistLists();
  syncPlaylistListViewingState();
  playlistDetail.classList.remove("hidden");
  playlistDetail.classList.add("is-open");
  playlistDetail.scrollIntoView({ behavior: "smooth", block: "nearest" });
  if (playlistTitle) playlistTitle.hidden = true;
  if (playlistCreator) playlistCreator.hidden = true;
  playlistTracks.innerHTML = "<li>加载曲目…</li>";
  addAllPlaylistBtn.disabled = true;
  if (addSelectedTracksBtn) addSelectedTracksBtn.disabled = true;
  activePlaylistTracks = [];
  clearTrackSelection();
  try {
    const res = await fetch(`/api/netease/playlist/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "加载失败");
    if (!data.tracks?.length) {
      playlistTracks.innerHTML = "<li>歌单为空</li>";
      activePlaylistTracks = [];
      return;
    }
    renderPlaylistTracksList(data.tracks);
    addAllPlaylistBtn.disabled = false;
    addAllPlaylistBtn.onclick = () => {
      if (!requireRoom()) return;
      socket.emit("addNeteasePlaylist", { playlistId: id });
    };
  } catch (e) {
    playlistTracks.innerHTML = `<li>${e.message || "加载失败"}</li>`;
    activePlaylistTracks = [];
  }
}

loadPlaylistsBtn.addEventListener("click", () => loadPlaylists());
loadXiaoyanPlaylistsBtn?.addEventListener("click", () => loadXiaoyanPlaylists());
loadXiaoyanCommentsBtn?.addEventListener("click", () => loadXiaoyanComments());

selectAllTracksBtn?.addEventListener("click", () => {
  activePlaylistTracks.forEach((s) => selectedTrackIds.add(s.id));
  playlistTracks.querySelectorAll(".track-select-row").forEach((row, i) => {
    const song = activePlaylistTracks[i];
    if (!song) return;
    row.classList.add("selected");
    const cb = row.querySelector(".track-check");
    if (cb) cb.checked = true;
  });
  updateSelectionHint();
});

clearTrackSelectionBtn?.addEventListener("click", () => clearTrackSelection());

addSelectedTracksBtn?.addEventListener("click", () => addSelectedTracksToQueue());
playSelectedTracksBtn?.addEventListener("click", () => playSelectedTracksFromPlaylist());

favoriteBtn?.addEventListener("click", () => {
  if (!requireRoom()) return;
  if (!state?.currentUrl) {
    showToast("当前没有在播放的歌曲");
    return;
  }
  toggleRoomFavorite();
});

roomPlNewBtn?.addEventListener("click", () => {
  if (!requireRoom()) return;
  const name = window.prompt("新歌单名称", "新歌单");
  if (name === null) return;
  pendingSelectNewRoomPl = true;
  socket.emit("createRoomPlaylist", { name: name.trim() || "新歌单" });
});

roomPlRenameBtn?.addEventListener("click", () => {
  if (!requireRoom() || !activeRoomPlaylistId) return;
  const pl = (state?.roomPlaylists || []).find((p) => p.id === activeRoomPlaylistId);
  if (!pl) return;
  const name = window.prompt("重命名歌单", pl.name);
  if (name === null || !name.trim()) return;
  socket.emit("renameRoomPlaylist", { playlistId: activeRoomPlaylistId, name: name.trim() });
});

roomPlDeleteBtn?.addEventListener("click", () => {
  if (!requireRoom() || !activeRoomPlaylistId) return;
  const pl = (state?.roomPlaylists || []).find((p) => p.id === activeRoomPlaylistId);
  if (!pl) return;
  showConfirmDialog({
    title: "删除歌单",
    message: `确定删除歌单「${pl.name}」？曲目将无法恢复。`,
    okLabel: "删除",
    danger: true,
  }).then((ok) => {
    if (!ok) return;
    socket.emit("deleteRoomPlaylist", { playlistId: activeRoomPlaylistId });
  });
});

closePlaylistBtn.addEventListener("click", closePlaylistView);

initMainViewTabs();
initMainHubTabs();
initRoomPanelTabs();
initPlaylistTabs();
initMobileShell();
refreshNeteaseStatus();
loadXiaoyanPlaylists();

installAudioUnlockListeners();
initBackgroundPlayback();

/* 进度 UI 500ms；播放对齐与漂移校正降频，减少听感卡顿 */
setInterval(() => {
  refreshPlaybackUi();
  if (!roomJoined || !state || !state.currentUrl || localSeeking) return;

  if (needsPlaybackRestart()) {
    tryEmitNaturalEndIfComplete();
    return;
  }

  if (isAwaitingTrackAdvance()) return;

  if (shouldRunEnsurePlaybackSynced()) {
    ensurePlaybackSynced();
  }

  if (
    state.isPlaying &&
    state.currentUrl &&
    (audioEl.paused || playBlocked || pendingPlaySync) &&
    !isAwaitingTrackAdvance() &&
    lastAppliedUrl === state.currentUrl
  ) {
    if (audioEl.readyState >= 2) {
      tryResumePlaybackIfNeeded();
    }
  }

  maybeCorrectPlaybackDrift();
}, 500);

restoreSavedSession();
initSeekBar();

socket.on("connect", scheduleAutoRejoin);
if (socket.connected) scheduleAutoRejoin();
