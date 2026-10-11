const TOKEN_KEY = "togetherListenAdminToken";
const POLL_LOG_MS = 1500;
const POLL_STATS_MS = 3000;

const $ = (id) => document.getElementById(id);

const adminToken = $("adminToken");
const connectBtn = $("connectBtn");
const clearLogsBtn = $("clearLogsBtn");
const authStatus = $("authStatus");
const statsPanel = $("statsPanel");
const logToolbar = $("logToolbar");
const logWrap = $("logWrap");
const logBody = $("logBody");
const logEmpty = $("logEmpty");
const filterAction = $("filterAction");
const autoScroll = $("autoScroll");
const pausePoll = $("pausePoll");

let connected = false;
let lastLogTs = 0;
const seenIds = new Set();
let logTimer = null;
let statsTimer = null;

function getToken() {
  return (adminToken?.value || "").trim();
}

function apiUrl(path) {
  const t = encodeURIComponent(getToken());
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}token=${t}`;
}

async function apiGet(path) {
  const res = await fetch(apiUrl(path), {
    headers: { "X-Admin-Token": getToken() },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

function fmtTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString("zh-CN", { hour12: false }) + `.${String(d.getMilliseconds()).padStart(3, "0")}`;
}

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function detailText(detail) {
  if (!detail || typeof detail !== "object") return "";
  if (detail.title && detail.reason) {
    return `${detail.reason} → 「${detail.title}」 #${detail.index ?? "?"}`;
  }
  if (detail.title) return `「${detail.title}」`;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

function actionClass(action) {
  if (action === "trackChange") return "act-trackChange";
  return "";
}

function matchesFilter(action) {
  const f = filterAction?.value || "";
  if (!f) return true;
  if (f === "volume") return action === "volume" || action === "setVolume";
  return action === f || (f === "trackChange" && action === "trackChange");
}

function appendLogRow(row) {
  if (!row?.id || seenIds.has(row.id)) return;
  if (!matchesFilter(row.action)) return;
  seenIds.add(row.id);

  const tr = document.createElement("tr");
  const srcCls = row.source === "client" ? "src-client" : "src-server";

  tr.innerHTML = `
    <td>${fmtTime(row.ts)}</td>
    <td class="${srcCls}">${row.source || "-"}</td>
    <td>${row.roomId || "-"}</td>
    <td>${row.user || "-"}</td>
    <td class="${actionClass(row.action)}">${row.action}</td>
    <td class="detail-cell">${detailText(row.detail)}</td>
  `;
  logBody.appendChild(tr);
  if (row.ts > lastLogTs) lastLogTs = row.ts;

  if (autoScroll?.checked) {
    logWrap.scrollTop = logWrap.scrollHeight;
  }
}

async function pollLogs() {
  if (!connected || pausePoll?.checked) return;
  try {
    const data = await apiGet(`/api/admin/logs?since=${lastLogTs}&limit=120`);
    const logs = data.logs || [];
    if (logs.length) {
      logEmpty.hidden = true;
      logs.forEach(appendLogRow);
    } else if (!logBody.children.length) {
      logEmpty.hidden = false;
    }
    authStatus.textContent = `已连接 · 最近 ${logs.length} 条`;
    authStatus.className = "auth-status ok";
  } catch (e) {
    authStatus.textContent = `日志拉取失败: ${e.message}`;
    authStatus.className = "auth-status err";
  }
}

function renderStats(s) {
  if (!s) return;
  $("statCpu").textContent = `${s.cpu?.cores ?? "?"} 核 · 1m ${s.cpu?.load1 ?? "?"}`;
  $("statMem").textContent = `${s.memory?.usedMb ?? "?"} / ${s.memory?.totalMb ?? "?"} MB (${s.memory?.usedPct ?? "?"}%)`;
  $("statProc").textContent = `RSS ${s.memory?.processRssMb ?? "?"} MB · 堆 ${s.memory?.processHeapMb ?? "?"} MB`;
  $("statApp").textContent = `${s.app?.rooms ?? 0} 房 · ${s.app?.listeners ?? 0} 人 · 日志 ${s.app?.logCount ?? 0}`;
  const net = s.network || {};
  const rx = net.rxMbps != null ? `↓ ${net.rxMbps} Mbps` : "↓ —";
  const tx = net.txMbps != null ? `↑ ${net.txMbps} Mbps` : "↑ —";
  $("statNet").textContent = `${rx} · ${tx}`;
  $("statUp").textContent = `${fmtUptime(s.uptimeSec || 0)} · ${s.hostname || ""}`;
}

async function pollStats() {
  if (!connected || pausePoll?.checked) return;
  try {
    const s = await apiGet("/api/admin/stats");
    renderStats(s);
  } catch (_) {
    /* ignore */
  }
}

function startPolling() {
  stopPolling();
  logTimer = setInterval(pollLogs, POLL_LOG_MS);
  statsTimer = setInterval(pollStats, POLL_STATS_MS);
  pollLogs();
  pollStats();
}

function stopPolling() {
  if (logTimer) clearInterval(logTimer);
  if (statsTimer) clearInterval(statsTimer);
  logTimer = null;
  statsTimer = null;
}

async function connect() {
  const token = getToken();
  if (!token) {
    authStatus.textContent = "请填写管理员令牌";
    authStatus.className = "auth-status err";
    return;
  }
  try {
    await apiGet("/api/admin/status");
    sessionStorage.setItem(TOKEN_KEY, token);
    connected = true;
    statsPanel.hidden = false;
    logToolbar.hidden = false;
    logWrap.hidden = false;
    clearLogsBtn.disabled = false;
    authStatus.textContent = "连接成功，正在拉取…";
    authStatus.className = "auth-status ok";
    startPolling();
  } catch (e) {
    connected = false;
    authStatus.textContent = e.message || "连接失败";
    authStatus.className = "auth-status err";
    stopPolling();
  }
}

function clearView() {
  logBody.innerHTML = "";
  seenIds.clear();
  lastLogTs = 0;
  logEmpty.hidden = false;
}

connectBtn?.addEventListener("click", connect);
clearLogsBtn?.addEventListener("click", clearView);
filterAction?.addEventListener("change", () => {
  clearView();
  if (connected) pollLogs();
});

adminToken?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") connect();
});

try {
  const saved = sessionStorage.getItem(TOKEN_KEY);
  if (saved && adminToken) {
    adminToken.value = saved;
    connect();
  }
} catch (_) {
  /* ignore */
}
