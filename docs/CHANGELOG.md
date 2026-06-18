# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
- **XDG config**: `~/.config/openz/setting.json` for daemon global configuration
- **TtsSink abstraction**: Unified PCM frame and control event downstream dispatch

### Changed
- Package rename: `@uran/*` → `@openz/*` for consistency
- CLI command rename: `uran` → `openz`
- `packages/server` extracted as separate package

### Fixed
- Session persistence path updated to `~/.openz/sessions.json`
