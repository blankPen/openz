# Ultracode Phase 1 设计文档

## 目标

第一阶段实现：**本地直连的 CLI + Daemon + Web 控制台**，用于远程控制本地 Claude Code 会话。

---

## 一、整体架构

```
┌─────────────┐     Socket.IO      ┌─────────────┐     SDK      ┌─────────────┐
│ Web 控制台    │ ←───────────────→ │   Daemon     │ ←──────────→ │ Claude Code │
│ (HTML + JS)  │  ws://localhost    │  (Node.js)   │              │    SDK      │
└─────────────┘                    └─────────────┘              └─────────────┘
                                          ↑
                                    CLI（同一进程）
```

**三方组件**：
- **Daemon**：`packages/cli/` 内嵌的 Socket.IO 服务器 + Agent 会话管理
- **CLI**：`packages/cli/` — 启动 Daemon、查看/管理会话
- **Web Demo**：`packages/web/` — 单页 HTML，零构建

**通信**：`ws://localhost:19999`（默认端口，可配置）

**网络**：本地直连（localhost），无中继服务器，无端到端加密。

---

## 二、目录结构

```
/Users/pz/workspace/claude-code-assistant/
├── pnpm-workspace.yaml
├── package.json
├── packages/
│   ├── cli/                   # CLI 工具（含 Daemon 逻辑）
│   │   ├── src/
│   │   │   ├── index.ts       # CLI 入口
│   │   │   ├── daemon/
│   │   │   │   ├── server.ts  # Socket.IO 服务器
│   │   │   │   ├── session.ts # 会话管理
│   │   │   │   └── types.ts   # Daemon 内部类型
│   │   │   ├── agents/
│   │   │   │   ├── mod.ts     # Agent 抽象接口
│   │   │   │   └── claude.ts # Claude Code Agent 实现
│   │   │   └── types/         # 内部类型
│   │   └── package.json
│   ├── web/                   # Web 控制台
│   │   ├── src/
│   │   │   └── index.html
│   │   └── package.json
│   └── shared/                 # 共享类型
│       ├── src/
│       │   └── types.ts
│       └── package.json
└── docs/                      # 文档
```

**pnpm-workspace.yaml**：
```yaml
packages:
  - 'packages/*'
```

**依赖关系**：
- `cli` → `shared`（类型）
- `web` → `shared`（类型）
- `web` 无运行时依赖 `cli`

---

## 三、Socket.IO 消息协议

### 客户端 → Daemon

| 事件 | 用途 | Payload |
|---|---|---|
| `session:create` | 创建新会话 | `{ id?: string, cwd?: string, model?: string }` |
| `session:send` | 发送消息 | `{ sessionId, message }` |
| `session:interrupt` | 中断当前 | `{ sessionId }` |
| `session:stop` | 停止会话 | `{ sessionId }` |
| `session:list` | 列出所有会话 | `{}` |
| `session:delete` | 删除会话 | `{ sessionId }` |

### Daemon → 客户端

| 事件 | 用途 | Payload |
|---|---|---|
| `session:event` | 会话事件流 | `{ sessionId, event: AgentEvent }` |
| `session:created` | 会话创建成功 | `{ session: SessionInfo }` |
| `session:error` | 会话错误 | `{ sessionId, error: string }` |
| `session:list` | 会话列表响应 | `{ sessions: SessionInfo[] }` |

---

## 四、共享数据类型

### Session

```typescript
interface Session {
  id: string;               // UUID
  engine: 'claude' | string; // Agent 类型
  cwd: string;              // 工作目录
  model?: string;           // 模型名称，默认 claude-sonnet-4-5
  status: 'idle' | 'running' | 'interrupted' | 'done';
  createdAt: number;
}
```

### AgentEvent

```typescript
type AgentEvent =
  | { type: 'session_init'; sessionId: string; data: any }
  | { type: 'text_delta'; sessionId: string; data: { text: string } }
  | { type: 'thinking_delta'; sessionId: string; data: { text: string } }
  | { type: 'tool_use_start'; sessionId: string; data: any }
  | { type: 'tool_use_input_delta'; sessionId: string; data: any }
  | { type: 'assistant_complete'; sessionId: string; data: any }
  | { type: 'tool_result'; sessionId: string; data: any }
  | { type: 'turn_done'; sessionId: string; data: any }
  | { type: 'error'; sessionId: string; data: { error: string } };
```

---

## 五、Agent 抽象接口

```typescript
// packages/cli/src/agents/mod.ts

export interface AgentSession {
  id: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  interrupt(): void;
  stop(): void;
}

export interface Agent {
  name: string;  // 'claude', 'codex', etc.

  createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession>;

  sendMessage(sessionId: string, message: string): Promise<void>;
}
```

---

## 六、Claude Code Agent 实现

```typescript
// packages/cli/src/agents/claude.ts

import { Agent, AgentSession, AgentEvent } from './mod';
import { ClaudeCode } from '@anthropic-ai/claude-code';

export class ClaudeAgent implements Agent {
  name = 'claude';

  async createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession> {
    // 使用 @anthropic-ai/claude-code SDK 创建会话
    // 流式事件通过 onEvent 回调推送给 Daemon
  }

  async sendMessage(sessionId: string, message: string): Promise<void> {
    // 向指定会话发送消息
  }
}
```

**平台支持**：macOS + Windows，SDK 直连。

---

## 七、CLI 命令设计

```bash
# 启动 Daemon（前台运行）
ultracode daemon start

# 停止 Daemon
ultracode daemon stop

# 查看 Daemon 状态
ultracode daemon status

# 列出所有会话
ultracode sessions list

# 删除会话
ultracode sessions delete <sessionId>

# Web 控制台（启动后访问 http://localhost:19999）
```

---

## 八、Web 控制台功能

- 会话列表（创建时间、状态、引擎）
- 创建新会话（指定 cwd、model）
- 发送消息
- 接收流式响应
- 中断当前 turn
- 停止会话

**技术**：单文件 HTML + 内联 JS/CSS，零构建，零运行时依赖。

---

## 九、错误处理

| 场景 | 处理方式 |
|---|---|
| SDK 连接失败 | Daemon 重试 3 次，间隔 2s，失败后退出并报告错误 |
| Socket.IO 断开 | Web 控制台自动重连（Socket.IO 内置） |
| Daemon 崩溃 | CLI 检测 PID 文件，报告状态 |
| 会话异常 | `session:error` 事件通知客户端 |

---

## 十、扩展性规划

### 第二阶段（后续）

- **中继服务器**：Daemon + Web 控制台都连接中继服务器，实现跨互联网远程访问
- **Codex Agent**：`agents/codex.ts` 实现 `Agent` 接口，参考 `codex app-server --listen stdio://` 协议
- **Windows CLI 模式 fallback**：SDK 不可用时，降级到 `claude --print --output-format stream-json`
- **Token 认证**：Bearer Token 认证机制（参考 Multica）
- **会话持久化**：会话状态写入 `~/.ultracode/sessions/`

---

## 十一、技术选型

| 组件 | 技术 | 版本 |
|---|---|---|
| 运行时 | Node.js | 20+ |
| CLI 框架 | TypeScript | 5.x |
| Socket.IO | socket.io + socket.io-client | 4.x |
| Claude SDK | @anthropic-ai/claude-code | latest |
| 验证 | Zod | 3.x |
| 持久化 | 本地 JSON 文件 | — |

---

## 十二、验收标准

1. `ultracode daemon start` 能成功启动 Daemon，监听 19999 端口
2. Web 控制台能连接到 `localhost:19999`
3. 能创建会话、发送消息、接收流式响应
4. 能中断、停止、删除会话
5. 多会话并发正常工作
6. Windows + macOS 均能运行
