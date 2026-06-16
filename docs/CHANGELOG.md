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
