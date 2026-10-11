/**
 * 操作日志环形缓冲 + 服务器资源采样（管理调试页）
 */
const fs = require("fs");
const os = require("os");

const MAX_LOGS = Number(process.env.OPS_LOG_MAX || 800);
const logs = [];

let lastNetSample = null;
let lastNetAt = 0;

function readLinuxNetBytes() {
  try {
    const raw = fs.readFileSync("/proc/net/dev", "utf8");
    let rx = 0;
    let tx = 0;
    for (const line of raw.split("\n")) {
      const m = line.trim().match(/^(\w+):\s*(\d+)\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+\d+\s+(\d+)/);
      if (!m) continue;
      const iface = m[1];
      if (iface === "lo") continue;
      rx += Number(m[2]) || 0;
      tx += Number(m[3]) || 0;
    }
    return { rxBytes: rx, txBytes: tx };
  } catch {
    return null;
  }
}

function sampleNetwork() {
  const now = Date.now();
  const cur = readLinuxNetBytes();
  let rxMbps = null;
  let txMbps = null;
  if (cur && lastNetSample && lastNetAt) {
    const dt = (now - lastNetAt) / 1000;
    if (dt > 0.05) {
      rxMbps = ((cur.rxBytes - lastNetSample.rxBytes) * 8) / dt / 1e6;
      txMbps = ((cur.txBytes - lastNetSample.txBytes) * 8) / dt / 1e6;
      if (rxMbps < 0) rxMbps = 0;
      if (txMbps < 0) txMbps = 0;
    }
  }
  if (cur) {
    lastNetSample = cur;
    lastNetAt = now;
  }
  return {
    rxMbps: rxMbps != null ? Math.round(rxMbps * 100) / 100 : null,
    txMbps: txMbps != null ? Math.round(txMbps * 100) / 100 : null,
    totalRxMb: cur ? Math.round(cur.rxBytes / 1048576) : null,
    totalTxMb: cur ? Math.round(cur.txBytes / 1048576) : null,
  };
}

/**
 * @param {object} entry
 * @param {string} entry.source - client | server
 * @param {string} [entry.roomId]
 * @param {string} [entry.user]
 * @param {string} [entry.socketId]
 * @param {string} entry.action
 * @param {object} [entry.detail]
 */
function appendOp(entry) {
  const row = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    ts: Date.now(),
    source: entry.source || "server",
    roomId: entry.roomId ? String(entry.roomId) : "",
    user: entry.user ? String(entry.user).slice(0, 32) : "",
    socketId: entry.socketId ? String(entry.socketId).slice(0, 24) : "",
    action: String(entry.action || "unknown").slice(0, 48),
    detail: entry.detail && typeof entry.detail === "object" ? entry.detail : {},
  };
  logs.push(row);
  if (logs.length > MAX_LOGS) logs.splice(0, logs.length - MAX_LOGS);
  const line = `[ops] ${new Date(row.ts).toISOString()} ${row.roomId || "-"} ${row.user || "-"} ${row.action} ${JSON.stringify(row.detail)}`;
  console.log(line);
  return row;
}

function getLogs({ since = 0, limit = 200 } = {}) {
  const sinceMs = Number(since) || 0;
  const lim = Math.min(500, Math.max(1, Number(limit) || 200));
  const filtered = sinceMs
    ? logs.filter((r) => r.ts > sinceMs)
    : logs.slice(-lim);
  return filtered.slice(-lim);
}

/**
 * @param {{ countRooms: () => number, countListeners: () => number }} ctx
 */
function getServerStats(ctx = {}) {
  const total = os.totalmem();
  const free = os.freemem();
  const mem = process.memoryUsage();
  const load = os.loadavg();
  const cpus = os.cpus().length;
  return {
    ts: Date.now(),
    hostname: os.hostname(),
    nodeVersion: process.version,
    uptimeSec: Math.round(process.uptime()),
    cpu: {
      cores: cpus,
      load1: Math.round(load[0] * 100) / 100,
      load5: Math.round(load[1] * 100) / 100,
      load15: Math.round(load[2] * 100) / 100,
    },
    memory: {
      totalMb: Math.round(total / 1048576),
      freeMb: Math.round(free / 1048576),
      usedMb: Math.round((total - free) / 1048576),
      usedPct: Math.round(((total - free) / total) * 1000) / 10,
      processRssMb: Math.round(mem.rss / 1048576),
      processHeapMb: Math.round(mem.heapUsed / 1048576),
    },
    app: {
      rooms: typeof ctx.countRooms === "function" ? ctx.countRooms() : 0,
      listeners: typeof ctx.countListeners === "function" ? ctx.countListeners() : 0,
      logCount: logs.length,
      logMax: MAX_LOGS,
    },
    network: sampleNetwork(),
    env: {
      port: Number(process.env.PORT) || 3847,
      nodeEnv: process.env.NODE_ENV || "development",
    },
  };
}

function adminTokenValid(token) {
  const expected = String(process.env.ADMIN_TOKEN || "").trim();
  if (!expected) return false;
  return String(token || "").trim() === expected;
}

function isAdminEnabled() {
  return Boolean(String(process.env.ADMIN_TOKEN || "").trim());
}

module.exports = {
  appendOp,
  getLogs,
  getServerStats,
  adminTokenValid,
  isAdminEnabled,
};
