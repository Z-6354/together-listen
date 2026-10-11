const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const netease = require("../../netease-proxy");

describe("netease-proxy parseSongId", () => {
  it("纯数字 id", () => {
    assert.equal(netease.parseSongId("186016"), 186016);
  });

  it("URL 查询参数", () => {
    assert.equal(
      netease.parseSongId("https://music.163.com/song?id=186016"),
      186016,
    );
  });

  it("song 路径", () => {
    assert.equal(netease.parseSongId("/song/186016"), 186016);
  });

  it("无效输入", () => {
    assert.equal(netease.parseSongId(""), null);
    assert.equal(netease.parseSongId("not-a-song"), null);
  });

  it("trackFromFormatted 生成同源 stream 路径", () => {
    const t = netease.trackFromFormatted({
      id: 42,
      title: "测试 — 歌手",
      name: "测试",
    });
    assert.equal(t.neteaseId, 42);
    assert.equal(t.url, "/api/netease/stream/42");
    assert.equal(t.source, "netease");
  });
});
