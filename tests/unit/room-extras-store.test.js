const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { withTempStores, clearStoreCache, ROOT } = require("../helpers/temp-stores");

describe("room-extras-store", () => {
  it("loadRoomExtras 重启后 isPlaying 恒为 false", () => {
    withTempStores(({ roomExtras, roomFile }) => {
      const room = {
        queue: [{ url: "/a.mp3", title: "A", source: "url" }],
        currentIndex: 0,
        isPlaying: true,
        anchorPosSec: 12,
        anchorWallMs: Date.now(),
        playMode: "loop",
        roomPlaylists: [],
        roomFavorites: [],
        recentPlays: [],
        playStats: { counts: {}, tracks: {} },
      };
      roomExtras.persistRoomExtras("r1", room);
      roomExtras.flushStore();
      assert.ok(fs.existsSync(roomFile));

      withTempStores(({ roomExtras: reloaded }) => {
        const extras = reloaded.loadRoomExtras("r1");
        assert.equal(extras.isPlaying, false);
        assert.equal(extras.queue.length, 1);
        assert.equal(extras.currentIndex, 0);
        assert.equal(extras.anchorPosSec, 12);
      });
    });
  });

  it("无效 currentIndex 有队列时默认为 0", () => {
    withTempStores(({ roomFile }) => {
      fs.mkdirSync(path.dirname(roomFile), { recursive: true });
      fs.writeFileSync(
        roomFile,
        JSON.stringify({
          rooms: {
            bad: {
              queue: [{ url: "/x", title: "X", source: "url" }],
              currentIndex: 99,
              isPlaying: true,
              anchorPosSec: 0,
            },
          },
        }),
        "utf8",
      );
      clearStoreCache();
      const store = require(path.join(ROOT, "room-extras-store.js"));
      const extras = store.loadRoomExtras("bad");
      assert.equal(extras.currentIndex, 0);
      assert.equal(extras.isPlaying, false);
    });
  });
});
