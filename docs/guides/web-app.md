# Web 控制台

Web 控制台是 Uran 项目的可视化界面，基于 React 开发，位于 `packages/web`。

## 界面布局

```
┌──────────────────────────────────────────┐
│  Header: Uran                            │
├─────────────────────┬────────────────────┤
│                     │                    │
│   会话列表          │   聊天区域          │
│   (sidebar)         │   (ChatView)        │
│                     │                    │
│                     │                    │
├─────────────────────┼────────────────────┤
│  输入框            │   发送按钮          │
└─────────────────────┴────────────────────┘
```

## 核心组件

### ChatView (`components/ChatView.tsx`)

主聊天界面，包含消息列表和输入框。

### Message (`components/Message.tsx`)

单条消息展示，支持：
- 用户消息（右侧）
- Agent 消息（左侧）
- Markdown 渲染
- 工具调用显示

### MarkdownRenderer (`components/MarkdownRenderer.tsx`)

将 Agent 返回的 Markdown 内容渲染为 HTML。

### useSocket (`hooks/useSocket.ts`)

Socket.IO 连接管理 hook，处理：
- 连接建立
- 会话事件接收
- 消息发送
- 错误处理

## Socket.IO 事件流

### 连接流程

```
1. useSocket 初始化 → socket.connect()
2. socket.on('connect') → 创建或恢复会话
3. socket.on('session:created') → 更新当前 sessionId
4. socket.on('session:event') → 渲染事件到 UI
```

### 发送消息

```
1. 用户输入 → socket.emit('session:send', { sessionId, message })
2. socket.on('session:event') → 实时显示 thinking / text_delta
3. socket.on('session:event') → 收到 assistant_complete → 结束
```

## 状态管理

当前实现使用 React local state，主要状态：

| 状态 | 类型 | 说明 |
|------|------|------|
| `messages` | `Message[]` | 当前会话消息列表 |
| `sessionId` | `string` | 当前会话 ID |
| `connected` | `boolean` | Socket 连接状态 |
| `input` | `string` | 输入框内容 |

## 消息类型

```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}
```
