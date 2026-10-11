/**
 * 在临时 JSON 文件上加载 store 模块，避免污染 data/
 */
const fs = require("fs");
const os = require("os");
const path = require("path");

const ROOT = path.join(__dirname, "../..");

function clearStoreCache() {
  delete require.cache[require.resolve(path.join(ROOT, "room-extras-store.js"))];
  delete require.cache[require.resolve(path.join(ROOT, "pair-listen-store.js"))];
}

/**
 * @param {(ctx: { roomExtras: object, pairListen: object, dir: string }) => void} run
 */
function withTempStores(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "together-listen-test-"));
  const roomFile = path.join(dir, "room-extras.json");
  const pairFile = path.join(dir, "pair-listen.json");
  const prevRoom = process.env.ROOM_EXTRAS_STORE_FILE;
  const prevPair = process.env.PAIR_LISTEN_STORE_FILE;

  process.env.ROOM_EXTRAS_STORE_FILE = roomFile;
  process.env.PAIR_LISTEN_STORE_FILE = pairFile;
  clearStoreCache();

  try {
    const roomExtras = require(path.join(ROOT, "room-extras-store.js"));
    const pairListen = require(path.join(ROOT, "pair-listen-store.js"));
    run({ roomExtras, pairListen, dir, roomFile, pairFile });
  } finally {
    if (prevRoom === undefined) delete process.env.ROOM_EXTRAS_STORE_FILE;
    else process.env.ROOM_EXTRAS_STORE_FILE = prevRoom;
    if (prevPair === undefined) delete process.env.PAIR_LISTEN_STORE_FILE;
    else process.env.PAIR_LISTEN_STORE_FILE = prevPair;
    clearStoreCache();
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

module.exports = { withTempStores, clearStoreCache, ROOT };
