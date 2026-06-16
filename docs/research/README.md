# 调研报告索引

## 调研时间
2026-06-15

## 报告列表

| 报告 | 路径 | 主要内容 |
|-----|-----|---------|
| 语音对话方案 | `voice-dialogue-research-2026-06-15.md` | STT/TTS方案对比、流式框架分析、商业备选 |
| Claude Code远程能力 | `claude-code-remote-research-2026-06-15.md` | API机制、工具调用、会话管理、替代方案 |

## 快速结论

### 语音对话
- **STT首选**：Faster-Whisper量化版
- **TTS首选**：MeloTTS（移动端优化最好）
- **框架首选**：LiveKit Voice SDK（产品级）或 Pipecat（快速原型）
- **快速启动**：OpenAI Realtime API

### Claude Code远程
- Claude Code 没有原生HTTP API，需自己包装
- 工具调用在本机执行，天然适合远程控制
- **推荐起步方案**：Python包装脚本 + WebSocket通信

## 待验证问题
1. Claude Code 是否支持持续运行模式？
2. CLI 输出格式是否结构化？
3. MCP 协议能否用于远程工具调用？
