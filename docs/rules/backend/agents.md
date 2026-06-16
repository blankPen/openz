# Agent 实现规范

## Agent 接口

`packages/cli/src/agents/mod.ts` 定义了 Agent 抽象接口：

```typescript
interface Agent {
  name: string;
  createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}

interface AgentSession {
  id: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  onEvent?: (event: AgentEvent) => void;
  interrupt(): void;
  stop(): void;
}
```

## ClaudeAgent 实现

`packages/cli/src/agents/claude.ts` 是基于 `@anthropic-ai/claude-agent-sdk` 的实现。

### 核心流程

```
sendMessage(sessionId, message)
  │
  ├─► emit 'message_start'
  ├─► emit 'session_init'
  │
  ├─► query({ prompt, options })
  │     │
  │     ├─► for await (msg of q)
  │     │     ├─► 'assistant' → emit text_delta / tool_use_start
  │     │     ├─► 'stream_event' → handle content_block_delta
  │     │     └─► 'result' → emit assistant_complete
  │     │
  │     └─► interrupt / stop
  │
  └─► emit 'error' on exception
```

### 事件映射

SDK 事件 → AgentEvent：

| SDK msg.type | AgentEvent.type | 说明 |
|-------------|-----------------|------|
| `assistant` (content: text) | `text_delta` | 文本输出 |
| `assistant` (content: tool_use) | `tool_use_start` + `tool_use_input_delta` | 工具调用 |
| `stream_event` (content_block_delta, thinking_delta) | `thinking_delta` | 思考内容 |
| `stream_event` (content_block_delta, text_delta) | `text_delta` | 文本增量 |
| `stream_event` (content_block_start, tool_use) | `tool_use_start` | 工具块开始 |
| `stream_event` (content_block_start, thinking) | `thinking_start` | 思考块开始 |
| `system` (subtype: init) | `session_init` | 初始化 |
| `result` (subtype: error_*) | `error` | 错误 |
| `result` | `assistant_complete` | 完成 |
| - | `raw_stream_event` | 原始事件透传 |

### 多会话管理

`ClaudeAgent` 内部维护 `Map<sessionId, ClaudeSession>`，支持多并发会话。

### interrupt / stop

- `interrupt()` 调用 `query.interrupt()` 中断当前迭代
- `stop()` 调用 `query.close()` 完全停止查询
