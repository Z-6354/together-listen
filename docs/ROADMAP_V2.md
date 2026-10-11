# together-listen V2 开发路线图

## Milestone 0：架构准备

目标：建立升级基础，不影响当前版本。

任务：

- 完成架构文档
- 创建开发分支
- 确认模块边界
- 建立测试基础

---

## Milestone 1：工程化升级

目标：提高可维护性。

任务：

- 引入 TypeScript
- 配置 tsconfig
- 配置 ESLint
- 配置格式化工具
- 调整项目目录

验收：

- 项目可以正常启动
- 功能保持一致

---

## Milestone 2：核心模块拆分

目标：拆解 server.js。

模块：

- Room
- Playback
- User
- Music Provider
- Socket Handler

目标：

server.ts 只负责启动和组合模块。

---

## Milestone 3：数据层升级

目标：统一数据管理。

任务：

- 接入 SQLite
- 设计数据库初始化
- 迁移房间数据
- 迁移播放历史

---

## Milestone 4：同步能力优化

目标：提升多人同步体验。

任务：

- 优化时间校准
- 增加心跳检测
- 增强断线恢复
- 优化状态广播

---

## Milestone 5：用户体验升级

任务：

- 手机端优化
- 房间二维码
- 在线成员显示
- 播放状态展示
- 简单互动功能

---

## Milestone 6：未来扩展

根据用户规模决定是否增加：

- Redis
- PostgreSQL
- 用户系统
- 权限系统
- 多节点部署

---

## 开发原则

每个阶段：

- 保持可运行
- 小步提交
- 可回滚
- 避免一次性重写
