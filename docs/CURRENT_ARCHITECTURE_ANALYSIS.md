# Together Listen 当前架构分析

## 1. 项目定位

Together Listen 当前是一个轻量实时同步听歌服务，目标场景：

- 小型服务器部署
- 小房间同步听歌
- 2-3 人同听为主要场景
- 后续扩展多个小房间

当前技术路线：

- Node.js
- Express
- Socket.IO
- 浏览器端播放器

---

## 2. 当前整体结构

```
Client Browser
      |
      | Socket.IO
      |
server.js
      |
-------------------------
|       |       |       |
Room   Play   User   Music
Logic  Sync   State  Source
```

---

## 3. 当前核心职责

### server.js

当前承担：

- HTTP Server
- Socket.IO 初始化
- 房间生命周期
- 用户连接管理
- 播放控制
- 状态广播
- 管理接口

问题：职责过多。

---

## 4. 当前优势

### 4.1 同步模型

采用服务端时间锚点：

- anchorWallMs
- anchorPosSec
- isPlaying

客户端根据时间计算播放位置。

该方案适合实时同步播放。

### 4.2 Socket.IO

适合当前规模：

- 延迟低
- 开发简单
- 支持断线恢复

### 4.3 已有数据抽象

当前已有：

- room 数据存储
- 同听统计
- 网易云代理
- 操作日志

---

## 5. 当前主要问题

## 5.1 单文件压力

核心逻辑集中于 server.js。

未来增加：

- 用户系统
- 权限
- 收藏
- 多音乐源

会导致维护困难。

---

## 5.2 数据层不足

当前主要依赖：

- 内存状态
- 文件存储

适合当前规模，但缺少统一数据模型。

---

## 5.3 模块边界不清晰

业务逻辑、通信层、存储层耦合。

升级目标：

```
Socket Layer
      |
Service Layer
      |
Repository Layer
      |
Storage
```

---

## 6. 不建议方向

当前规模不建议：

- 微服务
- Kubernetes
- Go/Rust 重写
- 复杂云架构

原因：增加维护成本，但不能解决主要问题。

---

## 7. V2 改造目标

保持：

- Node.js
- Socket.IO
- 小型部署模式

优化：

- TypeScript
- 模块化结构
- SQLite 数据层
- 播放同步优化
- 清晰业务边界

---

## 8. 迁移原则

1. 保证旧版本可运行
2. 小步骤迁移
3. 每个阶段可回滚
4. 功能优先保持一致
5. 架构升级不追求复杂化
