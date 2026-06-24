# Socket.IO 通信协议

守护进程默认监听端口 **19999**，与 Web 前端通过 Socket.IO 进行双向通信。

## 连接

```
socket.connect(`http://localhost:19999`)
```

## 请求 / 响应模式

Socket.IO 支持两种调用方式：
1. **Ack 回调**：发送时带回调函数，服务端返回结果
2. **事件推送**：服务端主动推送事件到客户端

## Socket.IO 事件列表

### 客户端 → 服务端

| 事件名 | 请求类型 | 说明 |
|-------|---------|------|
| `session:create` | `CreateSessionRequest` | 创建新会话 |
| `session:send` | `SendMessageRequest` | 发送消息 |
| `session:interrupt` | `SessionRequest` | 中断当前运行 |
| `session:stop` | `SessionRequest` | 停止会话 |
| `session:list` | - | 获取所有会话列表 |
| `session:delete` | `SessionRequest` | 删除会话 |
| `session:voice_reply` | `SendVoiceReplyRequest` | 发送语音回复请求（触发 TTS 合成） |

### 服务端 → 客户端

| 事件名 | 响应类型 | 说明 |
|-------|---------|------|
| `session:created` | `SessionCreatedResponse` | 会话创建成功（推送） |
| `session:event` | `SessionEventResponse` | 运行时事件（推送） |

## 请求 / 响应类型

### CreateSessionRequest

```typescript
interface CreateSessionRequest {
  id?: string;       // 自定义 session ID，默认自动生成 UUID
  engine?: string;   // Agent 引擎，默认 'claude'
  cwd?: string;      // 工作目录，默认当前目录
  model?: string;    // Claude 模型，如 'claude-sonnet-4-20250514'
}
```

### SendMessageRequest

```typescript
interface SendMessageRequest {
  sessionId: string;
  message: string;   // 用户输入的文本消息
}
```

### SessionRequest

```typescript
interface SessionRequest {
  sessionId: string;
}
```

### SendVoiceReplyRequest

```typescript
interface SendVoiceReplyRequest {
  sessionId: string;
  message: string;   // 要进行语音回复的文本消息
}
```

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

### SessionEventResponse

参见 [会话事件](session-events.md)。

### SessionErrorResponse

```typescript
interface SessionErrorResponse {
  sessionId: string;
  error: string;
}
```

## 使用示例

### 创建会话

```typescript
socket.emit('session:create', { cwd: '/project' }, (res: SessionCreatedResponse) => {
  console.log('Session created:', res.session.id);
});

socket.on('session:created', (res: SessionCreatedResponse) => {
  console.log('Session created (push):', res.session.id);
});
```

### 发送消息

```typescript
socket.emit('session:send', { sessionId: '...', message: 'Hello' }, (res) => {
  if (res.error) console.error('Error:', res.error);
});
```

### 获取会话列表

```typescript
socket.emit('session:list', {}, (res: SessionListResponse) => {
  console.log('Sessions:', res.sessions);
});
```

### 中断运行

```typescript
socket.emit('session:interrupt', { sessionId: '...' }, (res) => {
  console.log('Interrupted:', res.ok);
});
```
