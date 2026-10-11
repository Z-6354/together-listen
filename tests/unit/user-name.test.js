const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { normalizeUserName, pairListenNameKey } = require("../../lib/user-name");

describe("user-name", () => {
  it("normalizeUserName 去空白并截断", () => {
    assert.equal(normalizeUserName("  小明  "), "小明");
    assert.equal(normalizeUserName("a".repeat(30)).length, 24);
    assert.equal(normalizeUserName("\n\t"), "");
  });

  it("pairListenNameKey 无序对称", () => {
    assert.equal(pairListenNameKey("乙", "甲"), "甲|乙");
    assert.equal(pairListenNameKey("甲", "乙"), "甲|乙");
    assert.equal(pairListenNameKey("甲", "甲"), null);
    assert.equal(pairListenNameKey("", "乙"), null);
  });
});
