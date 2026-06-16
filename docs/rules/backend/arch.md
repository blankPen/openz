# 架构规范

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    Web Console                       │
│               (React, packages/web)                  │
│                      : socket.io                      │
└──────────────────────┬───────────────────────────────┘
                       │ ws
                       ▼
┌─────────────────────────────────────────────────────┐
│                   Daemon (CLI)                       │
│              packages/cli/src/daemon/                 │
│                                                      │
│  ┌──────────────┐     ┌──────────────────────────┐  │
│  │ SocketIOServer │────► SessionManager            │  │
│  │  (server.ts)  │     │  (session.ts)            │  │
│  └──────────────┘     └─────────────┬──────────────┘  │
│                                    │                  │
│                                    ▼                  │
│                           ┌──────────────────┐        │
│                           │   ClaudeAgent    │        │
│                           │ (agents/claude)  │        │
│                           └────────┬─────────┘        │
│                                    │                  │
│                                    ▼                  │
│                           ┌──────────────────┐        │
│                           │ @anthropic-ai/   │        │
│                           │ claude-agent-sdk │        │
│                           └──────────────────┘        │
└─────────────────────────────────────────────────────┘
                       │
                       ▼ (local filesystem)
              ~/.uran/sessions.json
```

## 组件职责

### packages/shared

共享类型定义，不含业务逻辑：

- `types.ts` — Session、AgentEvent、Socket.IO 请求/响应类型

### packages/cli

守护进程实现：

- `daemon/server.ts` — Socket.IO 服务器，端口 19999
- `daemon/session.ts` — SessionManager，会话生命周期
- `daemon/types.ts` — DaemonState、端口配置
- `agents/mod.ts` — Agent 接口定义
- `agents/claude.ts` — ClaudeAgent 实现

### packages/web

React 前端：

- `socket.ts` — Socket.IO 客户端连接
- `components/ChatView.tsx` — 聊天主视图
- `components/Message.tsx` — 单条消息
- `components/MarkdownRenderer.tsx` — Markdown 渲染
- `hooks/useSocket.ts` — Socket 连接管理

## 通信流程

1. 前端通过 `session:create` 创建会话
2. 前端通过 `session:send` 发送消息
3. Daemon 将 `AgentEvent` 通过 `session:event` 推送回前端
4. 前端根据事件类型更新 UI

## 数据流

- 会话元数据持久化：`~/.uran/sessions.json`
- Daemon 状态持久化：`~/.uran/daemon.state.json`
- 日志输出：`~/.uran/daemon.log`
