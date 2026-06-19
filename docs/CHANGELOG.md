# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-06-18

### Added

- **packages/web**: Web 控制台基于设计稿重构
  - 新增页面：HomeScreen、ConversationScreen、SettingsScreen
  - 新增组件：ModelSwitchModal、AttachmentModal
  - Hash 路由支持（`/#home`、`/#conversation`、`/#settings`）
  - 思考气泡可折叠 + 编号步骤列表
  - 流式输出状态：spinner + 'OpenZ 正在回复…'
  - 接入真实 Socket.IO（session:create/send/event）

- **packages/mobile**: Phase 3 移动端完整链路
  - 移动端 ChatScreen 接入 daemon 后端 hooks
  - 新增 HistoryDrawer 历史会话抽屉组件
  - 连接诊断日志（daemon 连接问题排查）
  - `useSessionStream`、`useSessions`、`useTtsClient` 等 hooks
  - 音频播放功能 `audio-player`
  - TTS 语音回复集成

- **packages/server**: WebSocket relay 服务器

- **Agent 事件模型重构**
  - `AgentEvent` 新增 `eventId`（UUID v4 全局唯一）、`seq`（单调递增序号）、`timestamp`（Unix ms）
  - 各事件 `data` 字段强类型化
  - `ToolResultData` 新增 `isError` 字段

- **会话历史**
  - `GET /sessions/:id/events` 接口支持历史事件查询
  - `SessionHistoryQuery`、`SessionHistoryResponse` 类型

### Changed

- **packages/web**: 用真实会话数据替换 Sidebar Mock 数据
- **packages/mobile**: 升级 react-native-screens 到 ~4.4.0 匹配 Expo SDK 52

### Fixed

- **packages/web**: `tool_result` 字段修正
- **packages/mobile**: Web 环境 AudioContext 检测修复
- **packages/mobile**: ChatScreen Phase 3 集成遗漏修复

## [0.2.0] - 2026-06-17

### Added
- **packages/server**: WebSocket relay server for multi-daemon support and public network deployment
- **Server relay mode**: Daemon supports `--server <url>` option to relay connections through relay server
- **Heartbeat mechanism**: 30s ping interval with 90s timeout for daemon liveness detection
- **Multi-daemon load balancing**: Least-sessions-first strategy for session distribution
- **TTS integration**: `TTSManager` with Volcengine V3 TTS WebSocket API
- **Voice reply**: `session:voice_reply` event with streaming TTS, sends `voice_audio` chunks to client
- **useAudioPlayer hook**: Web Audio API hook for playing voice audio in browser
- Voice reply toggle button (🔊/🔇) in ChatView

### Changed
- Package rename: `@uran/*` → `@openz/*` for consistency
- CLI command rename: `uran` → `openz`
- `packages/server` extracted as separate package

### Fixed
- Session persistence path updated to `~/.openz/sessions.json`

## [0.1.0] - 2026-06-16

### Added
- Initial release
- `uran` CLI with daemon mode
- `ClaudeAgent` implementation using `@anthropic-ai/claude-agent-sdk`
- `SessionManager` for session lifecycle management
- Socket.IO server for frontend communication
- React web console (`packages/web`)
- Shared TypeScript types (`packages/shared`)
- Session persistence to `~/.uran/sessions.json`
- Agent event streaming (thinking, text_delta, tool_use, etc.)
