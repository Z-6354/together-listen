# Together Listen V2 数据模型设计

## 1. 设计目标

针对 2H2G 小型服务器环境设计，优先保证：

- 简单可靠
- 低资源占用
- 易维护
- 支持多个小型同步房间

初期采用 SQLite，避免引入复杂数据库服务。

---

# 2. 数据分层

## 实时状态（内存）

用于 Socket.IO 实时同步：

- 当前播放状态
- 在线成员
- 临时队列状态
- 心跳信息

## 持久数据（SQLite）

用于保存：

- 用户信息
- 房间配置
- 歌曲记录
- 播放历史

---

# 3. 核心表设计

## users

用户基础信息。

字段：

- id
- nickname
- avatar
- created_at
- updated_at

---

## rooms

房间信息。

字段：

- id
- name
- owner_id
- password_hash（未来）
- settings_json
- created_at

---

## room_members

房间成员关系。

字段：

- id
- room_id
- user_id
- role
- joined_at

角色：

- owner
- member

---

## tracks

歌曲信息。

字段：

- id
- source
- source_id
- title
- artist
- duration
- url
- metadata_json

支持未来扩展多个音乐源。

---

## playlists

房间播放列表。

字段：

- id
- room_id
- track_id
- position
- added_by
- created_at

---

## play_history

播放历史。

字段：

- id
- room_id
- track_id
- started_at
- ended_at

---

# 4. 实时状态模型

RoomRuntime：

```text
roomId
members[]
queue[]
playbackState
lastHeartbeat
```

PlaybackState：

```text
trackId
isPlaying
anchorPosition
anchorTimestamp
```

---

# 5. 数据迁移策略

升级过程中：

1. 保留旧存储读取能力
2. 新模块优先写入 SQLite
3. 完成迁移后移除旧存储

避免一次性切换导致服务中断。
