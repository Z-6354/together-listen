#!/usr/bin/env node
/**
 * 一键运行全部测试（不依赖 shell 通配符）
 * 用法: node tests/run-all.js
 */
const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const files = [
  "tests/unit/room-logic.test.js",
  "tests/unit/user-name.test.js",
  "tests/unit/room-extras-store.test.js",
  "tests/unit/pair-listen-store.test.js",
  "tests/unit/netease-parse.test.js",
  "tests/integration/socket-room.test.js",
].map((f) => path.join(ROOT, f));

console.log("Together Listen — running tests\n");

const r = spawnSync(process.execPath, ["--test", ...files], {
  cwd: ROOT,
  stdio: "inherit",
  env: process.env,
});

process.exit(r.status === null ? 1 : r.status);
