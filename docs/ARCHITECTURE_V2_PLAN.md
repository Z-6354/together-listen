# Together Listen v2 架构升级详细规划

## 1. 项目定位

目标：将 Together Listen 从当前可运行的同步听歌项目，升级为稳定、易维护、可持续扩展的小型实时应用。

实际运行环境：

- 服务器：2H2G
- 用户规模：单房间 2~3 人
- 未来规模：2~3 个房间组，总在线约 10 人以内

设计原则：

- 稳定优先
- 低资源占用
- 单机易维护
- 保留快速迭代能力
- 避免过度工程化

---

## 2. 技术路线决策

### 保留

- Node.js
- Express
- Socket.IO
- PM2
- Nginx

### 升级

- JavaScript -> TypeScript
- 文件存储 -> SQLite
- 单文件业务 -> 模块化架构

### 暂不采用

- Go/Rust 重写
- 微服务
- Kubernetes
- Redis 集群
- PostgreSQL

原因：当前用户规模不足以支持这些复杂度。

---

## 3. V2目标架构

```
Nginx
 |
Node.js Application
 |
+----------------+
| HTTP API       |
| Socket Gateway |
+----------------+
 |
Modules
 |
+----------------+
| Room           |
| Playback       |
| User           |
| Music Provider |
| Playlist       |
+----------------+
 |
SQLite
```

---

## 4. 目录规划

目标：

```
src/

├── server.ts
├── app.ts
│
├── modules/
│   ├── room/
│   ├── playback/
│   ├── user/
│   ├── music/
│   └── playlist/
│
├── websocket/
│
├── database/
│
├── config/
│
└── utils/
```

---

## 5. 核心模块规划

## Room 房间模块

职责：

- 创建房间
- 加入/离开
- 成员管理
- 房间状态

不负责：

- 音频同步
- 数据库操作

---

## Playback 播放模块

职责：

- 播放状态
- 暂停
- 切歌
- 进度同步
- 时间校准

目标：

2~3 人场景下保持稳定同步。

---

## Music Provider 音乐模块

当前：

网易云代理

升级：

```
MusicProvider
 |
 +-- NetEase
 +-- DirectURL
```

方便未来增加其他来源。

---

## 6. 数据层规划

采用 SQLite。

主要数据：

### users

保存用户基础信息。

### rooms

保存房间配置。

### playlists

保存房间歌单。

### tracks

保存歌曲信息。

### history

保存播放记录。

实时播放状态继续保存在内存中。

---

## 7. 迁移阶段

## Phase 0：准备阶段

目标：不影响当前服务。

任务：

- 创建 v2 分支
- 添加架构文档
- 保留旧版本可运行

---

## Phase 1：TypeScript迁移

任务：

- 添加 tsconfig
- 逐步迁移核心模块
- 保持功能一致

验收：

- 原功能全部可用
- 测试通过

---

## Phase 2：模块拆分

目标：

server.js/server.ts 不再承载全部业务。

拆分：

- RoomService
- PlaybackService
- UserService
- MusicService
- SocketHandler

---

## Phase 3：SQLite接入

替换：

- JSON存储
- 分散store文件

增加：

- 数据模型
- 数据访问层

---

## Phase 4：同步优化

增加：

- 心跳检测
- 延迟估算
- 播放状态校准
- 异常恢复

---

## Phase 5：体验升级

增加：

- 房间二维码
- 手机端优化
- 在线成员展示
- 简单互动功能

---

## 8. 资源目标

2H2G服务器目标：

- Node运行内存 < 300MB
- 单机稳定运行
- 支持多个小型房间

---

## 9. 未来扩展条件

当出现以下情况时，再考虑升级：

- 在线人数超过50
- 多服务器部署
- 多人协作开发
- 复杂账号体系

届时考虑：

- Redis
- PostgreSQL
- NestJS
- 分布式架构

---

## 10. 总结

Together Listen v2 不进行技术重写，而进行工程化升级。

核心方向：

稳定的小型实时系统，而不是追求大型互联网架构。
