# Session 管理规范

## SessionManager

`packages/cli/src/daemon/session.ts` 中的 `SessionManager` 负责会话的生命周期管理。

### 持久化

会话元数据持久化到 `~/.openz/sessions.json`：

```typescript
const SESSIONS_FILE = join(process.env.HOME || '/tmp', '.openz', 'sessions.json');
```

**注意**：`agentSession`（实际的 Agent 运行时）无法序列化重连，仅保存 `Session` 元数据。Daemon 重启后，已存会话的 `status` 会标记为 `disconnected`。

### 状态流转

```
createSession()
  │
  ├─► 检查是否存在（从磁盘恢复）
  │     └─► 存在且有 agentSession → 复用，status = idle
  │     └─► 不存在或无 agentSession → 创建新会话
  │
  └─► agent.createSession() → agentSession 创建
        └─► sessions.set(id, { session, agentSession, onEvent })
              └─► saveSessions()

sendMessage(sessionId, message)
  │
  ├─► 检查 agentSession 是否存在
  │     └─► 不存在（如 daemon 重启后）→ 重建 agentSession
  │
  ├─► 更新 onEvent 回调
  └─► agent.sendMessage()

updateSessionStatus(id, status)
  └─► entry.session.status = status
        └─► saveSessions()

deleteSession(sessionId)
  │
  ├─► agentSession?.stop()
  └─► sessions.delete(id)
        └─► saveSessions()
```

### 磁盘加载

Daemon 启动时 `loadSessions()` 从 `sessions.json` 读取所有会话元数据：

- 无法恢复 `agentSession`，设为 `null`
- 将所有会话的 `status` 强制设为 `disconnected`
- 实际会话在 `sendMessage` 时重建

### 事件传播

`SessionManager.setOnEvent(sessionId, onEvent)` 用于更新会话的事件回调。`sendMessage` 时会先将 `onEvent` 指向 socket 对应回调，再调用 `agent.sendMessage()`，确保事件流向正确的客户端。
