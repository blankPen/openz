# Openz 移动端功能完善实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `feature/mobile-complete` 分支上，通过增量替换 mock 的方式，完善移动端所有核心功能，实现 App 真正可用

**Architecture:** 基于现有 Expo SDK 52 + React Native 项目结构，使用 zustand 进行状态管理，Socket.IO 连接 daemon 后端，复用现有 store/hooks 架构

**Tech Stack:** React Native, Expo SDK 52, TypeScript, zustand, socket.io-client, react-native-mmkv

---

## Global Constraints

- TypeScript 严格模式
- pnpm monorepo workspace
- 所有改动需要在 iOS/Android 可正常运行
- 遵循现有代码模式（zustand store + 自定义 hooks）
- 每次 PR 聚焦一个功能模块

---

## 文件结构概览

```
packages/mobile/
├── src/
│   ├── stores/           # 状态管理 (已实现: chatStore, settingsStore, connectionStore)
│   ├── hooks/           # 自定义 hooks (已实现: useSessions, useSessionStream, useSocket, useTtsClient)
│   ├── components/      # UI 组件
│   │   ├── chat/        # 消息相关组件
│   │   ├── input/       # 输入组件
│   │   ├── sheets/      # BottomSheet 组件
│   │   ├── drawer/      # 抽屉组件
│   │   └── common/      # 通用组件
│   ├── screens/         # 屏幕 (ChatScreen)
│   └── lib/             # 工具库 (socket, audio-player, sessionMaps)
└── __tests__/           # 测试
```

---

## Phase A - 核心体验

### Task 1: 会话管理功能完善

**Files:**
- Modify: `packages/mobile/src/stores/chatStore.ts` — 已有完整实现，检查并补全边界情况
- Modify: `packages/mobile/src/hooks/useSessions.ts` — 检查 mock 数据替换为真实 API 调用
- Modify: `packages/mobile/src/components/drawer/HistoryDrawer.tsx` — UI 复刻

**Interfaces:**
- Consumes: `socket.io-client` Socket 实例
- Produces: `useChatStore`, `useSessions()` hook

**Steps:**

- [ ] **Step 1: 检查 chatStore 完整性**
  ```bash
  cd /Users/pz/multica_workspaces/c22c5bba-a208-4287-b111-c8eb91db5f07/9354d9ed/workdir/openz
  cat packages/mobile/src/stores/chatStore.ts
  ```
  验证：createConversation, deleteConversation, renameConversation, addMessage, updateMessage, removeMessage, clearMessages 是否完整

- [ ] **Step 2: 检查 useSessions hook**
  ```bash
  cat packages/mobile/src/hooks/useSessions.ts
  ```
  确认 sessions 列表从 daemon API 获取，而非 mock

- [ ] **Step 3: 检查 HistoryDrawer UI**
  ```bash
  cat packages/mobile/src/components/drawer/HistoryDrawer.tsx
  ```
  确认支持：会话列表展示、选择会话、删除会话、新建会话

- [ ] **Step 4: 运行类型检查**
  ```bash
  cd /Users/pz/multica_workspaces/c22c5bba-a208-4287-b111-c8eb91db5f07/9354d9ed/workdir/openz
  pnpm --filter @openz/mobile typecheck
  ```
  期望：无类型错误

- [ ] **Step 5: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```
  期望：所有测试通过

- [ ] **Step 6: 提交**
  ```bash
  git add packages/mobile/src/stores/chatStore.ts packages/mobile/src/hooks/useSessions.ts packages/mobile/src/components/drawer/HistoryDrawer.tsx
  git commit -m "feat(mobile): 完成会话管理功能"
  ```

---

### Task 2: 实时对话功能完善

**Files:**
- Modify: `packages/mobile/src/hooks/useSessionStream.ts` — 检查 SSE 流式输出实现
- Modify: `packages/mobile/src/components/chat/MessageRow.tsx` — 检查消息展示组件
- Modify: `packages/mobile/src/components/input/InputBar.tsx` — 检查输入框组件

**Interfaces:**
- Consumes: `useSessionStream(sessionId, callbacks)`
- Produces: `sessionStream.sendMessage(text)`, `sessionStream.abort()`

**Steps:**

- [ ] **Step 1: 检查 useSessionStream 实现**
  ```bash
  cat packages/mobile/src/hooks/useSessionStream.ts
  ```
  验证：SSE 连接、事件处理（message_start, text_delta, thinking_delta, assistant_complete, error）、abort 方法

- [ ] **Step 2: 检查 MessageRow 组件**
  ```bash
  cat packages/mobile/src/components/chat/MessageRow.tsx
  ```
  确认：用户消息/AI消息展示、流式输出动画、thinking 步骤展示

- [ ] **Step 3: 检查 InputBar 组件**
  ```bash
  cat packages/mobile/src/components/input/InputBar.tsx
  ```
  确认：文字输入、发送按钮、附件按钮、停止按钮

- [ ] **Step 4: 运行类型检查**
  ```bash
  pnpm --filter @openz/mobile typecheck
  ```
  期望：无类型错误

- [ ] **Step 5: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```

- [ ] **Step 6: 提交**
  ```bash
  git add packages/mobile/src/hooks/useSessionStream.ts packages/mobile/src/components/chat/MessageRow.tsx packages/mobile/src/components/input/InputBar.tsx
  git commit -m "feat(mobile): 完成实时对话功能"
  ```

---

## Phase B - 增强功能

### Task 3: 附件处理功能完善

**Files:**
- Modify: `packages/mobile/src/components/sheets/AttachmentSheet.tsx` — 检查并完善附件上传/预览/下载
- Modify: `packages/mobile/src/lib/attachment.ts` (如需要新建) — 附件处理工具函数
- Modify: `packages/mobile/src/stores/chatStore.ts` — 如需要新增附件相关方法

**Interfaces:**
- Consumes: `AttachmentSheet` 组件, `useChatStore.addMessage()`
- Produces: 附件上传到 daemon, 预览, 下载能力

**Steps:**

- [ ] **Step 1: 检查 AttachmentSheet 现状**
  ```bash
  cat packages/mobile/src/components/sheets/AttachmentSheet.tsx
  ```
  识别 mock 实现，列出需要替换的部分

- [ ] **Step 2: 定义附件接口**
  ```typescript
  // types/attachment.ts
  export interface Attachment {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    url: string;
  }
  ```

- [ ] **Step 3: 实现附件上传**
  - 使用 `fetch` 或 `axios` 调用 daemon API
  - 支持进度回调

- [ ] **Step 4: 实现附件预览**
  - 图片使用 `Image` 组件
  - 其他文件调用系统打开

- [ ] **Step 5: 实现附件下载**
  - 使用 `fetch` 下载文件
  - 保存到本地文件系统

- [ ] **Step 6: 更新 chatStore**
  在消息中添加附件支持：
  ```typescript
  interface ChatMessage {
    // ...existing fields
    attachments?: Attachment[];
  }
  ```

- [ ] **Step 7: 运行类型检查**
  ```bash
  pnpm --filter @openz/mobile typecheck
  ```

- [ ] **Step 8: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```

- [ ] **Step 9: 提交**
  ```bash
  git add packages/mobile/src/components/sheets/AttachmentSheet.tsx
  git commit -m "feat(mobile): 完成附件处理功能"
  ```

---

### Task 4: 连接诊断功能完善

**Files:**
- Modify: `packages/mobile/src/stores/connectionStore.ts` — 检查并完善连接状态管理
- Modify: `packages/mobile/src/hooks/useSocket.ts` — 检查 Socket 连接逻辑
- Modify: `packages/mobile/src/components/common/ConnectionStatus.tsx` (如需要新建) — 连接状态可视化组件

**Interfaces:**
- Consumes: `socket.io-client` Socket 事件
- Produces: `useConnectionStore` 状态, `ConnectionStatus` 组件

**Steps:**

- [ ] **Step 1: 检查 connectionStore**
  ```bash
  cat packages/mobile/src/stores/connectionStore.ts
  ```
  确认：status, failCount, lastError, markConnected, recordConnectError, recordPingTimeout

- [ ] **Step 2: 检查 useSocket hook**
  ```bash
  cat packages/mobile/src/hooks/useSocket.ts
  ```
  确认：Socket 连接/断开/重连逻辑

- [ ] **Step 3: 实现断线重连机制**
  - Socket 断开时自动重连
  - 重连次数限制
  - 重连间隔递增

- [ ] **Step 4: 创建 ConnectionStatus 组件**
  ```typescript
  // components/common/ConnectionStatus.tsx
  interface Props {
    status: 'connected' | 'connecting' | 'disconnected';
    failCount: number;
    lastError: string | null;
  }
  ```

- [ ] **Step 5: 集成到 ChatScreen**
  在 ChatScreen 顶部显示连接状态条

- [ ] **Step 6: 运行类型检查**
  ```bash
  pnpm --filter @openz/mobile typecheck
  ```

- [ ] **Step 7: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```

- [ ] **Step 8: 提交**
  ```bash
  git add packages/mobile/src/stores/connectionStore.ts packages/mobile/src/hooks/useSocket.ts packages/mobile/src/components/common/ConnectionStatus.tsx
  git commit -m "feat(mobile): 完成连接诊断功能"
  ```

---

## Phase C - 个性化

### Task 5: 设置管理功能完善

**Files:**
- Modify: `packages/mobile/src/stores/settingsStore.ts` — 检查并补全设置项
- Modify: `packages/mobile/src/components/sheets/SettingsSheet.tsx` (如需要新建) — 设置页面
- Modify: `packages/mobile/src/hooks/useTheme.ts` — 主题切换实现

**Interfaces:**
- Consumes: `useSettingsStore` 设置状态
- Produces: 设置 UI (主题切换、模型选择等)

**Steps:**

- [ ] **Step 1: 检查 settingsStore**
  ```bash
  cat packages/mobile/src/stores/settingsStore.ts
  ```
  确认已有：serverUrl, themeMode, fontSize, language, voiceBroadcast, enterToSend, defaultModel, ttsAutoPlay

- [ ] **Step 2: 检查 useTheme hook**
  ```bash
  cat packages/mobile/src/hooks/useTheme.ts
  ```
  确认主题切换实现

- [ ] **Step 3: 创建 SettingsSheet (如果不存在)**
  ```bash
  ls packages/mobile/src/components/sheets/
  ```
  如果没有 SettingsSheet，创建它

- [ ] **Step 4: 实现设置项 UI**
  - 主题切换 (light/dark/system)
  - 字体大小
  - 语言
  - TTS 自动播放
  - 默认模型选择

- [ ] **Step 5: 运行类型检查**
  ```bash
  pnpm --filter @openz/mobile typecheck
  ```

- [ ] **Step 6: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```

- [ ] **Step 7: 提交**
  ```bash
  git add packages/mobile/src/stores/settingsStore.ts packages/mobile/src/components/sheets/
  git commit -m "feat(mobile): 完成设置管理功能"
  ```

---

## Task 6: UI 复刻 Phase 2

**Files:**
- Modify: `packages/mobile/src/components/home/WelcomeSection.tsx` — 首页欢迎区
- Modify: `packages/mobile/src/components/chat/StreamingIndicator.tsx` — 流式输出指示器
- Modify: 设计稿对比检查

**Steps:**

- [ ] **Step 1: 对比设计稿**
  检查 `resources/design/9cc2af0a-c292-4a13-a16f-60ad115d51d8/` 中的设计稿
  确认 5 屏：Home, Chat, Settings, Attachment, Diagnostics

- [ ] **Step 2: 逐屏检查 UI 组件**
  - Home: WelcomeSection
  - Chat: MessageRow, InputBar, StreamingIndicator
  - Settings: SettingsSheet
  - Attachment: AttachmentSheet
  - Diagnostics: ConnectionStatus

- [ ] **Step 3: 补全缺失组件**
  根据设计稿补充缺失的 UI 组件

- [ ] **Step 4: 运行类型检查**
  ```bash
  pnpm --filter @openz/mobile typecheck
  ```

- [ ] **Step 5: 运行测试**
  ```bash
  pnpm --filter @openz/mobile test
  ```

- [ ] **Step 6: 提交**
  ```bash
  git add packages/mobile/src/components/
  git commit -m "feat(mobile): 完成 Phase 2 UI 复刻"
  ```

---

## Task 7: 集成测试与验收

**Files:**
- Modify: `packages/mobile/__tests__/` — 补充集成测试
- Modify: `.github/workflows/` (如需要) — CI 工作流

**Steps:**

- [ ] **Step 1: 补充关键流程测试**
  - 会话创建 → 发送消息 → 收到响应
  - 附件上传 → 预览 → 下载
  - 设置修改 → 生效验证

- [ ] **Step 2: 运行完整测试套件**
  ```bash
  pnpm --filter @openz/mobile test
  pnpm --filter @openz/mobile typecheck
  pnpm --filter @openz/mobile lint
  ```

- [ ] **Step 3: iOS 构建验证**
  ```bash
  cd packages/mobile
  npx expo run:ios --no-build-cache
  ```

- [ ] **Step 4: Android 构建验证**
  ```bash
  npx expo run:android --no-build-cache
  ```

- [ ] **Step 5: 最终提交**
  ```bash
  git add .
  git commit -m "feat(mobile): 完成所有功能集成"
  git push origin feature/mobile-complete
  ```

---

## 实施顺序

1. Task 1: 会话管理功能完善
2. Task 2: 实时对话功能完善
3. Task 3: 附件处理功能完善
4. Task 4: 连接诊断功能完善
5. Task 5: 设置管理功能完善
6. Task 6: UI 复刻 Phase 2
7. Task 7: 集成测试与验收

---

## Mock 替换检查清单

- [ ] chatStore 中是否有 hardcoded mock 数据？ → 替换为真实 API
- [ ] useSessions 是否返回 mock sessions？ → 替换为 daemon API
- [ ] AttachmentSheet 是否有 mock 附件？ → 实现真实上传/预览/下载
- [ ] connectionStore 是否只是占位？ → 实现真实连接状态管理
- [ ] settingsStore 的默认值是否合理？ → 检查并调整
