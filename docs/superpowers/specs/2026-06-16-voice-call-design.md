# 语音通话功能设计

## 1. 背景与目标

为 Openz CLI 添加语音通话能力，实现类似豆包的实时可打断 AI 语音对话。

### 核心能力
- **连续语音对话**：用户持续说话，AI 实时理解并回复
- **可打断**：用户可随时打断 AI 的发言或生成过程
- **语音回复**：AI 回复以语音形式播报，而非文字

### 技术选型
- **STT（语音识别）**：火山引擎 ASR
- **TTS（语音合成）**：火山引擎 TTS（豆包同款）
- **AI 对话**：现有 Claude Agent SDK（daemon 现有能力）
- **语音处理位置**：客户端（浏览器/App），不做中转

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────────┐
│                     客户端（浏览器 / App）                  │
│                                                          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐  │
│  │ 麦克风    │───→│ STT WebSocket │───→│  文字 → session:send │  │
│  │ 音频流   │    │ (实时识别)   │    │                   │  │
│  └──────────┘    └──────────┘    └────────┬───────────┘  │
│                                              │             │
│  ┌──────────┐    ┌──────────┐    ┌────────▼───────────┐  │
│  │ 扬声器    │←───│ TTS WebSocket │←───│  AI 文字回复       │  │
│  │ 音频播放  │    │ (流式合成)   │    │                   │  │
│  └──────────┘    └──────────┘    └────────────────────┘  │
│       ↑                                        │          │
│       │           ┌──────────────────┐         │          │
│       └───────────│ 打断控制器        │◀────────┘          │
│                   │ (中止播放/请求)    │                    │
│                   └──────────────────┘                    │
└─────────────────────────────────────────────────────────┘
                              │
                              │ Socket.IO
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     Openz Daemon                         │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Claude Agent SDK                      │   │
│  │  session:send → query() → AgentEvent stream      │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  角色：纯 AI 处理，不感知语音存在                          │
└─────────────────────────────────────────────────────────┘
```

### 2.2 火山引擎 WebSocket API

火山引擎提供两个独立的 WebSocket 流：

**STT 流（语音 → 文字）：**
- 客户端持续发送麦克风音频流
- 服务端实时返回识别文字片段
- 支持**流式输出**，用户边说边看到识别结果

**TTS 流（文字 → 语音）：**
- 客户端发送文字
- 服务端流式返回音频帧
- 客户端实时播放，无需等待完整音频

### 2.3 通信协议

客户端新增 Socket.IO 事件：

| 事件名 | 方向 | 说明 |
|--------|------|------|
| `session:send` | client → server | 发送文字消息（现有，不变） |
| `session:event` | server → client | AI 事件流（现有，不变） |
| `session:voice_start` | client → server | 开始语音通话（通知 daemon） |
| `session:voice_stop` | client → server | 结束语音通话 |

> **Daemon 完全不需要感知语音。** 客户端把语音识别后的文字通过 `session:send` 发给 daemon，收到 AI 文字回复后调 TTS 播放。Daemon 只需知道"这是一个语音 session"即可（用于统计/日志）。

---

## 3. 客户端实现

### 3.1 目录结构

```
packages/web/src/
├── components/
│   └── VoiceCall/
│       ├── VoiceCallPanel.tsx      # 语音通话 UI 面板
│       ├── useVoiceCall.ts         # 语音通话核心 Hook
│       ├── useVolcEngineSTT.ts     # 火山引擎 STT WebSocket
│       └── useVolcEngineTTS.ts     # 火山引擎 TTS WebSocket
```

### 3.2 核心状态机

```
                ┌────────────────────────────────────────┐
                │             IDLE                        │
                │  （未开始通话，显示麦克风按钮）             │
                └──────────────┬─────────────────────────┘
                               │ 点击开始
                               ▼
                ┌────────────────────────────────────────┐
                │        RECORDING                        │
                │  （正在录音，麦克风亮灯，识别文字显示）     │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ STT WebSocket: 边录音边识别      │   │
                │  │ 识别结果实时追加到输入框          │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"发送"→ 切换到 PROCESSING        │
                │   - 点击"打断"→ 切换到 INTERRUPTED      │
                │   - 点击"结束"→ 切换到 IDLE              │
                └──────────────┬──────────────────────────┘
                               │ 点击发送 / 自动标点触发
                               ▼
                ┌────────────────────────────────────────┐
                │        PROCESSING                       │
                │  （等待 AI 回复，显示思考动画）           │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ session:send(识别文字)          │   │
                │  │ 监听 session:event              │   │
                │  │ 收到 text_delta → 累积回复文字  │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"打断"→ 中止播放 + 中止生成     │
                └──────────────┬──────────────────────────┘
                               │ 收到 assistant_complete
                               ▼
                ┌────────────────────────────────────────┐
                │        SPEAKING                        │
                │  （AI 正在播报 TTS）                    │
                │                                          │
                │  ┌──────────────────────────────────┐   │
                │  │ TTS WebSocket: 文字 → 音频流   │   │
                │  │ 实时播放音频帧                   │   │
                │  │ 完整播完后 → 回到 RECORDING      │   │
                │  └──────────────────────────────────┘   │
                │                                          │
                │  用户可随时：                            │
                │   - 点击"打断"→ 中止 TTS，回到 RECORDING │
                │   - 点击"结束"→ 回到 IDLE                │
                └────────────────────────────────────────┘
```

### 3.3 打断实现

**打断 AI 生成（PROCESSING → RECORDING）：**
1. 调用 `session:interrupt` 事件，通知 daemon 中止当前请求
2. TTS 当前无播放，无需中止
3. 清空累积的 AI 回复文字
4. 重置 STT WebSocket（如需要）
5. 回到 RECORDING 状态

**打断 AI 播报（SPEAKING → RECORDING）：**
1. 立即关闭 TTS WebSocket（中止音频流）
2. 音频播放器的缓冲音频直接丢弃
3. 调用 `session:interrupt`（确保 daemon 侧也停止生成）
4. 清空 AI 回复文字
5. 回到 RECORDING 状态

### 3.4 火山引擎 SDK 接入

火山引擎提供浏览器端 WebSocket SDK，npm 包名：`@volcengine/veRTC-uniapp-wvp` 或直接使用原生 WebSocket。

**STT WebSocket（实时语音识别）：**
```typescript
// 伪代码示例
const sttWs = new WebSocket('wss://openspeech.bytedance.com/...');

sttWs.onopen = () => {
  // 发送认证 token
  sttWs.send(JSON.stringify({ app_id, token, ... }));
};

sttWs.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.result) {
    onTextRecognized(data.result); // 触发识别文字回调
  }
};

// 持续发送麦克风 PCM 数据
microphoneStream.on('data', (chunk) => {
  sttWs.send(chunk);
});
```

**TTS WebSocket（流式语音合成）：**
```typescript
// 伪代码示例
const ttsWs = new WebSocket('wss://openspeech.bytedance.com/...');

ttsWs.onopen = () => {
  // 发送合成请求
  ttsWs.send(JSON.stringify({
    app_id, token, text: aiResponseText, voice: 'some_voice_id'
  }));
};

ttsWs.onmessage = (event) => {
  // event.data 是音频帧（Opus/PCM）
  audioBuffer.push(event.data);
  playAudio(event.data); // 实时播放
};

ttsWs.onclose = () => {
  // 播完或被打断
};
```

> 具体 API 格式以火山引擎官方文档为准，上述为示意。

---

## 4. Daemon 改动

**改动最小化原则：Daemon 不感知语音协议。**

### 4.1 新增事件

| 事件 | 说明 |
|------|------|
| `session:voice_start` | 客户端告知开始语音 session（仅记录/日志） |
| `session:voice_stop` | 客户端告知结束语音 session（仅记录/日志） |

### 4.2 其他改动

- 无。`session:send` 和 `session:interrupt` 已有，无需改动。

---

## 5. Web Console UI 改动

### 5.1 新增语音通话面板

在现有 Chat UI 旁边或底部新增语音通话区域：

```
┌─────────────────────────────────────┐
│  🎤 语音通话                         │
├─────────────────────────────────────┤
│                                     │
│   ┌─────────────────────────────┐   │
│   │   "你好的，我可以帮你什么？"  │   │  ← AI 回复文字（实时）
│   └─────────────────────────────┘   │
│                                     │
│   ┌─────────────────────────────┐   │
│   │ 你：我想查询今天的天气       │   │  ← 用户识别文字（实时）
│   └─────────────────────────────┘   │
│                                     │
│        ● 录音中...  02:34           │  ← 录音时长 + 波形指示
│                                     │
│   [发送]  [打断]  [结束通话]        │
│                                     │
└─────────────────────────────────────┘
```

### 5.2 状态 UI

| 状态 | UI 表现 |
|------|---------|
| IDLE | 麦克风图标 + "开始通话" 按钮 |
| RECORDING | 麦克风亮红 + 波形动画 + 识别文字 + 3 个按钮 |
| PROCESSING | 旋转等待动画 + "AI 思考中..." |
| SPEAKING | 扬声器图标 + 音频波形 + "打断" 按钮 |

---

## 6. 扩展性设计

### 6.1 STT/TTS 提供商可插拔

所有火山引擎调用封装在独立 Hook 中：

```typescript
// useVolcEngineSTT.ts — STT 抽象接口
interface ISTTProvider {
  start(onText: (text: string) => void): void;
  stop(): void;
}

// useVolcEngineTTS.ts — TTS 抽象接口
interface ITTSProvider {
  speak(text: string, onClose: () => void): void;
  interrupt(): void;
}
```

未来切换到讯飞/阿里云，只需实现相同接口替换即可。

### 6.2 App 端复用

App 端实现相同的 `ISTTProvider` / `ITTSProvider` 接口，Openz Daemon 无需任何改动。

---

## 7. 实现计划

### Phase 1: 基础整句模式
1. 实现火山引擎 STT（整句识别，非实时）
2. 实现火山引擎 TTS（流式）
3. 改造 UI 添加语音通话面板
4. 跑通：录音 → 识别 → 发送 → 等待 → 播放

### Phase 2: 实时流式 + 打断
5. STT 改为实时流式识别
6. 实现打断控制器
7. 实现完整状态机

### Phase 3: App 扩展（后续）
8. App 端实现（复用同一套接口）

---

## 8. 待确认事项

1. **火山引擎 App ID / Token**：需要你提供，或在控制台创建
2. **TTS 音色选择**：用哪个音色（豆包默认音色 vs 其他）
3. **是否需要声音克隆**：自定义音色需要额外配置

---

## 9. 参考资料

- 火山引擎 TTS 文档：https://www.volcengine.com/docs/tts/1190783
- 火山引擎 ASR 文档：火山引擎控制台
- Openz Daemon Socket.IO 协议：见 `packages/cli/src/daemon/server.ts`
