# Uran 文档

Uran 是一个基于 Claude Agent SDK 的会话管理守护进程，通过 Socket.IO 与前端通信。

## 文档索引

### 概览
- [架构规范](rules/backend/arch.md) — 系统整体架构
- [变更日志](../CHANGELOG.md) — 版本变更记录

### Socket.IO API
- [会话事件](api/session-events.md) — 事件类型说明
- [通信协议](api/socket-protocol.md) — 请求/响应格式

### 规范
- [共享类型](rules/shared/types.md) — 跨包类型定义
- [Agent 实现](rules/backend/agents.md) — Agent 接口与实现
- [Session 管理](rules/backend/session.md) — 会话生命周期

### 指南
- [快速入门](guides/getting-started.md) — 环境准备与启动
- [部署指南](guides/deployment.md) — 生产环境部署
- [Web 控制台](guides/web-app.md) — 前端使用说明

---

## 项目结构

```
openz/
├── packages/
│   ├── cli/          # 守护进程与 Agent 实现
│   ├── shared/       # 共享类型定义
│   └── web/          # React 前端
└── docs/             # 项目文档
```
