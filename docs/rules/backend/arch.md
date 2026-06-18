# 架构规范

## 系统架构

### 直接连接模式

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
              ~/.openz/sessions.json
```

### 中继模式（公网部署）

```
┌─────────────────────────────────────────────────────┐
│                    Web Console                       │
│               (React, packages/web)                  │
│                      : socket.io                      │
└──────────────────────┬───────────────────────────────┘
                       │ ws
                       ▼
┌─────────────────────────────────────────────────────┐
│              Openz Server (Relay)                    │
│              packages/server/src/                     │
│                                                      │
│  ┌──────────────────────────────────────────────┐   │
│  │            WebSocket Relay                    │   │
│  │  - 心跳检测 (30s ping, 90s timeout)          │   │
│  │  - 多 Daemon 负载均衡（最少会话优先）         │   │
│  │  - Daemon 注册与发现                          │   │
│  └──────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
                       │ ws
                       ▼
┌─────────────────────────────────────────────────────┐
│              Daemon 1 (CLI)                         │
│         packages/cli/src/daemon/                      │
│         --server <relay-url>                         │
└─────────────────────────────────────────────────────┘
                       │ ws
┌─────────────────────────────────────────────────────┐
│              Daemon 2 (CLI)                         │
│         packages/cli/src/daemon/                      │
│         --server <relay-url>                         │
└─────────────────────────────────────────────────────┘
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
- `daemon/config.ts` — XDG 配置加载，支持 `~/.config/openz/setting.json`
- `agents/mod.ts` — Agent 接口定义
- `agents/claude.ts` — ClaudeAgent 实现
- `daemon/volcengine/ttsManager.ts` — TTSManager，Volcengine TTS 集成

### packages/web

React 前端：

- `socket.ts` — Socket.IO 客户端连接，支持 `?server=<url>` 查询参数
- `components/ChatView.tsx` — 聊天主视图，包含语音回复按钮
- `components/Message.tsx` — 单条消息
- `components/MarkdownRenderer.tsx` — Markdown 渲染
- `hooks/useSocket.ts` — Socket 连接管理
- `hooks/useAudioPlayer.ts` — Web Audio API 语音播放

### packages/server

中继服务器实现（`openz-server`）：

- `server.ts` — WebSocket 中继核心，支持多 Daemon 注册和负载均衡

## 通信流程

### 直接模式

1. 前端通过 `session:create` 创建会话
2. 前端通过 `session:send` 发送消息
3. Daemon 将 `AgentEvent` 通过 `session:event` 推送回前端
4. 前端根据事件类型更新 UI

### 中继模式

1. Daemon 启动时连接 Relay Server（`--server <url>`）
2. Daemon 定期发送心跳（30s interval，90s timeout）
3. Web 通过 `?server=<url>` 连接 Relay Server
4. Relay Server 根据负载均衡策略分配 Daemon
5. 会话事件通过 Relay Server 转发

## 心跳机制

- **间隔**：30 秒
- **超时**：90 秒无响应认为 Daemon 离线
- **事件**：`daemon:ping`（Server → Daemon）、`daemon:pong`（Daemon → Server）

## 负载均衡策略

多 Daemon 连接时，使用**最少会话优先**策略：
- Server 维护每个 Daemon 的会话数
- 新会话分配给会话数最少的 Daemon

## 数据流

- 会话元数据持久化：`~/.openz/sessions.json`
- Daemon 状态持久化：`~/.openz/daemon.state.json`
- 日志输出：`~/.openz/daemon.log`
