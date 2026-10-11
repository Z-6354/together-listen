/**
 * 房间播放队列逻辑单元测试
 */
const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const rl = require("../../lib/room-logic");

const track = (id, title = `曲${id}`) => ({
  url: `/api/netease/stream/${id}`,
  title,
  neteaseId: id,
  source: "netease",
});

describe("room-logic", () => {
  it("trackMatchKey 区分网易 id 与 url", () => {
    assert.equal(rl.trackMatchKey({ neteaseId: 42 }), "n:42");
    assert.equal(rl.trackMatchKey({ url: "https://x/a.mp3" }), "u:https://x/a.mp3");
  });

  it("pushTrack 受 MAX_QUEUE_SIZE 限制", () => {
    const room = rl.makeTestRoom();
    for (let i = 0; i < rl.MAX_QUEUE_SIZE; i += 1) {
      assert.equal(rl.pushTrack(room, track(i)), true);
    }
    assert.equal(rl.pushTrack(room, track(999)), false);
    assert.equal(room.queue.length, rl.MAX_QUEUE_SIZE);
  });

  it("playTrackNow 去重：已在队列则切到该曲", () => {
    const room = rl.makeTestRoom({ queue: [track(1), track(2)], currentIndex: 0 });
    assert.equal(rl.playTrackNow(room, track(2)), true);
    assert.equal(room.currentIndex, 1);
    assert.equal(room.isPlaying, true);
    assert.equal(room.queue.length, 2);
  });

  it("filterTracksNotInQueue 过滤重复", () => {
    const room = rl.makeTestRoom({ queue: [track(1)] });
    const rest = rl.filterTracksNotInQueue(room, [track(1), track(2)]);
    assert.equal(rest.length, 1);
    assert.equal(rest[0].neteaseId, 2);
  });

  it("goNext 顺序模式循环", () => {
    const room = rl.makeTestRoom({
      queue: [track(1), track(2), track(3)],
      currentIndex: 2,
      playMode: "loop",
      isPlaying: true,
    });
    assert.equal(rl.goNext(room), true);
    assert.equal(room.currentIndex, 0);
  });

  it("goPrev 回退", () => {
    const room = rl.makeTestRoom({
      queue: [track(1), track(2)],
      currentIndex: 0,
      isPlaying: true,
    });
    assert.equal(rl.goPrev(room), true);
    assert.equal(room.currentIndex, 1);
  });

  it("removeQueueIndices 删除当前曲后切到同位置下一首", () => {
    const room = rl.makeTestRoom({
      queue: [track(1), track(2), track(3)],
      currentIndex: 1,
      isPlaying: true,
    });
    const n = rl.removeQueueIndices(room, [1]);
    assert.equal(n, 1);
    assert.equal(room.currentIndex, 1);
    assert.equal(room.queue[room.currentIndex].neteaseId, 3);
    assert.equal(room.isPlaying, true);
  });

  it("removeQueueIndices 删光队列则暂停", () => {
    const room = rl.makeTestRoom({
      queue: [track(1)],
      currentIndex: 0,
      isPlaying: true,
    });
    rl.removeQueueIndices(room, [0]);
    assert.equal(room.queue.length, 0);
    assert.equal(room.currentIndex, -1);
    assert.equal(room.isPlaying, false);
  });

  it("stabilizeRoomPlayback 越界 index 校正为 0 并暂停", () => {
    const room = rl.makeTestRoom({
      queue: [track(1), track(2)],
      currentIndex: 99,
      isPlaying: true,
    });
    rl.stabilizeRoomPlayback(room);
    assert.equal(room.currentIndex, 0);
    assert.equal(room.isPlaying, false);
  });

  it("logicalPositionSec 播放中随时间推进", () => {
    const t0 = 1_000_000;
    const room = rl.makeTestRoom({
      isPlaying: true,
      anchorPosSec: 10,
      anchorWallMs: t0,
    });
    assert.equal(rl.logicalPositionSec(room, t0 + 5000), 15);
    room.isPlaying = false;
    assert.equal(rl.logicalPositionSec(room, t0 + 99999), 10);
  });

  it("freezePlayback 冻结在播进度", () => {
    const t0 = 2_000_000;
    const room = rl.makeTestRoom({
      isPlaying: true,
      anchorPosSec: 0,
      anchorWallMs: t0,
    });
    assert.equal(rl.freezePlayback(room, t0 + 3000), true);
    assert.equal(room.isPlaying, false);
    assert.equal(room.anchorPosSec, 3);
    assert.equal(room.anchorWallMs, t0 + 3000);
    assert.equal(rl.freezePlayback(room, t0 + 5000), false);
  });

  it("addRoomFavorite 记录用户并可取消", () => {
    const room = rl.makeTestRoom({ roomFavorites: [] });
    assert.equal(rl.addRoomFavorite(room, track(7), "甲"), "added");
    assert.equal(rl.addRoomFavorite(room, track(7), "甲"), "duplicate");
    assert.equal(rl.addRoomFavorite(room, track(7), "乙"), "added_user");
    assert.deepEqual(room.roomFavorites[0].likedBy, ["甲", "乙"]);
    assert.equal(rl.removeRoomFavoriteLike(room, 0, "甲"), true);
    assert.deepEqual(room.roomFavorites[0].likedBy, ["乙"]);
    assert.equal(rl.removeRoomFavoriteLike(room, 0, "乙"), true);
    assert.equal(room.roomFavorites.length, 0);
  });

  it("recordRoomPlay 累计统计", () => {
    const room = rl.makeTestRoom();
    rl.recordRoomPlay(room, track(5, "测试"));
    assert.equal(room.playStats.counts["n:5"], 1);
    assert.equal(room.recentPlays[0].title, "测试");
  });
});
