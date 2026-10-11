const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const opsLog = require("../../ops-log");

describe("ops-log", () => {
  it("appendOp 与 getLogs", () => {
    const before = opsLog.getLogs({ limit: 500 }).length;
    opsLog.appendOp({
      source: "server",
      roomId: "test",
      user: "u",
      action: "trackChange",
      detail: { title: "Song", reason: "next" },
    });
    const logs = opsLog.getLogs({ limit: 10 });
    assert.ok(logs.length >= before);
    const last = logs[logs.length - 1];
    assert.equal(last.action, "trackChange");
    assert.equal(last.detail.title, "Song");
  });

  it("getServerStats 返回基础字段", () => {
    const s = opsLog.getServerStats({
      countRooms: () => 2,
      countListeners: () => 3,
    });
    assert.ok(s.cpu.cores >= 1);
    assert.ok(s.memory.totalMb > 0);
    assert.equal(s.app.rooms, 2);
    assert.equal(s.app.listeners, 3);
  });

  it("adminTokenValid", () => {
    const prev = process.env.ADMIN_TOKEN;
    process.env.ADMIN_TOKEN = "secret";
    assert.equal(opsLog.adminTokenValid("secret"), true);
    assert.equal(opsLog.adminTokenValid("wrong"), false);
    process.env.ADMIN_TOKEN = prev;
  });
});
