# Together Listen V2 部署规划

## 1. 部署目标

针对 2H2G 小型服务器环境，提供低资源、稳定、易维护的部署方案。

## 2. 目标环境

服务器：

- CPU：2核心；
- 内存：2GB；
- Linux 系统。

## 3. 部署架构

```
Nginx
  |
Node.js Application
  |
Socket.IO Service
  |
SQLite Database
```

## 4. 运行方式

推荐：

- PM2 管理 Node.js 进程；
- Nginx 提供 HTTPS 和反向代理；
- SQLite 保存业务数据。

## 5. 部署流程

1. 拉取代码；
2. 安装依赖；
3. 构建 TypeScript 项目；
4. 初始化数据库；
5. 启动服务；
6. 配置 Nginx；
7. 验证 WebSocket 连接。

## 6. 运维要求

包含：

- 日志管理；
- 自动重启；
- 数据备份；
- 版本回滚。

## 7. 后续扩展

当用户规模增加时，再考虑：

- Redis；
- PostgreSQL；
- 多节点部署。
