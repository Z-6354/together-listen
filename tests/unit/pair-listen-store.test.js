const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const { withTempStores } = require("../helpers/temp-stores");

describe("pair-listen-store", () => {
  it("persist 与 loadRoomTotals 往返", () => {
    withTempStores(({ pairListen, pairFile }) => {
      const map = new Map([["甲|乙", 60000]]);
      pairListen.persistRoomTotals("room-a", map);
      pairListen.flushStore();
      assert.ok(fs.existsSync(pairFile));

      withTempStores(({ pairListen: reloaded }) => {
        const loaded = reloaded.loadRoomTotals("room-a");
        assert.equal(loaded.get("甲|乙"), 60000);
      });
    });
  });

  it("flushStore 无脏数据时不写文件", () => {
    withTempStores(({ pairListen, pairFile }) => {
      pairListen.flushStore();
      assert.equal(fs.existsSync(pairFile), false);
    });
  });
});
