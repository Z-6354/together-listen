# 一起听歌（Together Listen）

极简「同步听歌房」：打开网页进入同一房间，共享**播放队列**和**播放进度**，任何人都可以播放/暂停/拖动进度/上一首/下一首。

## 运行

### 前台（当前终端占用）

```bash
cd together-listen
npm install
npm start
```

### 进程常驻（推荐）：PM2

依赖已写在 `devDependencies`，用本地 PM2 启停即可，**关闭 SSH 后服务仍在**。

```bash
cd together-listen
npm install
npm run pm2:start      # 后台进程启动
npm run pm2:logs       # 看日志
npm run pm2:restart    # 重启
npm run pm2:stop       # 停止
```

也可用全局 PM2：`npm i -g pm2`，然后在项目目录执行 `pm2 start ecosystem.config.cjs`。

浏览器打开终端里打印的地址（默认 `http://127.0.0.1:3847`）。线上主站：**https://wannian.fun**（见页脚与 `PUBLIC_SITE_ORIGIN`）。可分享 `https://wannian.fun/?room=房间名` 快速进房。

环境变量：

- `PORT`：端口（默认 3847）。
- `PUBLIC_SITE_ORIGIN`：主站 URL（默认 `https://wannian.fun`），启动日志会打印。
- `SOCKET_CORS_RELAXED`：默认 `1` 放行所有来源（便于 IP 调试）；设为 `0` 时仅允许 `wannian.fun`、localhost、`EXTRA_ORIGINS`。
- `EXTRA_ORIGINS`：逗号分隔的额外允许来源（完整 `https://host` 或裸域名）。

Nginx 反代示例：`deploy/nginx-wannian.fun.example.conf`。

### 系统服务：systemd

示例单元文件见 `deploy/together-listen.service`：把其中 `User`、`WorkingDirectory`、`ExecStart`（若 `node` 不在 `/usr/bin/node` 用 `which node`）改成你的环境后安装到 `/etc/systemd/system/` 并 `systemctl enable --now together-listen`。

## 使用说明

1. **房间**：输入任意房间 ID（或点「随机房间」），再点「进入房间」。
2. **加歌**：填写**浏览器能直接播放的音频直链**（如 `.mp3`、部分 CDN 直链）。标题可空。
3. **一起控制**：房间内所有人操作都会同步到其他人（切歌、暂停、进度条）。

## 局限与注意

- **版权**：只传你有权分发的音频地址；本项目不存储、不转码音乐文件。
- **跨域**：若音频服务器不允许浏览器跨域播放，会加载失败，需换可 CORS 的直链或使用自建反代（自行承担合规责任）。
- **无账号**：知道房间名的人都能控制队列，适合朋友小圈；公网部署请加鉴权或反向代理限制。

## App / 原生客户端对接

Socket.IO 与 HTTP 接口说明见 **[docs/API-APP.md](docs/API-APP.md)**（含房间 `state`、进房提醒 `listenerJoined`、网易云代理等）。

## 可扩展方向

- 登录与房主权限（只有房主可删队列）
- Spotify / Apple Music 等官方 API（需各自开发者协议）
- 聊天、反应表情、歌词滚动（LRC）
- Redis 多实例横向扩展（当前内存单进程）
