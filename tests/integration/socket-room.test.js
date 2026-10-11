/**
 * Socket.io 集成测试：启动真实 server 子进程，验证入房与队列同步
 */
const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { io } = require("socket.io-client");
const { ROOT } = require("../helpers/temp-stores");

const TEST_PORT = 38499;

function waitForServer(port, timeoutMs = 15000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/`);
        if (res.ok) return resolve();
      } catch (_) {
        /* retry */
      }
      if (Date.now() - start > timeoutMs) {
        reject(new Error(`server on :${port} not ready`));
        return;
      }
      setTimeout(tick, 150);
    };
    tick();
  });
}

function connectClient(port) {
  return new Promise((resolve, reject) => {
    const socket = io(`http://127.0.0.1:${port}`, {
      transports: ["websocket"],
      forceNew: true,
    });
    const t = setTimeout(() => reject(new Error("connect timeout")), 8000);
    socket.on("connect", () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.on("connect_error", (e) => {
      clearTimeout(t);
      reject(e);
    });
  });
}

function once(socket, event) {
  return new Promise((resolve) => {
    socket.once(event, resolve);
  });
}

function joinRoom(socket, roomId, userName) {
  socket.emit("join", {
    roomId,
    userName,
    clientId: `test-${userName}-${Date.now()}`,
  });
  return once(socket, "joined");
}

describe("socket-room integration", { timeout: 30000 }, () => {
  /** @type {import('child_process').ChildProcess | null} */
  let proc = null;
  let tmpDir = "";

  before(async () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "tl-socket-int-"));
    const env = {
      ...process.env,
      PORT: String(TEST_PORT),
      HOST: "127.0.0.1",
      ROOM_EXTRAS_STORE_FILE: path.join(tmpDir, "room-extras.json"),
      PAIR_LISTEN_STORE_FILE: path.join(tmpDir, "pair-listen.json"),
    };
    proc = spawn("node", ["server.js"], {
      cwd: ROOT,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    proc.stderr?.on("data", (d) => {
      process.stderr.write(`[server] ${d}`);
    });
    await waitForServer(TEST_PORT);
  });

  after(() => {
    if (proc && !proc.killed) proc.kill("SIGTERM");
    if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("双人入房、加链、state 同步", async () => {
    const a = await connectClient(TEST_PORT);
    const b = await connectClient(TEST_PORT);
    const roomId = `test-${Date.now()}`;

    await joinRoom(a, roomId, "测试甲");
    await joinRoom(b, roomId, "测试乙");

    const statePromise = once(b, "state");
    a.emit("addTrack", {
      url: "https://example.com/demo.mp3",
      title: "演示曲目",
    });
    const st = await statePromise;

    assert.equal(st.roomId, roomId);
    assert.equal(st.queue.length, 1);
    assert.equal(st.queue[0].title, "演示曲目");
    assert.ok(st.listenerCount >= 2);

    a.disconnect();
    b.disconnect();
  });

  it("clearQueue 后队列为空", async () => {
    const sock = await connectClient(TEST_PORT);
    const roomId = `clear-${Date.now()}`;
    await joinRoom(sock, roomId, "清队列用户");

    sock.emit("addTrack", { url: "https://example.com/a.mp3", title: "A" });
    await once(sock, "state");

    const emptyPromise = once(sock, "state");
    sock.emit("clearQueue");
    const st = await emptyPromise;
    assert.equal(st.queue.length, 0);
    assert.equal(st.currentIndex, -1);
    assert.equal(st.isPlaying, false);

    sock.disconnect();
  });
});
