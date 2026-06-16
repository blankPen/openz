# 技术报告：远程 Claude Code / Codex Agent 连接架构

## Happy vs Multica — 对比分析

---

## 1. 执行摘要

**Happy** 是一个零知识加密中继系统，通过手机 App 或网页 UI 实现对 Claude Code 和 Codex 会话的远程控制。架构采用持久化本地 Daemon，暴露本地 HTTP 控制服务器，基于 Socket.IO 的中继服务器仅存储加密数据块——无法解密内容。所有加密均在客户端传输前完成。

**Multica** 是一个开源托管 Agent 平台，通过本地 Daemon 将远程 AI 编程 Agent（Claude Code、Codex、Copilot 等）连接到 Go 后端。Daemon 通过 HTTP 轮询获取分配的任务，通过 WebSocket 接收实时唤醒通知，并作为子进程启动 Agent CLI，通过 stdio 进行 JSON 流式传输。

---

## 2. 架构概览

### 2.1 Happy 项目架构

#### 包结构（Monorepo — pnpm workspace）

| 包 | 语言 | 用途 |
|---|---|---|
| `happy-cli` | TypeScript | Claude Code/Codex 的 CLI 封装——面向用户的主要 CLI；启动 Daemon |
| `happy-agent` | TypeScript | 远程 Agent 控制 CLI，用于远程管理会话 |
| `happy-server` | TypeScript (Node.js) | 后端服务器——Fastify + Socket.IO；零知识加密同步中继 |
| `happy-app` | TypeScript (React Native / Expo) | 移动客户端（iOS/Android）和网页 UI |
| `happy-wire` | TypeScript | 共享线协议类型 + Zod schemas |
| `happy-app-logs` | TypeScript | 日志查看工具 |
| `codium` | TypeScript | Cursor/Codex 集成 |

#### 服务器组件（`happy-server`）

- **框架**：Fastify 5 + TypeScript
- **数据库**：Prisma ORM + PostgreSQL，或开发环境用 PGlite（嵌入式）
- **实时通信**：Socket.IO（WebSocket 为主，轮询为备）
- **缓存/发布订阅**：ioredis + Redis（可选，用于多进程部署）
- **目录结构**：
  - `/sources/app/` — 应用入口
  - `/sources/apps/api/` — REST API 路由 + Socket.IO 处理器
  - `/sources/modules/` — 可复用业务逻辑模块
  - `/sources/storage/` — 数据库工具

#### 客户端组件

**CLI（`happy-cli`）**：
- 入口：`src/index.ts`
- Daemon：`src/daemon/run.ts` — 持久后台进程，管理 PTY 进程或基于 SDK 的 Claude 会话
- Claude 集成：`src/claude/` — 处理交互模式（PTY spawn）和远程模式（SDK）
- API 客户端：`src/api/` — 服务器通信 + 端到端加密

**移动端（`happy-app`）**：
- 基于 Expo（React Native）构建
- 源码在 `sources/` 目录
- 通过 Socket.IO 连接，使用 `user-scoped` token 接收所有用户事件

#### 关键配置文件

| 文件 | 用途 |
|---|---|
| `packages/happy-agent/src/session.ts` | `SessionClient` — WebSocket 连接至 `/v1/updates` |
| `packages/happy-agent/src/machineRpc.ts` | RPC 机制：跨 Daemon 连接进行 spawn/resume |
| `packages/happy-agent/src/encryption.ts` | 端到端加密（AES-256-GCM, TweetNaCl box） |
| `packages/happy-wire/src/messages.ts` | 线协议 Zod schemas（会话事件、信封格式） |
| `packages/happy-server/sources/apps/api/socket.ts` | 服务器端 Socket.IO 配置 |
| `packages/happy-server/sources/apps/api/socket/rpcHandler.ts` | 服务器端 RPC 路由 |
| `~/.happy/agent.key` | 通过系统 Keychain 存储的加密凭证 |
| `~/.happy/daemon.state.json` | PID、端口、版本追踪 |

---

### 2.2 Multica 项目架构

#### 包结构（Turborepo）

| 包 / 应用 | 语言 | 用途 |
|---|---|---|
| `packages/core` | TypeScript | 无头业务逻辑——Zustand store、React Query hooks、API 客户端 |
| `packages/ui` | TypeScript | 原子化 UI 组件（shadcn/Base UI） |
| `packages/views` | TypeScript | 共享业务页面和组件 |
| `apps/web` | TypeScript (Next.js) | 前端网页应用（App Router） |
| `apps/desktop` | TypeScript (Electron) | 桌面应用 |
| `apps/mobile` | TypeScript (Expo/React Native) | 移动端 iOS App |
| `server` | Go | 后端服务器（Chi 路由、WebSocket hub、PostgreSQL） |

#### 服务器组件（`server/`）

- **运行时**：Go 1.22+
- **HTTP 路由**：Chi
- **WebSocket**：Gorilla WebSocket
- **数据库**：PostgreSQL 17 + pgvector
- **缓存/中继**：Redis（基于 stream 的多副本广播）
- **目录结构**：
  - `cmd/multica/` — CLI 入口
  - `cmd/server/` — 后端服务器入口
  - `internal/daemon/` — 本地 Agent 运行时（轮询服务器、启动 Agent）
  - `internal/daemonws/` — Daemon WebSocket hub
  - `internal/handler/` — HTTP 处理器（Chi 路由）
  - `internal/realtime/` — 浏览器/客户端 WebSocket 广播器
  - `internal/service/` — 业务逻辑
  - `internal/auth/` — 认证
  - `pkg/agent/` — Agent 后端实现（claude、codex、copilot 等）
  - `pkg/protocol/` — WebSocket 消息类型和事件常量
  - `pkg/db/` — sqlc 生成的数据库代码

#### 客户端组件

- **Web**：Next.js 16 + App Router，通过 WebSocket 连接（`/ws`）
- **Desktop**：Electron 封装
- **Mobile**：Expo/React Native
- **Daemon**：本地运行的 Go 二进制文件，与 Go 后端通信

#### 关键配置文件

| 文件 | 用途 |
|---|---|
| `server/internal/daemon/daemon.go` | 主 Daemon 循环、任务轮询、工作区同步 |
| `server/internal/daemon/client.go` | 服务器 REST API 的 HTTP 客户端 |
| `server/internal/daemon/wakeup.go` | WebSocket 任务唤醒连接（`/api/daemon/ws`） |
| `server/internal/daemon/config.go` | Daemon 配置（轮询间隔、超时、工作区路径） |
| `server/internal/daemonws/hub.go` | 服务器端 Daemon WebSocket hub |
| `server/internal/realtime/hub.go` | 浏览器/客户端 WebSocket 广播器 |
| `server/pkg/protocol/events.go` | 事件类型常量 |
| `server/internal/handler/daemon.go` | Daemon HTTP 处理器端点 |
| `packages/core/realtime/provider.tsx` | 前端 WebSocket 客户端 |

---

## 3. 远程连接实现

### 3.1 Happy — 远程连接详解

#### 协议栈

| 层级 | 技术 |
|---|---|
| 传输层 | Socket.IO（WebSocket 为主，轮询为备） |
| 路径 | `/v1/updates` |
| RPC | socket.emit + acknowledgments |
| 加密 | 端到端：AES-256-GCM（dataKey 变体）+ TweetNaCl secretbox（遗留） |
| 认证 | 基于 Token 的 `auth.token` |

#### 三种连接作用域

| 类型 | 认证 | 用途 |
|---|---|---|
| `user-scoped` | Token | UI 客户端（移动/网页）——接收所有用户事件 |
| `session-scoped` | Token + SessionID | 按会话的消息流 |
| `machine-scoped` | Token + MachineID | 远程机器上的 Daemon |

#### 认证流程（QR 码）

1. CLI 生成临时的 NaCl box 密钥对
2. 公钥通过 `POST /v1/auth/account/request` 发送
3. 显示 QR 码：`happy:///account?<base64url-encoded-publicKey>`
4. 手机扫描，通过 `POST /v1/auth/account/response` 审批
5. 服务器用手机的 box 密钥对加密账户密钥
6. CLI 轮询并接收加密响应，解密后存储凭证至 `~/.happy/agent.key`

#### RPC 机制（Daemon Spawn/Resume）

```
客户端                        服务器                          Daemon
   |                              |                               |
   |-- emit 'rpc-call'           |                               |
       method: "machineId:spawn-happy-session"                  |
       params: <encrypted>        |                               |
   |                              |-- fetchSockets() ------------->|
   |                              |<-- 找到目标 socket ---------------|
   |                              |-- emitWithAck 'rpc-request' -->|
   |                              |                               |-- 执行
   |                              |<-- result --------------------|
   |<-- { ok: true, result: ...} |                               |
```

- Room 命名：`rpc:{userId}:{methodName}`
- 超时：每次 RPC 调用 30 秒
- 存在轮询：2 秒间隔检测 Daemon 断开

#### 会话创建流程

1. CLI 通过 `POST /v1/sessions` 创建会话，收到按会话的加密密钥
2. SessionClient 通过会话作用域认证建立 Socket.IO 连接
3. 消息用会话密钥加密（AES-256-GCM）
4. 远程 spawn/resume：CLI 调用 `spawnSessionOnMachine()` / `resumeSessionOnMachine()` → RPC 通过服务器路由到 Daemon socket

#### REST API 端点

```
GET    /v1/sessions              # 列出会话
POST   /v1/sessions              # 创建/按标签获取会话
GET    /v1/sessions/:id/messages # 获取消息
DELETE /v1/sessions/:id          # 删除会话
GET    /v1/machines              # 列出机器
POST   /v1/machines              # 注册机器
POST   /v1/auth                  # 直接认证（签名）
POST   /v1/auth/request          # QR 码认证请求
POST   /v1/auth/response         # 审批认证请求
```

---

### 3.2 Multica — 远程连接详解

#### 协议栈

| 层级 | 技术 |
|---|---|
| 传输层 | HTTP REST（任务操作）+ Gorilla WebSocket（实时） |
| Daemon WS 路径 | `/api/daemon/ws` |
| 前端 WS 路径 | `/ws` |
| 加密 | 无（服务器可访问完整明文） |
| 认证 | Bearer Token（`mul_` PAT、 `mdt_` Daemon Token、 `mat_` 任务 Token） |

#### Daemon 到服务器的通信

**HTTP 端点**（任务操作）：

```
POST /api/daemon/register              # 启动时注册运行时
POST /api/daemon/deregister            # 关闭时清理
POST /api/daemon/heartbeat             # 保活（默认 15s）
POST /api/daemon/runtimes/{id}/tasks/claim   # 认领可用任务
POST /api/daemon/tasks/{id}/start      # 标记任务为运行中
POST /api/daemon/tasks/{id}/progress    # 批量报告任务进度
POST /api/daemon/tasks/{id}/messages    # 批量报告任务消息
POST /api/daemon/tasks/{id}/complete    # 报告任务完成
POST /api/daemon/tasks/{id}/fail        # 报告任务失败
GET  /api/daemon/tasks/{id}/status      # 检查任务状态（取消轮询）
POST /api/daemon/runtimes/{id}/recover-orphans
```

**WebSocket**（`/api/daemon/ws` — Daemon 唤醒连接）：
- 服务器通过 `daemon:task_available` 发送任务调度信号
- Daemon 发送 `daemon:heartbeat` 帧保活
- 服务器响应 `daemon:heartbeat_ack`（可能包含待处理操作：pending_update、pending_model_list、pending_local_skills、pending_local_skill_import、runtime_gone）

#### 前端到服务器的通信

**WebSocket**（`/ws`）：
- 基于来源的访问控制
- Cookie 或首消息 PAT（`mul_...`）认证
- 订阅/取消订阅基于作用域的房间：`workspace`、`user`、`task`、`chat`
- 所有实体变更的实时事件广播

#### 认证

| Token 前缀 | 类型 | 过期时间 | 作用域 |
|---|---|---|---|
| `mul_...` | Personal Access Token | 90 天 | 用户 |
| `mdt_...` | Daemon Token | — | 工作区 |
| `mat_...` | 任务 Token | — | 按任务作用域，认领时铸造 |

#### 任务生命周期

1. **调度**：服务器标记任务为 `dispatched`，通过 WS 发送 `daemon:task_available`
2. **认领**：Daemon 通过 HTTP 调用 `POST /api/daemon/runtimes/{id}/tasks/claim`
3. **启动**：Daemon 调用 `POST /api/daemon/tasks/{id}/start`
4. **进度**：Daemon 通过 `POST /api/daemon/tasks/{id}/messages` 流式传输消息（批量）
5. **完成/失败**：Daemon 调用完成端点，附带输出/分支/会话信息
6. **取消**：Daemon 轮询 `GET /api/daemon/tasks/{id}/status` 检测服务器端取消

#### 双通道心跳系统

1. **HTTP 后备**（`POST /api/daemon/heartbeat`）——始终活跃，默认 15s
2. **WebSocket 通道**（`daemon:heartbeat` 帧）——WS 新鲜时优先，抑制 HTTP

---

## 4. MCP 工具/协议使用

### 4.1 Happy — MCP 工具和协议

**不使用传统 MCP 工具。** Happy 使用自定义线协议：

#### 线协议（`happy-wire` 包）

定义了两种消息格式：

**遗留格式**：
```typescript
{ role: 'user' | 'agent', content: {...} }
```

**现代会话协议**（标注"UNDER REVIEW"）：
```typescript
{
  id: string,
  time: number,
  role: 'user' | 'agent',
  turn?: string,
  subagent?: string,       // cuid2，用于子 Agent ID
  claudeUuid?: string,     // 用于会话分叉/回退
  codexItemId?: string,    // 用于 Codex 线程复制
  ev: SessionEvent
}

// SessionEvent 类型
type SessionEvent =
  | { t: 'text', text: string, thinking?: boolean }
  | { t: 'service', text: string }
  | { t: 'tool-call-start', call, name, title, description, args }
  | { t: 'tool-call-end', call }
  | { t: 'file', ref, name, size, mimeType?, image? }
  | { t: 'turn-start' }
  | { t: 'turn-end', status: 'completed' | 'failed' | 'cancelled' }
  | { t: 'start', title? }
  | { t: 'stop' }
```

Happy 仓库中的 `.mcp.json` 文件引用了本地 MCP 服务器 `http://127.0.0.1:29979/mcp`——这是独立的 paper/writer MCP 服务器，与 Happy 核心远程连接功能无关。

#### Claude Code 集成模式

- **远程模式**：直接使用 `@anthropic-ai/claude-code` SDK（`claudeRemote.ts`）
- **交互模式**：启动 PTY 进程运行 `claude` 命令，`--print --output-format stream-json`

---

### 4.2 Multica — MCP 工具和协议

#### Agent 协议（基于 stdio）

每个 Agent 在 `server/pkg/agent/` 中有独立实现：

| Agent | 协议 | 调用方式 |
|---|---|---|
| **Claude Code** | `--output-format stream-json` | 通过 stdio 运行 `claude` CLI，JSON 流式 |
| **Codex** | JSON-RPC 2.0 over stdio | `codex app-server --listen stdio://` |
| **GitHub Copilot** | 自定义调用 | `copilot` CLI |
| **OpenClaw** | 自定义 | `openclaw` CLI |
| **OpenCode** | 自定义 | `opencode` CLI |
| **Hermes** (Nous Research) | 自定义 | `hermes` CLI |
| **Gemini** (Google) | 自定义 | `gemini` CLI |
| **Pi** | 自定义 | `pi` CLI |
| **Cursor** | 自定义 | `cursor` CLI |
| **Kimi** (Moonshot) | 自定义 | `kimi` CLI |
| **Kiro** | 自定义 | `kiro` CLI |

#### MCP 配置支持

- Daemon 可以将 MCP 配置写入临时文件，传递 `--mcp-config <path>` 给 Claude Code
- Codex MCP 配置通过 `$CODEX_HOME/config.toml` 管理

#### 实时事件类型

```
daemon:heartbeat           — Daemon → 服务器保活
daemon:heartbeat_ack       — 服务器 → Daemon 确认（可能包含待处理操作）
daemon:task_available      — 服务器 → Daemon 任务唤醒提示
daemon:register            — Daemon → 服务器注册
task:queued                — 前端事件
task:dispatch              — 前端事件
task:running               — 前端事件
task:completed             — 前端事件
task:failed                — 前端事件
issue:*                    — 前端事件
comment:*                  — 前端事件
agent:*                    — 前端事件
chat:*                     — 前端事件
```

#### 消息信封

```json
{
  "type": "event:type",
  "payload": { ... }
}
```

---

## 5. 相同点与差异

### 并排对比表

| 维度 | Happy | Multica |
|---|---|---|
| **架构** | Daemon + 中继服务器 + 移动 App | Daemon + Go 后端 + 网页前端 |
| **Daemon 位置** | 本地机器（`happy-cli` 启动 `happy` daemon） | 本地机器（Go 二进制，与 Agent CLI 分开） |
| **Daemon 通信（到服务器）** | Socket.IO WebSocket | HTTP REST + WebSocket（双通道） |
| **服务器技术** | Node.js (Fastify) + TypeScript | Go + Chi 路由 |
| **加密** | **端到端加密**——服务器仅存储加密数据块 | **无加密**——服务器处理明文 |
| **认证** | QR 码 + NaCl box 密钥对 + Token | PAT Token（`mul_`、`mdt_`、`mat_`）+ Bearer |
| **Agent CLI 集成** | PTY spawn（`--print --output-format stream-json`）或 SDK | 每个 Agent 通过 stdio spawn（Codex 用 JSON-RPC，Claude 用流式 JSON） |
| **MCP 工具** | 无（自定义线协议） | 支持传递 `--mcp-config` 给 Claude Code |
| **实时（前端）** | Socket.IO（`user-scoped`、`session-scoped`、`machine-scoped` 房间） | Gorilla WebSocket（`/ws`，基于作用域的房间：workspace/user/task/chat） |
| **RPC 机制** | Socket.IO `rpc-call`/`rpc-request` + ack（30s 超时） | HTTP POST + WebSocket 任务提示（无直接 RPC） |
| **会话模型** | 每会话独立 AES-256 密钥 | 任务模型（认领 → 启动 → 进度 → 完成/失败） |
| **多 Agent 支持** | Claude Code、Codex、Gemini、OpenClaw | Claude、Codex、Copilot、OpenClaw、OpenCode、Hermes、Gemini、Pi、Cursor、Kimi、Kiro、CodeBuddy、Antigravity |
| **支持的前端** | 移动端（Expo）、网页 | Next.js 网页、Electron 桌面、Expo 移动端 |
| **数据库** | PostgreSQL + Prisma（或开发用 PGlite） | PostgreSQL 17 + pgvector |
| **扩展性** | 多进程部署可选 Redis pub/sub | Redis 中继用于多副本广播 |
| **任务取消** | RPC（30s 超时） | 轮询 `GET /api/daemon/tasks/{id}/status` |
| **心跳** | 存在轮询（2s 间隔，Socket.IO） | 双通道：HTTP（15s）+ WS heartbeat 帧 |
| **零知识** | 是——服务器无法解密消息 | 否——服务器有完整明文访问权限 |
| **配置存储** | `~/.happy/daemon.state.json`、`~/.happy/agent.key` | 环境变量（`MULTICA_DAEMON_POLL_INTERVAL` 等） |
| **Monorepo 结构** | pnpm workspace（7 个包） | Turborepo（packages + apps） |

---

## 6. 优缺点

### Happy — 优点

1. **真正的零知识加密**：中继服务器实际上无法读取任何消息内容——所有加密在传输前于客户端完成。即使服务器被攻破，也能提供强大的隐私保障。

2. **原生远程控制用户体验**：用户运行 `happy` 而非 `claude`，可在本地和远程模式间无缝切换。QR 码认证对用户友好。

3. **丰富的会话模型**：每会话 AES-256-GCM 加密和专用密钥交换；会话事件包含细粒度状态（turn-start、tool-call-start/end、file、text 等）。

4. **灵活的基于房间的路由**：Socket.IO 房间允许细粒度访问控制——`user-scoped`、`session-scoped`、`machine-scoped` 连接各自看到不同的事件流。

5. **多 Agent 支持**：支持 Claude Code、Codex、Gemini 和 OpenClaw，统一接口。

6. **交互式使用延迟更低**：直接的 Daemon 到服务器 WebSocket 路径，命令/响应周期无轮询开销。

### Happy — 缺点

1. **加密复杂性**：自定义加密方案包含遗留（`TweetNaCl`）和现代（`dataKey` AES-256-GCM）两种变体，增加实现复杂度和维护负担。

2. **无原生 MCP 工具转发**：自定义线协议与标准 MCP 生态系统不兼容。不添加额外桥接，无法通过 Happy 暴露 MCP 服务器。

3. **单一认证机制**：QR 码认证对移动端体验良好，但 CLI 端需要轮询；不支持传统用户名/密码或 SSO。

4. **任务管理欠成熟**：会话模型围绕交互式使用设计，而非批量任务排队；无任务优先级、调度或工作池概念。

5. **纯 TypeScript 技术栈**：整个技术栈（服务器、CLI、移动端）都是 TypeScript/Node.js——不适合高性能或系统级扩展。

6. **扩展依赖 Redis**：多进程部署需要 Redis pub/sub，增加运维复杂度。

---

### Multica — 优点

1. **多 Agent 平台**：原生支持 12+ Agent 后端（Claude、Codex、Copilot、OpenClaw、OpenCode、Hermes、Gemini、Pi、Cursor、Kimi、Kiro 等），统一任务抽象。

2. **任务排队与管理**：完整任务生命周期（入队 → 认领 → 启动 → 进度 → 完成/失败），支持取消、孤儿恢复和并发限制（默认 20）。

3. **MCP 配置传递**：支持传递 `--mcp-config` 给 Claude Code，可在 Multica 任务模型内使用标准 MCP 工具。

4. **Go 后端高性能**：服务器使用 Go 编写，为 Daemon 连接和 WebSocket hub 提供高效并发处理，不受 Node.js 事件循环限制。

5. **基于轮询的任务分发**：HTTP 轮询 + WS 唤醒对防火墙友好，在 NAT 边界内可靠工作，无需服务器开放入站端口。

6. **pgvector 集成**：原生向量存储支持，支持任务/产物的语义搜索。

7. **Redis 中继水平扩展**：基于流的消费者组实现跨副本消息广播。

8. **关注点分离**：Agent CLI 作为纯子进程启动——Multica 不修改或封装 Agent 二进制文件本身。

### Multica — 缺点

1. **无加密**：服务器处理明文；所有消息、代码和产物对服务器可见。这是基础架构选择，不是缺失功能。

2. **轮询开销**：Daemon 默认每 30 秒轮询一次任务，任务调度和认领之间有延迟。WebSocket 唤醒可缓解，但仍需维护 WS 连接。

3. **无直接 RPC**：远程控制是基于任务的，而非交互式的。无法实现与运行中 Agent 会话的实时双向消息传递（如发送消息到活跃会话并接收流式输出）。

4. **Daemon 作为独立二进制文件**：Multica daemon 是独立的 Go 二进制文件，必须与 Agent CLI 分开安装，相比 Happy 的进程内 Daemon 方式增加了部署复杂度。

5. **会话模型较简单**：会话不是一等公民，无持久加密状态；工作单元是具有有限生命周期的任务，而非交互式对话。

6. **12+ Agent 后端复杂度**：每个 Agent 有自定义实现，增加代码库表面积和维护负担。

7. **无移动 App**：虽然 `apps/mobile` 存在于仓库结构中，Multica 没有可用于远程会话控制的生产就绪移动客户端。

---

## 7. 实现复杂度评估

### Happy

| 维度 | 估算 |
|---|---|
| **服务器 LoC** | ~5,000–8,000（TypeScript，Fastify + Socket.IO） |
| **客户端/CLI LoC** | ~4,000–6,000（TypeScript，CLI + Daemon） |
| **移动端 LoC** | ~3,000–5,000（React Native / Expo） |
| **总 LoC** | ~12,000–19,000 |
| **外部依赖** | Fastify、Socket.IO 客户端/服务器、Prisma、ioredis、TweetNaCl、libsodium、Zod、Expo |
| **运行时依赖** | Node.js 20+、PostgreSQL、Redis（可选） |
| **加密复杂度** | 高——自定义密钥派生树、两种加密变体、每会话密钥交换 |
| **移植难度** | 中高——加密架构与客户端紧耦合；需要重新实现完整加密栈 |

### Multica

| 维度 | 估算 |
|---|---|
| **服务器 LoC** | ~6,000–9,000（Go，Chi + Gorilla WS） |
| **Daemon LoC** | ~3,000–5,000（Go，每 Agent 实现） |
| **前端 LoC** | ~5,000–8,000（Next.js + packages/core、UI、views） |
| **总 LoC** | ~14,000–22,000 |
| **外部依赖** | Chi、gorilla/websocket、pgx（PostgreSQL 驱动）、sqlc、Redis 客户端、Next.js、React、Zustand、React Query、shadcn/ui |
| **运行时依赖** | Go 1.22+、PostgreSQL 17、Redis（多副本可选）、Node.js 18+（前端构建） |
| **加密复杂度** | 无——明文架构简化代码库 |
| **移植难度** | 中——Daemon 是独立的 Go 二进制文件；任务/工作区模型可独立于 UI 提取 |

### 关键可提取部分

**从 Happy 可提取**：
- 加密协议和密钥交换机制
- 会话事件 schema 和线协议类型
- QR 码认证流程

**从 Multica 可提取**：
- Daemon 任务轮询和 WS 唤醒架构
- Agent 子进程启动模式（特别是 Codex JSON-RPC stdio）
- 通过 Redis streams 的多副本广播
- 任务生命周期管理

---

## 8. 性能考量

### Happy

| 维度 | 特性 |
|---|---|
| **延迟（CLI → 服务器）** | ~60–100ms 每次 RPC 调用（WebSocket 往返） |
| **心跳开销** | 2s Socket.IO 存在轮询（极小） |
| **加密开销** | AES-256-GCM 每条消息增加 ~0.3–0.5ms；可忽略 |
| **并发会话** | Socket.IO 每进程处理数千并发连接；Redis 启用水平扩展 |
| **Daemon 资源使用** | 低——Node.js 进程，交互式会话用 PTY |
| **消息吞吐量** | 受 WebSocket 帧大小限制；适合交互式使用 |

### Multica

| 维度 | 特性 |
|---|---|
| **任务调度延迟** | 30s 轮询间隔 + WS 唤醒（WS 连接时 ~0ms）——最坏 30s，通常 <1s |
| **心跳开销** | HTTP 15s + WS heartbeat 帧——略高于 Happy |
| **加密开销** | 无 |
| **每 Daemon 并发任务** | 默认最多 20 个并发任务 |
| **Agent 空闲看门狗** | 30 分钟 |
| **Agent 工具看门狗** | 2 小时 |
| **Daemon 资源使用** | Go 二进制很轻量；每个 Agent 启动独立子进程 |
| **服务器并发** | Go 的 goroutine 模型高效处理 10,000+ 并发连接 |
| **扩展性** | Redis stream 中继实现多副本广播；PostgreSQL 连接池 |

### 扩展性对比

| 维度 | Happy | Multica |
|---|---|---|
| **单节点吞吐量** | 中等（Node.js 事件循环） | 高（Go goroutine） |
| **水平扩展** | 多进程用 Redis pub/sub | 多副本用 Redis streams 广播 |
| **数据库瓶颈** | PostgreSQL（Prisma 连接池） | PostgreSQL 17（pgx，连接池） |
| **会话持久性** | 完整会话状态 + 每会话加密密钥 | 基于任务；会话在任务内是临时的 |

---

## 9. 建议

### 何时使用 Happy

- **隐私优先场景**：当中继服务器必须被视为不可信时（例如，为高风险环境自托管）。零知识加密保证意味着明文永远不会到达服务器。

- **交互式远程控制**：主要用例是通过移动设备或辅助机器实时驱动 Claude Code 或 Codex 会话——会话保持活跃和可交互。

- **不可信基础设施**：部署环境（例如共享托管、不可信云）意味着不能假设数据机密性。

**从 Happy 学习**：
- 密钥派生树架构（主密钥 → 内容密钥对 → 每会话密钥）为多租户加密和每会话密钥轮换提供了优秀模型。
- QR 码认证流程是在无需输入密码的情况下将 CLI 会话链接到移动 App 的简洁模式。
- 基于房间的 Socket.IO 架构用于分离用户级、会话级和机器级事件流，设计精良。

### 何时使用 Multica

- **团队 Agent 管理**：主要需求是在多个开发者团队中管理、调度和监控跨多个 Agent 后端（Claude、Codex、Copilot 等）的批量任务。

- **自托管团队基础设施**：服务器在可信网络内（例如内部开发基础设施），重点是任务跟踪和工作分配，而非加密。

- **标准 MCP 工具使用**：当 Claude Code 需要通过 `--mcp-config` 使用 MCP 服务器时——Multica 原生支持，而 Happy 不支持。

- **高并发任务工作负载**：Go 后端基于 goroutine 的并发能以更低开销处理更多并发 Daemon 连接和任务操作。

- **更广泛的 Agent 支持**：当工作流需要 Claude Code 以外的 Agent（例如 Codex、Copilot CLI、Gemini、Cursor）时，Multica 的多后端架构已就绪。

**从 Multica 学习**：
- 双通道心跳系统（HTTP 轮询 + WebSocket）是防火墙/NAT 友好 Daemon 通信的稳健模式。
- 通过 Redis stream 的中继实现多副本广播，为 WebSocket 系统的水平扩展提供了生产级模式。
- 任务生命周期模型（入队 → 认领 → 启动 → 进度 → 完成/失败/取消），带孤儿恢复和 GC TTL，是分布式任务队列的成熟模式。

### 值得提取的架构模式

1. **Happy 的加密架构**：内容密钥对与会话密钥的分离，结合 NaCl box 密钥交换用于认证，是适用于任何中继系统的稳健零知识模式。

2. **Multica 的 Daemon WS hub**：服务器端 WebSocket hub 管理 Daemon 注册、按工作区/任务房间订阅、跨副本 Redis 中继广播的模式，可直接应用于任何需要多 Daemon 协调的系统。

3. **两个项目的会话/事件 schema**：Happy 的 `SessionEvent` 分类（text、tool-call-start/end、turn-start/end、file、stop）为 Agent 会话状态建模提供了良好参考。Multica 的任务状态机（queued → dispatched → running → completed/failed）是任务生命周期建模的可靠参考。

4. **Multica 的 Agent 子进程启动**：Codex JSON-RPC 2.0 over stdio 模式和 Claude Code `--output-format stream-json` 解析，对于需要集成多个 Agent CLI 的任何系统都可直接复用。

---

## 附录：关键文件参考

### Happy

| 文件 | 用途 |
|---|---|
| `/packages/happy-agent/src/session.ts` | `SessionClient` — Socket.IO WebSocket 连接 |
| `/packages/happy-agent/src/machineRpc.ts` | spawn/resume 的 RPC 方法 |
| `/packages/happy-agent/src/encryption.ts` | 端到端加密（AES-256-GCM、TweetNaCl） |
| `/packages/happy-agent/src/credentials.ts` | 认证凭证管理 |
| `/packages/happy-wire/src/messages.ts` | Zod 线协议 schemas |
| `/packages/happy-server/sources/apps/api/socket.ts` | 服务器 Socket.IO 配置 |
| `/packages/happy-server/sources/apps/api/socket/rpcHandler.ts` | 服务器 RPC 处理器 |
| `/packages/happy-server/sources/apps/api/api.ts` | REST API 路由 |
| `packages/happy-cli/src/daemon/run.ts` | Daemon 生命周期管理 |

### Multica

| 文件 | 用途 |
|---|---|
| `server/internal/daemon/daemon.go` | 主 Daemon 循环、任务轮询 |
| `server/internal/daemon/client.go` | 服务器 API 的 HTTP 客户端 |
| `server/internal/daemon/wakeup.go` | WebSocket 任务唤醒连接 |
| `server/internal/daemonws/hub.go` | 服务器端 Daemon WS hub |
| `server/internal/realtime/hub.go` | 前端 WebSocket 广播器 |
| `server/internal/realtime/redis_relay.go` | 多副本 Redis stream 中继 |
| `server/pkg/protocol/events.go` | 事件类型常量 |
| `server/pkg/agent/claude.go` | Claude Code stdio 集成 |
| `server/pkg/agent/codex.go` | Codex JSON-RPC 2.0 stdio 集成 |
| `server/internal/handler/daemon.go` | Daemon HTTP 处理器端点 |
| `packages/core/realtime/provider.tsx` | 前端 WebSocket 客户端 |
