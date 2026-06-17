# OpenZ 移动端 App 设计文档

**日期**: 2026-06-17
**状态**: 待用户复核
**范围**: 新增 `@openz/mobile` 包,Expo (managed) iOS + Android 双端 App,通过 `packages/server`(relay)与 `packages/cli`(daemon)通信
**设计来源**: Open Design 项目 `9cc2af0a-c292-4a13-a16f-60ad115d51d8` 的 5 个 HTML 屏 (`home.html` / `model-switch.html` / `attachment.html` / `conversation.html` / `settings.html`)

---

## 1. 背景与目标

`openz` 项目当前已有 web 控制台(React + Vite + socket.io-client),用户希望增加移动端 App,实现在手机上远程操控 Claude Agent 会话、收听 TTS 语音回复。

**目标**

- 在 iOS + Android 双端提供与 Web 端对齐的会话管理/聊天/TTS 体验
- **设计稿优先**:MVP 阶段先按设计稿(详见 §15)1:1 复刻 UI,数据先用 Mock,后端连线后续迭代
- 复用 `packages/shared` 协议类型,运行时不依赖 Node 内置模块

**3 阶段推进方法论**

1. **阶段 1 · 脚手架**:搭建 Expo + Expo Router + Provider 链 + 主题系统 + 路由/导航/状态管理基础设施,页面无关
2. **阶段 2 · UI 复刻**:按设计稿 1:1 还原 5 屏 UI(首页/模型切换面板/附件面板/对话进行态/侧边设置抽屉),全部使用 Mock 数据
3. **阶段 3 · 功能连线**:按 §7 数据流逐步替换 Mock 为真实 socket/React Query 流,接上 daemon 与 relay server

**非目标(全阶段都不做,留待后续扩展)**

- 推送通知(APNs/FCM)
- 离线消息缓存
- 多账号/OAuth 鉴权
- 局域网直连 daemon(只能走 relay)
- 视频通话、文件上传、Camera 输入等富交互

---

## 2. 关键决策(澄清结论汇总)

| 维度 | 决策 |
|---|---|
| 平台 | iOS + Android 双端 |
| 拓扑 | 仅走 `packages/server` relay,不支持 LAN 直连 daemon |
| 设计稿 | Open Design 项目 5 个 HTML 屏,1:1 复刻为目标;**Mock 数据先行**,后端后续迭代 |
| 阶段 2 范围 | 5 屏(首页/模型切换/附件/对话/设置)+ 3 模式主题(浅/深/自动) |
| 路由形态 | 单 Chat 屏(无 session list 独立页),设置走 Drawer,模型切换/附件走 Bottom Sheet |
| 脚手架 | Expo SDK 52(managed workflow) |
| 鉴权 | 无(MVP 信任网络) |
| 音频 | `react-native-audio-api`(Web Audio 语义) |
| 导航 | Expo Router(file-based) + 模态(Drawer + Bottom Sheet) |
| 状态 | React Query(server state) + Zustand(UI/theme/settings) |
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

> **路由形态已根据设计稿调整**:不再有独立的 session list 页和 chat 详情页 — 全部对话在单 Chat 屏完成(空闲态=设计稿 home 区域,进行态=设计稿 conversation 区域);设置走 Drawer;模型切换/附件走 Bottom Sheet。

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
│       │   ├── _layout.tsx           # 根布局:Provider 链 + Stack + ThemeProvider
│       │   ├── index.tsx             # 启动页:判断 serverUrl → 跳 /chat
│       │   └── chat.tsx              # Chat 屏(idle/active 两态切换)
│       ├── src/
│       │   ├── components/
│       │   │   ├── chrome/                   # iPhone 14 Pro 框架层(可在真机 Build 关掉)
│       │   │   │   ├── StatusBar.tsx        # 顶部状态栏(9:41 + 信号/wifi/电池)
│       │   │   │   ├── DynamicIsland.tsx     # 灵动岛
│       │   │   │   └── HomeIndicator.tsx    # 底部横条
│       │   │   ├── topbar/
│       │   │   │   ├── TopBar.tsx           # 顶部导航栏(汉堡 + model pill + 语音/通话/新建)
│       │   │   │   ├── ModelPill.tsx        # 模型切换 pill
│       │   │   │   └── IconButton.tsx       # 圆形图标按钮
│       │   │   ├── welcome/
│       │   │   │   ├── WelcomeCard.tsx      # 头像 + 招呼语
│       │   │   │   ├── Avatar.tsx           # 渐变圆形头像 + Z 标志
│       │   │   │   └── Greeting.tsx         # "嗨 Alex,今天要和 OpenZ 一起做点什么?"
│       │   │   ├── recommendations/
│       │   │   │   ├── RecommendationCard.tsx  # 3 张渐变卡(蓝/橙/紫)
│       │   │   │   └── RecommendationList.tsx  # 列表容器
│       │   │   ├── shortcuts/
│       │   │   │   ├── AgentShortcut.tsx       # 76×76 圆形 icon + 名称
│       │   │   │   └── ShortcutRail.tsx        # 横滑容器
│       │   │   ├── input/
│       │   │   │   ├── ChatInputBox.tsx        # F2F2F2 圆角输入盒
│       │   │   │   ├── TextField.tsx           # 多行自适应
│       │   │   │   ├── MicButton.tsx
│       │   │   │   ├── AttachmentButton.tsx
│       │   │   │   └── SendButton.tsx
│       │   │   ├── sheets/
│       │   │   │   ├── BottomSheet.tsx         # 通用底部弹出层(handle + 标题 + 关闭)
│       │   │   │   ├── ModelSwitchSheet.tsx   # 模型切换面板
│       │   │   │   └── AttachmentSheet.tsx    # 附件面板
│       │   │   ├── drawer/
│       │   │   │   ├── SettingsDrawer.tsx     # 左侧抽屉
│       │   │   │   ├── UserCard.tsx
│       │   │   │   ├── MenuSection.tsx
│       │   │   │   ├── MenuItem.tsx
│       │   │   │   ├── ThemeToggle.tsx        # 3 段(浅/深/自动)
│       │   │   │   ├── Switch.tsx
│       │   │   │   └── LogoutButton.tsx
│       │   │   ├── conversation/
│       │   │   │   ├── MessageFlow.tsx        # 消息流容器(scroll)
│       │   │   │   ├── UserBubble.tsx         # 用户气泡(蓝底白字 + 可选 quote-tag)
│       │   │   │   ├── AIHeader.tsx           # AI 标识行(头像 + 名字 + 模式)
│       │   │   │   ├── ThinkingBubble.tsx     # 思考气泡(可展开/折叠)
│       │   │   │   ├── ThinkingStepList.tsx
│       │   │   │   ├── AIBubble.tsx           # AI 基础回复(Markdown)
│       │   │   │   ├── ToolUseCard.tsx        # 工具调用卡片(可折叠)
│       │   │   │   ├── SourceList.tsx         # 工具源列表
│       │   │   │   ├── QuoteTag.tsx           # "回复 @OpenZ" 标签
│       │   │   │   ├── StatusLine.tsx         # "OpenZ 正在回复…"
│       │   │   │   ├── BlinkingCursor.tsx     # 流式打字光标
│       │   │   │   └── AIActions.tsx          # 4 项操作(复制/点赞/重新生成/分享)
│       │   │   └── common/
│       │   │       ├── Watermark.tsx          # "内容由 AI 生成"
│       │   │       └── Icon.tsx               # 内联 SVG icon 集合
│       │   ├── hooks/
│       │   │   ├── useSocket.ts                # 阶段 3
│       │   │   ├── useSessions.ts              # 阶段 3
│       │   │   ├── useSessionStream.ts         # 阶段 3
│       │   │   ├── useTtsClient.ts             # 阶段 3
│       │   │   ├── useTheme.ts                 # 阶段 1
│       │   │   ├── useChatState.ts             # 阶段 2(idle ↔ active)
│       │   │   └── useMockData.ts              # 阶段 2(Mock 数据 hook)
│       │   ├── lib/
│       │   │   ├── socket.ts                   # 阶段 3
│       │   │   ├── audio-player.ts             # 阶段 3
│       │   │   └── eventReducer.ts             # 阶段 3
│       │   ├── stores/
│       │   │   ├── settingsStore.ts            # 阶段 1(theme/font/lang/enterToSend/voiceBroadcast/...)
│       │   │   ├── modelStore.ts               # 阶段 2(当前选中的 base/mode/personality)
│       │   │   └── connectionStore.ts          # 阶段 3
│       │   ├── data/
│       │   │   └── mock.ts                     # 阶段 2(全部 mock 数据:推荐卡/Agent/模型/最近文件/示例消息)
│       │   ├── theme/
│       │   │   ├── tokens.ts                   # 阶段 1(颜色/字号/圆角/间距)
│       │   │   ├── light.ts                    # 阶段 1
│       │   │   └── dark.ts                     # 阶段 1
│       │   ├── types.ts                        # 重新导出 @openz/shared 的类型
│       │   └── i18n.ts                         # 文案集中
│       ├── app.json                            # Expo 配置
│       ├── eas.json                            # EAS Build 配置
│       ├── package.json
│       ├── tsconfig.json
│       └── README.md
```

`pnpm-workspace.yaml` 保持 `packages/*` 不动,自然覆盖 `packages/mobile`。

**路由对照表(阶段 2 完成时的最终形态)**

| 路径/形态 | 渲染 | 触发方式 |
|---|---|---|
| `app/index.tsx` | 启动入口:检查 settingsStore,如有 serverUrl 跳 `/chat`,无则保留并提示设置 | — |
| `app/chat.tsx` | Chat 屏:空闲态(Welcome + 推荐卡 + Agent 快捷 + 输入区)/进行态(消息流 + 输入区)二选一,基于 `useChatState` 切换 | 启动/新建会话 |
| `SettingsDrawer` | 覆盖在 Chat 之上的左抽屉(非独立路由) | 左上角汉堡按钮 OR 左边缘右滑手势(≥80px) |
| `ModelSwitchSheet` | 覆盖在 Chat 之上的底部 Sheet(非独立路由) | TopBar 的 ModelPill 点击 |
| `AttachmentSheet` | 覆盖在 Chat 之上的底部 Sheet(非独立路由) | ChatInput 的 + 按钮点击 |

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

> **设计稿驱动**:下方表格反映设计稿 1:1 所需的全部组件。阶段 1 仅实现无依赖的原子组件 + 主题,阶段 2 拼装为完整 UI,阶段 3 接入 socket/React Query。

| 模块 | 文件 | 阶段 | 职责 |
|---|---|---|---|
| `ThemeProvider` | `src/theme/ThemeProvider.tsx` | 1 | 3 模式主题(light/dark/system)Provider,基于 `useColorScheme` 跟随系统 |
| `useTheme` | `src/hooks/useTheme.ts` | 1 | 暴露当前 tokens + `setMode(light/dark/system)` |
| `settingsStore` | `src/stores/settingsStore.ts` | 1 | zustand + MMKV,存 serverUrl / theme / fontSize / language / voiceBroadcast / enterToSend / defaultModel |
| `modelStore` | `src/stores/modelStore.ts` | 2 | zustand,存当前选中的 base / mode / personality id |
| `useChatState` | `src/hooks/useChatState.ts` | 2 | 暴露 `{ mode: 'idle' \| 'active', enterActive(), reset() }` |
| `useMockData` | `src/hooks/useMockData.ts` | 2 | 暴露阶段 2 用的全部静态数据(推荐卡/Agent/模型/最近文件/示例对话) |
| `connectionStore` | `src/stores/connectionStore.ts` | 3 | zustand,存连接态(供 UI 显示) |
| `SocketClient` | `src/lib/socket.ts` | 3 | Socket.IO 单例,封装连接/重连/重订阅 |
| `useSocket` | `src/hooks/useSocket.ts` | 3 | React hook,订阅 `connect`/`disconnect`/`connect_error` |
| `useSessions` | `src/hooks/useSessions.ts` | 3 | React Query 包装 `session:list` |
| `useSessionStream` | `src/hooks/useSessionStream.ts` | 3 | 订阅 `session:event`,通过纯函数 reducer 累积 |
| `useTtsClient` | `src/hooks/useTtsClient.ts` | 3 | 订阅 `tts:event`/`tts:audio`,喂 PCMPlayer |
| `PCMPlayer` | `src/lib/audio-player.ts` | 3 | `react-native-audio-api` 包装,采样参数与 web 端 `PCMPlayer` 对齐 |
| `eventReducer` | `src/lib/eventReducer.ts` | 3 | 纯函数:输入 `AgentEvent` 序列,输出消息数组 |
| `StatusBar` | `src/components/chrome/StatusBar.tsx` | 1 | iOS 状态栏(9:41 + 信号/wifi/电池 SVG) |
| `DynamicIsland` | `src/components/chrome/DynamicIsland.tsx` | 1 | 灵动岛 |
| `HomeIndicator` | `src/components/chrome/HomeIndicator.tsx` | 1 | 底部横条 |
| `TopBar` | `src/components/topbar/TopBar.tsx` | 2 | 顶部导航栏(汉堡 + ModelPill + 语音/通话/新建 3 个 IconButton) |
| `ModelPill` | `src/components/topbar/ModelPill.tsx` | 2 | "OpenZ · Z1 思考 ▾" pill,点击触发 `ModelSwitchSheet` |
| `IconButton` | `src/components/topbar/IconButton.tsx` | 1 | 36×36 圆形透明按钮 |
| `WelcomeCard` | `src/components/welcome/WelcomeCard.tsx` | 2 | 居中容器,纵向 Avatar + Greeting |
| `Avatar` | `src/components/welcome/Avatar.tsx` | 1 | 64×64 渐变蓝圆 + Z 标志 SVG |
| `Greeting` | `src/components/welcome/Greeting.tsx` | 2 | "嗨 <accent>Alex</accent>,今天要和 <accent>OpenZ</accent> 一起做点什么?" |
| `RecommendationCard` | `src/components/recommendations/RecommendationCard.tsx` | 2 | 单张渐变卡(蓝/橙/紫),含 icon + title + sub + CTA 按钮 |
| `RecommendationList` | `src/components/recommendations/RecommendationList.tsx` | 2 | 3 张卡的纵向列表 |
| `AgentShortcut` | `src/components/shortcuts/AgentShortcut.tsx` | 2 | 76px 圆形 icon + 名称(支持 primary 高亮) |
| `ShortcutRail` | `src/components/shortcuts/ShortcutRail.tsx` | 2 | 横滑容器,4+ 工具入口 |
| `ChatInputBox` | `src/components/input/ChatInputBox.tsx` | 2 | F2F2F2 圆角 16px 输入盒,内含 TextField + 3 个按钮 |
| `TextField` | `src/components/input/TextField.tsx` | 1 | 多行自适应 TextInput(min 24 / max 100) |
| `MicButton` / `AttachmentButton` / `SendButton` | `src/components/input/*.tsx` | 1 | 输入区三个圆形按钮 |
| `BottomSheet` | `src/components/sheets/BottomSheet.tsx` | 1 | 通用底部弹出层(handle + 标题 + 关闭),Portal 模式 |
| `ModelSwitchSheet` | `src/components/sheets/ModelSwitchSheet.tsx` | 2 | 3 段分组(基础模型/推理模式/Agent 人格),含选中态 |
| `AttachmentSheet` | `src/components/sheets/AttachmentSheet.tsx` | 2 | 4 入口网格 + 最近文件列表 |
| `SettingsDrawer` | `src/components/drawer/SettingsDrawer.tsx` | 2 | 左侧抽屉(320px),含 UserCard + 4 段菜单 + 退出 |
| `UserCard` | `src/components/drawer/UserCard.tsx` | 2 | 渐变蓝头像 + 用户名 + 套餐标签 |
| `MenuSection` / `MenuItem` | `src/components/drawer/*.tsx` | 2 | 段标题 + 单项菜单(icon + label + value) |
| `ThemeToggle` | `src/components/drawer/ThemeToggle.tsx` | 2 | 3 段式(浅/深/自动)切换,写 settingsStore |
| `Switch` | `src/components/drawer/Switch.tsx` | 1 | 40×24 圆角开关(绿/灰) |
| `LogoutButton` | `src/components/drawer/LogoutButton.tsx` | 2 | 红色退出按钮 |
| `MessageFlow` | `src/components/conversation/MessageFlow.tsx` | 2 | 消息流容器(FlatList,自动滚到底) |
| `UserBubble` | `src/components/conversation/UserBubble.tsx` | 2 | 用户气泡(蓝底白字 18px 圆角 + 可选 QuoteTag) |
| `QuoteTag` | `src/components/conversation/QuoteTag.tsx` | 2 | "回复 @OpenZ" 内联标签 |
| `AIHeader` | `src/components/conversation/AIHeader.tsx` | 2 | AI 标识行(渐变小头像 + 名字 + 模式 chip) |
| `ThinkingBubble` | `src/components/conversation/ThinkingBubble.tsx` | 2 | 思考气泡(可展开/折叠) |
| `ThinkingStepList` | `src/components/conversation/ThinkingStepList.tsx` | 2 | 步骤列表(每行:编号 + 文本) |
| `AIBubble` | `src/components/conversation/AIBubble.tsx` | 2 | AI 基础回复(Markdown 渲染) |
| `ToolUseCard` | `src/components/conversation/ToolUseCard.tsx` | 2 | 工具调用卡片(可折叠,含 SourceList) |
| `SourceList` | `src/components/conversation/SourceList.tsx` | 2 | 工具源列表(编号 + 标题 + URL) |
| `StatusLine` | `src/components/conversation/StatusLine.tsx` | 2 | "OpenZ 正在回复…"(带 spinner) |
| `BlinkingCursor` | `src/components/conversation/BlinkingCursor.tsx` | 2 | 流式打字光标(8×16 闪烁块) |
| `AIActions` | `src/components/conversation/AIActions.tsx` | 2 | 4 项操作行(复制/点赞/重新生成/分享) |
| `Watermark` | `src/components/common/Watermark.tsx` | 2 | "内容由 AI 生成" 小字 |
| `Icon` | `src/components/common/Icon.tsx` | 1 | 内联 SVG icon 集合(汉堡/语音/电话/加号/箭头 等) |

**关注点分离原则**

- `socket.ts` 是唯一与 socket.io-client 直接交互的模块(阶段 3)
- Hook 各自只关心一种数据流(theme / chat-state / model / session / tts)
- `eventReducer` 是纯函数,可独立单测(阶段 3)
- `PCMPlayer` 不感知 socket,只接受 `feed(bytes)` 和 `clear()`(阶段 3)
- 主题相关的颜色/字号一律走 `useTheme().tokens`,不直接读 `colors.X` 硬编码值(便于 3 模式切换)

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

监听器注册位置:`app/_layout.tsx` 中,通过 `useEffect` 挂载,清理函数在 unmount 时移除。需要在 React Query 与 socket 单例均已初始化的 Provider 内。

```
// app/_layout.tsx(伪代码)
useEffect(() => {
  const sub = AppState.addEventListener('change', (state) => {
    if (state === 'background') {
      PCMPlayer.clear()                          // 清空 PCMPlayer 待播队列
      socket.io.opts.reconnection = false        // 暂停 socket.io 自动重连
    }
    if (state === 'active') {
      socket.io.opts.reconnection = true
      socket.connect()                           // 强制重连一次
      queryClient.invalidateQueries(['sessions']) // 触发 session:list 重新拉取
    }
  })
  return () => sub.remove()
}, [])
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
      "ios":     { "ascAppId": "TBD_AFTER_APPLE_CONNECT_SETUP" },
      "android": { "track": "internal" }
    }
  }
}
```

> `ascAppId` 是 Apple App Store Connect 上注册 App 后获得的 ID(形如 `1234567890`),EAS Submit 阶段才需要,MVP 阶段(本地 dev/preview 构建)无需填写,首次准备提交 App Store 时再回填。

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

---

## 14. 分阶段实施

> 3 阶段推进;每阶段都需在 EAS Development Build 跑通后再进入下一阶段。

### 阶段 1 · 脚手架(预计 0.5–1 天)

**目标**:可启动的空白 Expo App,能切 3 模式主题,有 Provider 链和路由。

| 任务 | 产物 |
|---|---|
| 1.1 `pnpm create expo-app` 初始化(SDK 52,blank-typescript 模板) | `packages/mobile/` 基础结构 |
| 1.2 接入 Expo Router 4.x(改 `main` 为 `expo-router/entry`,建 `app/` 目录) | 路由生效 |
| 1.3 配置 tsconfig / eslint / prettier | 与现有 5 个包风格一致 |
| 1.4 安装阶段 1 依赖:`zustand` / `react-native-mmkv` / `react-native-get-random-values` / `uuid` | `package.json` 完整 |
| 1.5 实现 `theme/tokens.ts` + `light.ts` + `dark.ts` + `ThemeProvider` + `useTheme`(3 模式,系统模式基于 `useColorScheme`) | 主题切换可工作 |
| 1.6 实现 `settingsStore`(serverUrl / theme / fontSize / language / voiceBroadcast / enterToSend / defaultModel) | 持久化生效 |
| 1.7 实现原子组件:Icon / IconButton / TextField / MicButton / AttachmentButton / SendButton / Switch / StatusBar / DynamicIsland / HomeIndicator | 全部 Storybook 化(或 1 个 dev 屏统一预览) |
| 1.8 实现 `BottomSheet` 通用组件(基于 `Modal` + Animated) | 可被 2 个 sheet 复用 |
| 1.9 `app/_layout.tsx` 串好 Provider 链:ThemeProvider / SettingsProvider / ReactQueryProvider | 启动后能根据 theme 渲染空 Chat 屏 |
| 1.10 EAS 配置文件 `eas.json` + `app.json`(iOS Bundle ID / Android package) | dev build 可出包 |
| 1.11 iOS Simulator + Android Emulator 跑通,确认热更新与主题切换 | 阶段 1 完成 |

**阶段 1 完成判定**:`pnpm --filter @openz/mobile start` 启动后能看到一个空白 Chat 屏,顶部状态栏 + 灵动岛 + HomeIndicator 正确显示;在开发菜单中切换浅/深/自动,所有原子组件颜色正确刷新。

### 阶段 2 · UI 复刻(预计 2–3 天)

**目标**:1:1 复刻设计稿 5 屏,全部使用 Mock 数据;EAS Dev Build 装机后所有屏在真机上看起来与设计稿一致。

| 任务 | 产物 |
|---|---|
| 2.1 实现 `data/mock.ts`:推荐卡 3 张 / Agent 快捷 4 个 / 模型 3 段 / 最近文件 3 个 / 示例对话 1 段(用户 + 思考 + AI 基础 + 引用 + 工具卡 + 流式中) | 全部静态数据可被 hooks 消费 |
| 2.2 实现 `useChatState`(idle ↔ active 切换) + `useMockData` | 状态可切换 |
| 2.3 实现 `app/chat.tsx` 骨架:TopBar + 主区(state 切换) + ChatInputBox + Watermark | 屏结构对齐 |
| 2.4 实现 idle 态:WelcomeCard + RecommendationList + ShortcutRail | 空闲态与设计稿 home.html 一致 |
| 2.5 实现 `ModelSwitchSheet`(3 段分组,选中态) | 点击 ModelPill 弹出,与 design 一致 |
| 2.6 实现 `AttachmentSheet`(4 入口网格 + 最近文件列表) | 点击 + 按钮弹出 |
| 2.7 实现 `SettingsDrawer` 框架(320px 左抽屉 + 灰化背景) | 触发方式:汉堡按钮 + 左边缘右滑(≥80px) |
| 2.8 实现 `SettingsDrawer` 内容:UserCard + 4 段菜单(通用/智能助手/账户/其他) + ThemeToggle 接入 settingsStore + Switch 切换 + LogoutButton | 抽屉内功能与 design 一致 |
| 2.9 实现 `useTheme` 与 Drawer 的双向联动:切换 3 模式后整个 App 立即刷新 | 主题切换无闪烁 |
| 2.10 实现 active 态 `MessageFlow`:4 种气泡(UserBubble / ThinkingBubble+ThinkingStepList / AIBubble+Markdown / ToolUseCard+SourceList) + QuoteTag / StatusLine / BlinkingCursor / AIActions | 进行态与 design conversation.html 一致 |
| 2.11 装入 EAS Development Build,iOS + Android 真机截图与设计稿对照,逐屏走查差异 | 视觉验收 |
| 2.12 修复走查发现的样式差异(圆角/间距/字号/颜色微调) | 1:1 达成 |

**阶段 2 完成判定**:iOS + Android 真机截图与设计稿对应页基本一致(允许 ±2px 偏差);所有交互(模型切换面板/附件面板/设置抽屉/输入区多行自适应/思考展开折叠)均工作;浅/深/自动三主题实时切换无闪烁。

### 阶段 3 · 功能连线(预计 3–5 天)

**目标**:把阶段 2 的 Mock 替换为真实 socket/React Query,完整运行 §7 数据流。

| 任务 | 产物 |
|---|---|
| 3.1 安装阶段 3 依赖:`socket.io-client` / `@tanstack/react-query` / `react-native-audio-api` | `package.json` 完整 |
| 3.2 `app/_layout.tsx` 加 ReactQueryClientProvider | queryClient 可用 |
| 3.3 实现 `lib/socket.ts` 单例 + `useSocket` | 连接状态可视化 |
| 3.4 接入 `useSessions`(`session:list`)替换 mock 列表 | 真实会话列表 |
| 3.5 接入 `useSessionStream`(`session:event` + eventReducer)替换 mock 对话 | 真实事件流 |
| 3.6 接入 `useTtsClient` + `lib/audio-player.ts`(`react-native-audio-api`) | TTS 真实播放 |
| 3.7 后台/前台切换 `AppState` 监听(§7.6) | 切换体验完整 |
| 3.8 错误处理(§8) | 所有错误路径可观察 |
| 3.9 类型共享策略落地(§9) | `node:crypto` 不入包 |
| 3.10 测试用例(§10) | 关键 reducer 与 hook 有覆盖 |
| 3.11 端到端走查:启 daemon → 启 server → EAS dev build 真机连 server → 完整对话 + TTS 播放 | 阶段 3 完成 |

**阶段 3 完成判定**:真机走查与 web 端等价;`eas build --profile preview` 出包可装;E2E 流程无断点。

---

## 15. 设计稿映射(Open Design → 组件)

| 设计稿文件 | 对应 ReactNative 屏/组件 | 阶段 |
|---|---|---|
| `home.html` | `app/chat.tsx` idle 态(WelcomeCard + RecommendationList + ShortcutRail + ChatInputBox) | 2 |
| `conversation.html` | `app/chat.tsx` active 态(MessageFlow + 4 气泡) | 2 |
| `model-switch.html` | `ModelSwitchSheet` 3 段分组 | 2 |
| `attachment.html` | `AttachmentSheet` 4 入口 + 最近文件 | 2 |
| `settings.html`(浅色) | `SettingsDrawer` + `light.ts` | 2 |
| `settings.html?theme=dark` | `SettingsDrawer` + `dark.ts`(同一组件,主题切换) | 2 |

**设计 token(从 `home.html :root` 提取,作为 light 主题基线)**

| Token | 值 | 用途 |
|---|---|---|
| `--bg` | `#FFFFFF` | 背景 |
| `--surface` | `#F5F5F7` | 卡片/抽屉项 |
| `--surface-2` | `#EDEDF0` | 容器内层 |
| `--border` | `#E5E5EA` | 边框 |
| `--fg` | `#1C1C1E` | 主文字 |
| `--fg-2` | `#3C3C43` | 次文字 |
| `--fg-3` | `#8E8E93` | 弱化文字 |
| `--primary` | `#1A66FF` | 主色 |
| `--primary-2` | `#1452CC` | 主色按压 |
| `--primary-soft` | `#EAF1FF` | 主色弱化背景 |
| `--grad-blue` | `linear-gradient(135deg, #1A66FF, #4A8BFF)` | 推荐卡蓝 / 头像渐变 |
| `--grad-orange` | `linear-gradient(135deg, #FF7A45, #FF9966)` | 推荐卡橙 |
| `--grad-purple` | `linear-gradient(135deg, #8B5CF6, #6366F1)` | 推荐卡紫 |
| `--radius-sm` | `8px` | 小圆角 |
| `--radius` | `12px` | 默认圆角 |
| `--radius-lg` | `16px` | 大圆角 |
| `--radius-xl` | `20px` | 抽屉/Sheet 顶部 |
| `--font` | `SF Pro / PingFang SC` | 系统字体 |

**dark 主题 token 覆写**(从 `settings.html [data-theme="dark"]` 提取)

| Token | dark 值 |
|---|---|
| `--bg` | `#000000` |
| `--surface` | `#1C1C1E` |
| `--surface-2` | `#2C2C2E` |
| `--border` | `#38383A` |
| `--fg` | `#FFFFFF` |
| `--fg-2` | `#EBEBF5` |
| `--fg-3` | `#8E8E93` |
| `--primary-soft` | `rgba(26, 102, 255, 0.22)` |

**关键视觉参数**

- iPhone 14 Pro 容器 393×852,圆角 55px,内屏 44px(开发预览可关)
- 灵动岛 120×35 黑色圆角
- 状态栏 54px,文字 17px
- HomeIndicator 134×5 圆角
- 顶部 nav 4px 14px 12px(上右下)
- 输入盒 16px 圆角,16px 内边距,TextField min 24 / max 100
- 推荐卡 13px 14px 内边距,12px 圆角
- 工具 56×56 图标 + 16px 圆角 + 12px 字号
- 抽屉 320px 宽,顶部 60px 留白给状态栏+灵动岛
- Bottom Sheet 顶部 20px 圆角,max-height 75-78%,handle 40×4

---

## 16. Mock 数据形状(阶段 2 使用)

> 阶段 2 全部使用以下静态数据,阶段 3 替换为 socket/React Query 时,这些形状就是前后端接口契约的来源。

```typescript
// 顶栏(每屏固定)
const topbar: {
  burgerEnabled: true,
  modelPill: { name: 'OpenZ', meta: 'Z1 思考' },
  rightActions: ['voiceBroadcast', 'realTimeCall', 'newSession'],
};

// 推荐卡(idle 态)
const recommendations: Array<{
  id: string;
  title: string;
  sub: string;
  cta: string;             // 按钮文案
  gradient: 'blue' | 'orange' | 'purple';
  iconBg: string;          // 兜底(若 SVG 加载失败)
  iconColor: string;
}>;

// Agent 快捷(idle 态)
const agentShortcuts: Array<{
  id: string;
  name: string;             // 通用 Agent / 一键 PPT / OpenZ Claw / 健康助手
  isPrimary: boolean;       // 第 1 个高亮
  iconBg: string;
  iconColor: string;
}>;

// 模型切换(Sheet)
const modelOptions: {
  base: ModelOption[];          // 基础模型: Z1 / Z0.9 / Z2 Preview
  mode: ModelOption[];          // 推理模式: 深度思考 / 快速 / 联网 / 专业领域
  personality: ModelOption[];   // Agent 人格: OpenZ 默认 / 小火 / 博士
};

type ModelOption = {
  id: string;
  name: string;
  desc: string;
  tag?: '最新' | '稳定' | 'Pro';
  icon: 'cube' | 'lightning' | 'web' | 'lawyer' | 'k' | 'fire' | 'phd';
  iconBg: string;
  iconColor: string;
  isLetterAvatar?: boolean;     // 人格用字母头像(K/小/博)
};

// 附件(Sheet)
const attachmentEntries: Array<{
  id: 'image' | 'file' | 'camera' | 'quote';
  name: '本地图片' | '本地文件' | '拍照' | '引用回复';
  iconBg: string;
  iconColor: string;
}>;

const recentFiles: Array<{
  id: string;
  name: string;
  type: 'IMG' | 'PDF' | 'XLS' | string;
  meta: string;             // "图片 · 2.4 MB"
  time: '昨天' | '2 天前' | '上周' | string;
  thumbBg: string;          // 渐变或纯色
  thumbColor: string;
  thumbText: string;         // 缩略图文字
}>;

// 示例对话(active 态)
const sampleMessages: Array<
  | { id: string; role: 'user'; content: string; time: string }
  | { id: string; role: 'user'; content: string; quote: { tag: '回复 @OpenZ' }; time: string }
  | { id: string; role: 'assistant'; mode: '思考'; thinkingSummary: string; thinkingSteps: string[] }
  | { id: string; role: 'assistant'; content: string; markdown: true; actions: { copy: true; like: number; regenerate: true; share: true } }
  | { id: string; role: 'tool'; name: string; sub: string; sources: Array<{ num: number; title: string; url: string }> }
  | { id: string; role: 'assistant'; content: string; streaming: true; statusLine: 'OpenZ 正在回复…' }
>;

// 设置抽屉
const settingsMenu: {
  通用: Array<{ id: 'appearance' | 'fontSize' | 'language'; label: string; value?: string; kind: 'themeToggle' | 'link' | 'link' }>;
  智能助手: Array<{ id: 'defaultModel' | 'voiceBroadcast' | 'enterToSend'; label: string; value?: string; on: boolean; kind: 'link' | 'switch' | 'switch' }>;
  账户: Array<{ id: 'subscribePro' | 'usage'; label: string; value: string; kind: 'link' }>;
  其他: Array<{ id: 'help' | 'about'; label: string; value: string; kind: 'link' }>;
};

// 用户卡
const userCard: {
  name: string;        // "Alex"(MVP 占位)
  plan: '免费版 · 升级 Pro' | string;
  avatarLetter: string; // 头像字母 "A"
};

// 当前用户(阶段 2 占位,阶段 3 接 server 用户信息)
const currentUser = { name: 'Alex', plan: '免费版', avatarLetter: 'A' } as const;
```
