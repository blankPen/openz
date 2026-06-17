# Session Events

守护进程通过 Socket.IO 的 `session:event` 事件向客户端推送 Agent 运行时的各种事件。

## 事件格式

所有事件均为 `SessionEventResponse` 类型：

```typescript
interface SessionEventResponse {
  sessionId: string;
  event: AgentEvent;
}
```

## AgentEvent 类型

```typescript
type AgentEvent =
  | { type: 'session_init'; sessionId: string; data: any }
  | { type: 'message_start'; sessionId: string; data: { messageId: string } }
  | { type: 'text_delta'; sessionId: string; data: { text: string } }
  | { type: 'thinking_start'; sessionId: string; data: any }
  | { type: 'thinking_delta'; sessionId: string; data: { text: string } }
  | { type: 'tool_use_start'; sessionId: string; data: any }
  | { type: 'tool_use_input_delta'; sessionId: string; data: any }
  | { type: 'assistant_complete'; sessionId: string; data: any }
  | { type: 'tool_result'; sessionId: string; data: any }
  | { type: 'turn_done'; sessionId: string; data: any }
  | { type: 'raw_stream_event'; sessionId: string; data: any }
  | { type: 'error'; sessionId: string; data: { error: string } }
  | { type: 'voice_audio'; sessionId: string; data: { data: string | null } }
  | { type: 'voice_reply_finish'; sessionId: string; data: any };
```

## 事件说明

| 事件类型 | 说明 |
|---------|------|
| `session_init` | Session 初始化完成 |
| `message_start` | 用户消息开始处理，`messageId` 为消息唯一标识 |
| `text_delta` | 文本增量输出，`data.text` 为本轮追加的文本 |
| `thinking_start` | Claude 开始思考 |
| `thinking_delta` | 思考内容增量输出 |
| `tool_use_start` | 开始调用工具 |
| `tool_use_input_delta` | 工具输入参数增量（JSON 格式） |
| `assistant_complete` | Assistant 消息块处理完成 |
| `tool_result` | 工具执行结果 |
| `turn_done` | 轮次结束 |
| `raw_stream_event` | 原始 SDK 流事件（调试用） |
| `error` | 发生错误，`data.error` 为错误信息 |
| `voice_audio` | 语音音频数据块（base64），通过 `session:voice_reply` 请求触发 |
| `voice_reply_finish` | 语音回复完成 |

## 使用示例

```typescript
socket.on('session:event', (response: SessionEventResponse) => {
  const { sessionId, event } = response;

  switch (event.type) {
    case 'text_delta':
      appendToMessage(sessionId, event.data.text);
      break;
    case 'thinking_delta':
      showThinkingIndicator();
      break;
    case 'tool_use_start':
      showToolUseIndicator(event.data);
      break;
    case 'error':
      showError(event.data.error);
      break;
  }
});
```
