/**
 * 同听记录持久化到服务器本地 data/pair-listen.json（累计时长，按房间 + 昵称对）
 */
const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(__dirname, "data");
const STORE_FILE =
  process.env.PAIR_LISTEN_STORE_FILE ||
  path.join(DATA_DIR, "pair-listen.json");

let cache = { rooms: {} };
let saveTimer = null;
let dirty = false;

function readFileSafe() {
  try {
    if (!fs.existsSync(STORE_FILE)) return { rooms: {} };
    const raw = fs.readFileSync(STORE_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return { rooms: {} };
    if (!data.rooms || typeof data.rooms !== "object") return { rooms: {} };
    return data;
  } catch (err) {
    console.warn("[pair-listen-store] read failed:", err.message);
    return { rooms: {} };
  }
}

function loadStore() {
  cache = readFileSafe();
  return cache;
}

function mapFromRecord(record) {
  const m = new Map();
  if (!record || typeof record !== "object") return m;
  for (const [k, v] of Object.entries(record)) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n > 0) m.set(k, n);
  }
  return m;
}

function recordFromMap(map) {
  const o = {};
  if (!map) return o;
  for (const [k, v] of map.entries()) {
    const n = Number(v);
    if (k && Number.isFinite(n) && n > 0) o[k] = n;
  }
  return o;
}

/** 从磁盘加载某房间的累计同听 Map */
function loadRoomTotals(roomId) {
  const id = String(roomId || "").trim();
  if (!id) return new Map();
  const rec = cache.rooms[id];
  return mapFromRecord(rec?.totalMs);
}

/** 将房间累计写入内存缓存并延迟落盘 */
function persistRoomTotals(roomId, totalMap) {
  const id = String(roomId || "").trim();
  if (!id) return;
  if (!cache.rooms) cache.rooms = {};
  cache.rooms[id] = {
    totalMs: recordFromMap(totalMap),
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
      console.warn("[pair-listen-store] write failed:", err.message);
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
    console.warn("[pair-listen-store] flush failed:", err.message);
  }
}

loadStore();

module.exports = {
  loadStore,
  loadRoomTotals,
  persistRoomTotals,
  flushStore,
};
