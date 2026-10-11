# Together Listen V2 Socket Protocol 设计

## 1. 目标

设计稳定的实时通信协议，用于：

- 房间管理
- 播放同步
- 队列控制
- 用户状态

保持 Socket.IO 实现。

---

# 2. 通信模型

```text
Client
  |
Socket.IO
  |
Socket Gateway
  |
Domain Service
  |
Room State
```

服务器作为最终状态来源。

---

# 3. 房间事件

## room:create

创建房间。

请求：

```json
{
 "name":"test"
}
```

响应：

```json
{
 "roomId":"xxxx"
}
```

---

## room:join

加入房间。

---

## room:leave

离开房间。

---

# 4. 播放事件

## playback:play

开始播放。

服务器生成新的 anchor：

```json
{
 "trackId":"xxx",
 "position":0,
 "serverTime":123456
}
```

---

## playback:pause

暂停。

保存当前位置。

---

## playback:seek

跳转。

---

## playback:next

下一首。

---

# 5. 同步机制

服务器维护：

```text
anchorPosition
anchorTimestamp
isPlaying
```

客户端计算：

```text
currentPosition =
anchorPosition +
(now - anchorTimestamp)
```

---

# 6. 心跳校准

客户端周期发送：

```text
heartbeat
```

服务器返回：

```text
serverTime
```

用于修正时钟差。

---

# 7. 断线恢复

客户端重新连接：

1. 发送 roomId
2. 请求 room snapshot
3. 恢复播放状态
4. 重新加入同步

---

# 8. 错误规范

统一格式：

```json
{
 "code":"ROOM_NOT_FOUND",
 "message":"room does not exist"
}
```

避免前后端处理混乱。
