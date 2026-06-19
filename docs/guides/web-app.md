# Web 控制台

Web 控制台是 Openz 项目的可视化界面，基于 React 开发，位于 `packages/web`。

## 界面布局

```
┌──────────────────────────────────────────┐
│  Header: Openz                           │
├─────────────────────┬────────────────────┤
│                     │                    │
│   Sidebar           │   主内容区          │
│   (会话列表)        │   (根据路由显示)    │
│                     │                    │
│                     │                    │
├─────────────────────┴────────────────────┤
└──────────────────────────────────────────┘
```

## 页面路由

采用 Hash 路由模式：

| 路径 | 页面 | 说明 |
|------|------|------|
| `/#home` | HomeScreen | 首页，展示会话列表 |
| `/#conversation` | ConversationScreen | 聊天会话页面 |
| `/#settings` | SettingsScreen | 设置页面 |

## 核心页面

### HomeScreen (`screens/HomeScreen.tsx`)

首页，展示会话列表和创建新会话入口。

### ConversationScreen (`screens/ConversationScreen.tsx`)

聊天会话界面，包含：
- 消息列表（支持流式输出）
- 输入框
- 思考气泡（可折叠 + 编号步骤）
- 模型切换按钮
- 附件按钮

### SettingsScreen (`screens/SettingsScreen.tsx`)

设置页面，提供模型选择等配置。

## 核心组件

### ModelSwitchModal (`components/ModelSwitchModal.tsx`)

模型切换弹窗，支持选择不同的 Claude 模型。

### AttachmentModal (`components/AttachmentModal.tsx`)

附件上传弹窗，支持添加文件附件到对话。

### ChatView (`components/ChatView.tsx`)

主聊天界面，包含消息列表和输入框（保留用于兼容）。

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

## 流式输出状态

在 Agent 响应过程中，界面显示：
- 思考气泡（可折叠，显示思考步骤）
- 'OpenZ 正在回复…' 加载提示
- spinner 动画

## 历史会话恢复

Web 端支持恢复历史会话：
- `session:list` 获取会话列表
- `session:create` 可指定 `id` 恢复已有会话
- 断开重连后自动尝试恢复上次会话
