# Together Listen V2 Migration Plan

## 目标

在保持现有服务可运行的前提下，将 together-listen 从单文件实时应用逐步升级为模块化、可维护的小型实时服务。

目标环境：

- 服务器：2H2G
- 单房间：2-3人
- 总规模：多个小房间，约10人以内
- 优先级：稳定性 > 简洁性 > 扩展性 > 极限性能

---

# 迁移原则

## 不推翻重写

采用渐进式迁移：

旧架构继续运行，新模块逐步接管。

避免一次性重构导致：

- 功能丢失
- 调试困难
- 无法回滚

---

# Phase 0 基础准备

目标：建立迁移基础。

任务：

- 删除测试文件
- 建立架构文档
- 增加版本标记
- 建立迁移分支

产物：

```
architecture-v2
```

---

# Phase 1 TypeScript 迁移

目标：提高长期维护能力。

当前：

```
JavaScript
server.js
```

目标：

```
src/
 *.ts
```

原则：

- 不改变业务逻辑
- 不改变接口协议
- 只改善代码结构

---

# Phase 2 核心模块拆分

当前：

```
server.js
```

拆分：

```
src/modules/

room/
playback/
user/
music/
playlist/
```

目标：

server.ts 只负责启动和组装。

---

# Phase 3 数据层升级

当前：

- 内存状态
- 文件存储

目标：

SQLite 数据层。

保存：

- 用户信息
- 房间配置
- 歌曲记录
- 播放历史

实时状态继续使用内存。

---

# Phase 4 实时同步优化

重点优化：

## 时间同步

增加：

- heartbeat
- latency estimation
- state correction

目标：

2-3人房间同步误差控制在200ms以内。

---

# Phase 5 前端整理

保持当前功能。

逐步优化：

- TypeScript
- 组件拆分
- 移动端适配
- 房间状态展示

---

# Phase 6 部署优化

保持轻量部署：

```
Nginx
 |
PM2
 |
Node.js
```

可选：

- Docker
- 自动部署

暂不引入：

- Kubernetes
- 微服务
- Redis集群

---

# 回滚策略

每个阶段独立提交：

```
feature/v2-phase-x
```

要求：

- 可单独测试
- 可独立回退
- 不影响生产版本

---

# 完成标准

V2完成后：

- 代码结构清晰
- server入口轻量化
- 数据可持久化
- 同步稳定
- 2H2G服务器运行无压力
- 后续功能可持续增加
