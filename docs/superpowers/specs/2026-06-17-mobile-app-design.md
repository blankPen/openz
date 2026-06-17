# OpenZ 移动端 App 设计文档

**日期**: 2026-06-17
**状态**: 待用户复核
**范围**: 新增 `@openz/mobile` 包,Expo (managed) iOS + Android 双端 App,通过 `packages/server`(relay)与 `packages/cli`(daemon)通信

---

## 1. 背景与目标

`openz` 项目当前已有 web 控制台(React + Vite + socket.io-client),用户希望增加移动端 App,实现在手机上远程操控 Claude Agent 会话、收听 TTS 语音回复。

**目标**

- 在 iOS + Android 双端提供与 Web 端对齐的会话管理/聊天/TTS 体验
- MVP 阶段不引入新功能,只把 Web 核心能力搬到手机
- 复用 `packages/shared` 协议类型,运行时不依赖 Node 内置模块

**非目标(MVP 不做)**

- 推送通知(APNs/FCM)
- 离线消息缓存
- 多账号/鉴权
- 局域网直连 daemon(只能走 relay)
- 视频通话、文件上传、Camera 输入等富交互

---

## 2. 关键决策(澄清结论汇总)

| 维度 | 决策 |
|---|---|
| 平台 | iOS + Android 双端 |
| 拓扑 | 仅走 `packages/server` relay,不支持 LAN 直连 daemon |
| MVP 功能 | 会话列表 + 聊天核心 + TTS 播放 + Tool use 可视化 |
| 脚手架 | Expo SDK 52(managed workflow) |
| 鉴权 | 无(MVP 信任网络) |
| 音频 | `react-native-audio-api`(Web Audio 语义) |
| 导航 | Expo Router(file-based) |
| 状态 | React Query(server state) + Zustand(UI state) |
| 代码复用 | Mobile 完全独立,仅通过 `import type` 复用 `@openz/shared` |
| Monorepo 集成 | `packages/mobile`,与现有 5 个包同级 |

---

## 3. 整体架构

```
┌────────────────┐        Socket.IO          ┌─────────────────────┐
│ packages/mobile│ ─────── WebSocket ──────▶ │ packages/server     │
│  (Expo App)    │ ◀─────── events ───────── │  (relay, 19998)     │
└────────────────┘                           └─────────┬───────────┘
                                                      │ Socket.IO
                                                      ▼
                                            ┌─────────────────────┐
                                            │ packages/cli        │
                                            │  (daemon, 19999)    │
                                            └─────────────────────┘
```

- Mobile 不直连 daemon,所有事件经 server 中转
- 协议事件:`session:create` / `session:send` / `session:event` / `session:list` / `tts:start` / `tts:event` / `tts:audio`,与 web 端一致
- 类型定义来自 `@openz/shared`,通过 `import type` 引入,运行时不参与打包

---

## 4. 项目结构

```
openz/
├── packages/
│   ├── cli/                  # 现有,不动
│   ├── server/               # 现有,不动
│   ├── web/                  # 现有,不动
│   ├── shared/               # 现有,不动(mobile 仅 import type)
│   ├── speech/               # 现有,不动
│   └── mobile/               # 新增
│       ├── app/                      # Expo Router 路由
│       │   ├── _layout.tsx           # 根布局:Provider 链 + Stack
│       │   ├── index.tsx             # 启动页:判断 serverUrl → 跳转
│       │   ├── settings.tsx          # 设置:输入 relay server URL
│       │   └── chat/
│       │       ├── index.tsx         # 会话列表
│       │       └── [id].tsx          # 聊天详情
│       ├── src/
│       │   ├── components/
│       │   │   ├── MessageBubble.tsx
│       │   │   ├── MarkdownView.tsx
│       │   │   ├── ChatInput.tsx
│       │   │   ├── ToolUseBadge.tsx
│       │   │   ├── TtsIndicator.tsx
│       │   │   ├── SessionListItem.tsx
│       │   │   └── ServerUrlForm.tsx
│       │   ├── hooks/
│       │   │   ├── useSocket.ts
│       │   │   ├── useSessions.ts
│       │   │   ├── useSessionStream.ts
│       │   │   └── useTtsClient.ts
│       │   ├── lib/
│       │   │   ├── socket.ts         # Socket.IO 单例 + 重连/退避
│       │   │   ├── audio-player.ts   # react-native-audio-api PCM player
│       │   │   └── eventReducer.ts   # 纯函数:累积 session:event
│       │   ├── stores/
│       │   │   ├── settingsStore.ts  # zustand + MMKV 持久化
│       │   │   └── connectionStore.ts
│       │   ├── queries/
│       │   │   └── sessions.ts       # React Query hooks
│       │   ├── types.ts              # 重新导出 @openz/shared 的类型
│       │   └── theme.ts              # 颜色/间距常量
│       ├── app.json                  # Expo 配置
│       ├── eas.json                  # EAS Build 配置
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
```

`pnpm-workspace.yaml` 保持 `packages/*` 不动,自然覆盖 `packages/mobile`。

---

## 5. 依赖清单(`packages/mobile/package.json`)

```json
{
  "name": "@openz/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "expo-router/entry",
  "dependencies": {
    "@openz/shared": "workspace:*",
    "expo": "~52.0.0",
    "expo-router": "~4.0.0",
    "expo-constants": "~17.0.0",
    "expo-linking": "~7.0.0",
    "react": "18.3.1",
    "react-native": "0.76.x",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0",
    "socket.io-client": "^4.7.5",
    "@tanstack/react-query": "^5.x",
    "zustand": "^5.x",
    "react-native-audio-api": "^0.x",
    "react-native-mmkv": "^3.x",
    "react-native-get-random-values": "~1.x",
    "uuid": "^11.x",
    "react-native-markdown-display": "^7.x"
  },
  "devDependencies": {
    "@types/react": "~18.3.12",
    "@types/uuid": "^10.0.0",
    "typescript": "^5.6.0",
    "jest": "^29.x",
    "jest-expo": "~52.0.0",
    "@testing-library/react-native": "^12.x",
    "@testing-library/react-hooks": "^8.x"
  }
}
```

根 `package.json` 追加脚本:

```json
{
  "scripts": {
    "dev:mobile": "pnpm --filter @openz/mobile start",
    "typecheck": "pnpm -r typecheck"
  }
}
```

---

## 6. 核心模块职责

| 模块 | 文件 | 职责 | 关键 API |
|---|---|---|---|
| `SocketClient` | `src/lib/socket.ts` | Socket.IO 单例,封装连接/重连/重订阅 | `connect(url)` / `disconnect()` / `emit()` / `on()/off()` |
| `useSocket` | `src/hooks/useSocket.ts` | React hook,订阅 `connect`/`disconnect`/`connect_error` | `{ status, lastError, reconnectAttempts }` |
| `useSessions` | `src/hooks/useSessions.ts` | React Query 包装 `session:list` | `{ sessions, isLoading, refresh() }` |
| `useSessionStream` | `src/hooks/useSessionStream.ts` | 订阅 `session:event`,通过纯函数 reducer 累积 | `{ messages, send(), interrupt() }` |
| `useTtsClient` | `src/hooks/useTtsClient.ts` | 订阅 `tts:event`/`tts:audio`,喂 PCMPlayer | `{ connect(sid), disconnect(), playing }` |
| `PCMPlayer` | `src/lib/audio-player.ts` | `react-native-audio-api` 包装 | `feed(bytes)` / `clear()` / `destroy()` / `onplaystate` |
| `eventReducer` | `src/lib/eventReducer.ts` | 纯函数:输入 `AgentEvent` 序列,输出消息数组 | `reduce(state, event) → state` |
| `settingsStore` | `src/stores/settingsStore.ts` | zustand + MMKV,存 `serverUrl` / `lastSessionId` | `useSettings()` |
| `connectionStore` | `src/stores/connectionStore.ts` | zustand,存连接态(供 UI 显示) | `useConnection()` |
| `MessageBubble` | `src/components/MessageBubble.tsx` | 单条消息渲染,含 Markdown + Tool 指示 | — |
| `MarkdownView` | `src/components/MarkdownView.tsx` | 包装 `react-native-markdown-display` | — |
| `ToolUseBadge` | `src/components/ToolUseBadge.tsx` | 工具调用指示 | — |
| `TtsIndicator` | `src/components/TtsIndicator.tsx` | "正在播放"指示 | — |
| `ChatInput` | `src/components/ChatInput.tsx` | 输入框 + 发送按钮 | — |
| `SessionListItem` | `src/components/SessionListItem.tsx` | 会话列表项 | — |
| `ServerUrlForm` | `src/components/ServerUrlForm.tsx` | Settings 页表单,带 URL 格式校验 | — |

**关注点分离原则**

- `socket.ts` 是唯一与 socket.io-client 直接交互的模块
- Hook 各自只关心一种数据流(socket 状态 / 会话列表 / 单 session 事件流 / TTS 播放)
- `eventReducer` 是纯函数,可独立单测
- `PCMPlayer` 不感知 socket,只接受 `feed(bytes)` 和 `clear()`

---

## 7. 数据流

### 7.1 启动 → 连接

```
[App 启动]
   │
   ▼
app/index.tsx
   │
   ├─ 读 settingsStore.serverUrl
   │   ├─ 存在 → socket.connect(url) → 根据 session:list 成功与否跳 /chat 或 /settings
   │   └─ 不存在 → 跳 /settings
   │
   ▼
socket.ts.connect(serverUrl)
   │
   ├─ socket.io-client 默认重连
   ├─ 失败 → connectionStore.lastError 更新,Settings 页可重试
   └─ 成功 → connectionStore.status = 'connected'
```

### 7.2 会话列表(React Query)

```
useSessions()
   ├─ queryKey: ['sessions']
   ├─ queryFn: socket emit 'session:list' → resolve res.sessions
   ├─ staleTime: 30s
   └─ enabled: connectionStore.status === 'connected'
```

### 7.3 聊天详情(进入 `/chat/[id]`)

```
进入路由 /chat/[id]
   │
   ▼
useSessionStream(id)
   ├─ 注册 socket.on('session:event', filter(id))
   ├─ 累积器(eventReducer):
   │   - message_start   → push { role: 'assistant', content: '', toolUses: [] }
   │   - text_delta      → 追加到最后一个 message.content
   │   - thinking_delta  → 累积到 message.thinking
   │   - tool_use_start  → push { name, status: 'running' }
   │   - tool_result     → 更新对应 toolUse.status = 'done'
   │   - turn_done       → message.status = 'done'
   │   - error           → message.status = 'error'
   │
   ▼
useTtsClient.connect(id)  // 注册 tts:event / tts:audio 监听
   │
   ▼
[socket 推 session:event 帧 → reducer → state 更新 → React 重渲染]
```

### 7.4 发送消息

```
ChatInput.onSend(text)
   │
   ▼
useSessionStream.send(text)
   ├─ 立即插入 { role: 'user', content: text, status: 'done' }
   ├─ socket.emit('session:send', { sessionId: id, message: text })
   └─ 失败:回滚 + 自动重试 1 次 + toast
```

### 7.5 TTS 播放

```
ChatView 显示 🔊 按钮
   │
   ▼
点击 → socket.emit('tts:start', { sessionId: id })
   │
   ▼
useTtsClient.connect(id)  // ChatView mount 时已调
   ├─ socket.on('tts:event', filter(id))
   │   - session_start / chunk / first_frame / end → 仅 log
   │   - error → toast
   │
   └─ socket.on('tts:audio', (meta, buffer) => {
        if (meta.sessionId !== id) return
        PCMPlayer.feed(new Uint8Array(buffer))
      })
   │
   ▼
react-native-audio-api AudioContext 实时解码并播放
   │
   ▼
PCMPlayer.onplaystate(isPlaying) → useTtsClient.playing → TtsIndicator UI
```

### 7.6 后台 / 前台切换

```
AppState.addEventListener('change', (state) => {
  if (state === 'background') {
    PCMPlayer.clear()
    socket.io.opts.reconnection = false
  }
  if (state === 'active') {
    socket.io.opts.reconnection = true
    socket.connect()                  // 强制重连
    queryClient.invalidateQueries(['sessions'])
  }
})
```

---

## 8. 错误处理

| 触发 | 现象 | 行为 |
|---|---|---|
| `connect_error` | 连接失败 | `connectionStore.lastError` 更新,Settings 页可重试 |
| `session:send` ack.error | 发送失败 | 回滚消息,自动重试 1 次,再失败则 toast |
| `session:event.type === 'error'` | LLM 报错 | 当前 message.status = 'error',MessageBubble 红色边框 |
| `tts:event.type === 'error'` | TTS 报错 | toast 提示,自动 `tts:start` 1 次 |
| `tts:audio` 帧解码失败 | 音频损坏 | 丢弃该帧,log.warn 一次,继续 |
| App 后台 30s+ socket 断开 | 前台恢复 | `socket.connect()` 强制重连,React Query `invalidateQueries` |

---

## 9. 类型共享策略

**问题**:`packages/shared/src/types.ts` 含 `import { randomUUID } from 'node:crypto'`,RN 运行时无 `node:crypto`,会打包失败。

**方案**:

- Mobile 仅用 `import type { Session, AgentEvent, ... } from '@openz/shared'`,编译后 `import type` 被擦除
- 运行时 ID 生成用 `uuid` + `react-native-get-random-values` polyfill(在 `_layout.tsx` 顶层 `import 'react-native-get-random-values'`)
- Mobile 不使用 `@openz/shared` 的 `generateSessionId` 函数
- **不修改** `@openz/shared`

---

## 10. 测试策略

| 层 | 工具 | 覆盖 |
|---|---|---|
| 单元测试 | Jest + ts-jest | `eventReducer` 各种事件序列;`socket.ts` 重连/过滤 |
| Hook 测试 | `@testing-library/react-hooks` | `useSocket` 状态机;`useSessionStream` 模拟事件流 |
| 组件测试 | `@testing-library/react-native` | `MessageBubble` 状态分支;`ServerUrlForm` 校验 |
| 集成验证 | EAS Development Build | iOS 真机 + Android 真机端到端 |

**MVP 不覆盖**

- E2E(Maestro / Detox)— 等核心稳定再加
- 性能压测 — 沿用 web 的 24000Hz 单声道配置,真机观察

**重点测试用例**

- `eventReducer`:
  - 单次完整回合(message_start → 多 text_delta → turn_done)
  - 多工具调用并行
  - 异常事件穿插(error 在 turn_done 之前/之后)
  - thinking 与 text 交替
- `socket.ts`:
  - 事件过滤(`sessionId !== activeId` 丢弃)
  - 重连后重订阅(防止订阅丢失)
  - 离线 emit 队列(暂不实现,只测重连)

---

## 11. 构建与分发

| 阶段 | 命令 | 产物 |
|---|---|---|
| 本地开发 | `pnpm dev:mobile` | Expo Dev Client,iOS Sim / Android Emu |
| 类型检查 | `pnpm --filter @openz/mobile exec tsc --noEmit` | 0 error |
| 开发构建 | `eas build --profile development --platform ios/android` | 装到真机的 dev build |
| 预览构建 | `eas build --profile preview --platform ios/android` | TestFlight / Internal Testing |
| 发布构建 | `eas build --profile production --platform ios/android` | App Store / Google Play |
| OTA 更新 | `eas update --branch production` | JS 层热修,绕商店审核(紧急修复用) |

**`eas.json` 草案**:

```json
{
  "build": {
    "development": { "developmentClient": true, "distribution": "internal" },
    "preview":     { "distribution": "internal" },
    "production":  {}
  },
  "submit": {
    "production": {
      "ios":     { "ascAppId": "<TBD>" },
      "android": { "track": "internal" }
    }
  }
}
```

**CI(后续单独 spec)— MVP 不强制**

- PR 触发 `pnpm -r typecheck` + `pnpm --filter @openz/mobile test`
- main 分支触发 `eas build --profile preview`

---

## 12. 风险与缓解

| 风险 | 影响 | 缓解 |
|---|---|---|
| `react-native-audio-api` 在新 Expo SDK 上兼容性 | 静音/无音频 | 脚手架阶段先做最小播放 demo 验证;失败则降级到 `expo-av` |
| `socket.io-client` 在 RN 环境下二进制帧性能 | TTS 帧延迟 | 复用 web 端 24000Hz 单声道配置;真机观察延迟 |
| 后台 socket 断开未恢复 | 用户开 App 看到陈旧数据 | 前台时强制 `socket.connect()` + `invalidateQueries` |
| `node:crypto` 误入打包 | 启动崩溃 | 仅用 `import type`;`react-native-get-random-values` polyfill |
| EAS 首次构建配置踩坑 | 推迟发布 | 脚手架阶段就跑一次 development 构建验证链路 |

---

## 13. 后续扩展(MVP 之后,本 spec 不实现)

- 推送通知(APNs/FCM,需要 server 端配合)
- 多账号/鉴权(OAuth 或静态 token)
- 局域网直连 daemon(Bonjour/mDNS 发现)
- 离线消息缓存(SQLite/WatermelonDB)
- 语音输入(STT)
- E2E 测试(Maestro/Detox)
- 性能压测与优化
