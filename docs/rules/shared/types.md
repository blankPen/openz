# 共享类型

`packages/shared/src/types.ts` 定义了跨包使用的核心类型。

## Session

会话元数据，持久化到 `~/.uran/sessions.json`：

```typescript
interface Session {
  id: string;
  engine: 'claude' | string;
  cwd: string;
  model?: string;
  status: 'idle' | 'running' | 'interrupted' | 'done' | 'disconnected';
  createdAt: number;
}
```

| 字段 | 说明 |
|------|------|
| `id` | 会话唯一标识（UUID） |
| `engine` | Agent 引擎类型 |
| `cwd` | 会话工作目录 |
| `model` | 使用的 Claude 模型 |
| `status` | 当前状态 |
| `createdAt` | 创建时间（Unix ms） |

### Status 状态机

```
idle ──────► running ──────► done
   │                            ▲
   │◄───── interrupted ─────────┘
   │
   └────────────────► disconnected (daemon 重启后)
```

## AgentEvent

Agent 运行时事件的联合类型，参见 [会话事件](../api/session-events.md)。

## Socket.IO 请求类型

### CreateSessionRequest

```typescript
interface CreateSessionRequest {
  id?: string;
  engine?: string;
  cwd?: string;
  model?: string;
}
```

### SendMessageRequest

```typescript
interface SendMessageRequest {
  sessionId: string;
  message: string;
}
```

### SessionRequest

```typescript
interface SessionRequest {
  sessionId: string;
}
```

## Socket.IO 响应类型

### SessionCreatedResponse

```typescript
interface SessionCreatedResponse {
  session: Session;
}
```

### SessionListResponse

```typescript
interface SessionListResponse {
  sessions: Session[];
}
```

### SessionErrorResponse

```typescript
interface SessionErrorResponse {
  sessionId: string;
  error: string;
}
```

### SessionEventResponse

```typescript
interface SessionEventResponse {
  sessionId: string;
  event: AgentEvent;
}
```

## 工具函数

### generateSessionId

生成 UUID 作为 session ID：

```typescript
import { generateSessionId } from '@uran/shared';

const id = generateSessionId(); // e.g. "a1b2c3d4-..."
```
