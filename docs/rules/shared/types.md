# 共享类型

`packages/shared/src/types.ts` 定义了跨包使用的核心类型。

## Session

会话元数据，持久化到 `~/.openz/sessions.json`：

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

## AgentEventBase

所有事件的公共字段：

```typescript
interface AgentEventBase {
  eventId: string;      // UUID v4，全局唯一，去重用
  sessionId: string;    // 会话 ID
  seq: number;          // 会话内单调递增（从 0 起），检测丢事件
  timestamp: number;    // Unix ms，事件产生时刻
}
```

## AgentEvent 数据类型

各事件 `data` 字段的强类型定义：

```typescript
interface SessionInitData {}                           // Session 初始化完成
interface MessageStartData { messageId: string }      // 用户消息开始处理
interface TextDeltaData { text: string }             // 文本增量输出
interface ThinkingStartData {}                        // Claude 开始思考
interface ThinkingDeltaData { text: string }          // 思考内容增量输出
interface ToolUseStartData {                          // 开始调用工具
  tool_use_id: string;
  name: string;
  input: Record<string, unknown>;
}
interface ToolUseInputDeltaData {                     // 工具输入参数增量（JSON 格式）
  tool_use_id: string;
  input_json_delta: string;
}
interface AssistantCompleteData { message: unknown }   // Assistant 消息块处理完成
interface ToolResultData {                            // 工具执行结果
  tool_use_id: string;
  content: string;
  isError?: boolean;          // 标记工具执行是否出错
}
interface TurnDoneData {}                             // 轮次结束
interface RawStreamEventData { event: unknown }       // 原始 SDK 流事件（调试用）
interface ErrorData { error: string }                 // 发生错误
```

## AgentEvent 完整类型

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

### SessionHistoryQuery

GET `/sessions/:id/events` 的查询参数：

```typescript
interface SessionHistoryQuery {
  after?: number; // 只拉 after 之后的 event（不含 after）
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

### SessionHistoryResponse

```typescript
interface SessionHistoryResponse {
  sessionId: string;
  events: AgentEvent[];
}
```

## 工具函数

### generateSessionId

生成 UUID 作为 session ID：

```typescript
import { generateSessionId } from '@openz/shared';

const id = generateSessionId(); // e.g. "a1b2c3d4-..."
```
