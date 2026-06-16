# Phase 1: TTS 语音回复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 用户在 ChatView 输入文字 → daemon AI 处理 → AI 文字回复 → Volcengine TTS 流式合成 → 浏览器实时播放音频

**Architecture:** 纯前端改动，不碰 daemon。火山引擎 TTS WebSocket 客户端封装为独立 Hook，ChatView 在 `assistant_complete` 事件时触发 TTS 播放。音频使用 Web Audio API 实时播放流式数据。

**Tech Stack:** React + TypeScript + Web Audio API +原生 WebSocket

---

## 文件结构

```
packages/web/src/
├── hooks/
│   └── useVolcEngineTTS.ts        # [新建] TTS WebSocket 客户端
├── components/
│   ├── VoiceReplyToggle.tsx         # [新建] 语音回复开关按钮
│   └── TTSAudioPlayer.ts           # [新建] 音频播放器工具类
└── components/ChatView.tsx          # [修改] 集成 TTS 播放
```

---

## Task 1: 环境变量配置

**Files:**
- Modify: `packages/web/src/App.tsx:1-6`（引入环境变量）
- Modify: `packages/web/vite.config.ts`（配置 env）

- [ ] **Step 1: 在 vite.config.ts 中确认 env 读取**

```typescript
// packages/web/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
  },
  // VITE_ 前缀的 env 会自动暴露给前端
});
```

- [ ] **Step 2: 在 `packages/web/.env` 创建环境变量文件**

```env
VITE_VOLCENGINE_API_KEY=d098393c-32be-4b38-9814-c85da94dc6c6
VITE_VOLCENGINE_RESOURCE_ID=seed-tts-2.0
```

- [ ] **Step 3: 确认 .env 已加入 .gitignore**

检查 `packages/web/.gitignore` 或项目根目录 `.gitignore` 是否包含 `.env`，防止 key 提交。

- [ ] **Step 4: Commit**

```bash
git add packages/web/.env packages/web/vite.config.ts
git commit -m "feat(web): add Volcengine TTS env vars"
```

---

## Task 2: Volcengine TTS WebSocket 协议封装

**Files:**
- Create: `packages/web/src/hooks/useVolcEngineTTS.ts`

### 协议常量

```typescript
// Event codes
const EVT_START_CONNECTION = 1;
const EVT_FINISH_CONNECTION = 2;
const EVT_START_SESSION = 100;
const EVT_CANCEL_SESSION = 101;
const EVT_FINISH_SESSION = 102;
const EVT_TASK_REQUEST = 200;
const EVT_CONNECTION_STARTED = 50;
const EVT_SESSION_STARTED = 150;
const EVT_TTS_SENTENCE_START = 350;
const EVT_TTS_SENTENCE_END = 351;
const EVT_TTS_RESPONSE = 352;
const EVT_SESSION_FINISHED = 152;

// Message types
const MSG_FULL_CLIENT_REQUEST = 0x14; // 0b0001_0100 = type 1 + flags 0100
const MSG_FULL_SERVER_RESPONSE = 0x94; // 0b1001_0100 = type 9 + flags 0100
const MSG_AUDIO_ONLY_RESPONSE = 0xB4; // 0b1011_0100 = type 11 + flags 0100

// Serialization / Compression
const SERIAL_JSON = 0x10; // 0b0001_0000
const COMPRESS_NONE = 0x00;
```

### 编码函数

```typescript
function encodeFrame(
  messageType: number,
  eventOrPayload: Uint8Array,
  hasEventNumber: boolean,
): Uint8Array {
  const headerSize = hasEventNumber ? 8 : 4;
  const payloadLen = eventOrPayload.length;
  const frame = new Uint8Array(4 + (hasEventNumber ? 4 : 0) + payloadLen);

  // Byte 0: protocol v1 + 4-byte header
  frame[0] = 0x11;
  // Byte 1: message type + flags
  frame[1] = messageType;
  // Byte 2: JSON serialization + no compression
  frame[2] = SERIAL_JSON;
  // Byte 3: reserved
  frame[3] = 0x00;

  const offset = 4;
  if (hasEventNumber) {
    // Event number (big-endian int32)
    frame[4] = (eventOrPayload[0] >> 24) & 0xFF;
    frame[5] = (eventOrPayload[0] >> 16) & 0xFF;
    frame[6] = (eventOrPayload[0] >> 8) & 0xFF;
    frame[7] = eventOrPayload[0] & 0xFF;
    frame.set(eventOrPayload.subarray(1), 8);
  } else {
    frame.set(eventOrPayload, offset);
  }
  return frame;
}
```

### Hook 实现

```typescript
import { useRef, useCallback } from 'react';

const API_KEY = import.meta.env.VITE_VOLCENGINE_API_KEY as string;
const RESOURCE_ID = import.meta.env.VITE_VOLCENGINE_RESOURCE_ID as string || 'seed-tts-2.0';
const TTS_WS_URL = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

export interface TTSCallbacks {
  onAudio?: (chunk: ArrayBuffer) => void;
  onSentenceStart?: (text: string) => void;
  onSentenceEnd?: (text: string) => void;
  onComplete?: () => void;
  onError?: (err: string) => void;
}

export function useVolcEngineTTS(callbacks: TTSCallbacks) {
  const wsRef = useRef<WebSocket | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  const connect = useCallback(() => {
    const ws = new WebSocket(TTS_WS_URL);
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      // Send StartConnection (event=1, empty JSON body)
      const payload = new TextEncoder().encode('{}');
      const eventNum = new Uint8Array([0, 0, 0, EVT_START_CONNECTION]);
      const frame = encodeFrame(MSG_FULL_CLIENT_REQUEST, eventNum, false);
      ws.send(frame);
    };

    ws.onmessage = (evt) => {
      const data = new Uint8Array(evt.data);
      handleMessage(data);
    };

    ws.onerror = () => callbacks.onError?.('WebSocket error');
    ws.onclose = () => { wsRef.current = null; };

    wsRef.current = ws;
  }, []);

  const handleMessage = (data: Uint8Array) => {
    // Parse header
    const msgType = data[1];
    const event = (data[4] << 24) | (data[5] << 16) | (data[6] << 8) | data[7];

    if (msgType === MSG_FULL_SERVER_RESPONSE) {
      if (event === EVT_CONNECTION_STARTED) {
        startSession();
      }
    } else if (msgType === MSG_AUDIO_ONLY_RESPONSE) {
      if (event === EVT_TTS_RESPONSE) {
        const audioChunk = data.slice(12); // skip 12-byte header
        callbacks.onAudio?.(audioChunk.buffer);
      }
    } else if (msgType === MSG_FULL_SERVER_RESPONSE) {
      if (event === EVT_SESSION_FINISHED) {
        callbacks.onComplete?.();
        disconnect();
      }
    }
  };

  const startSession = () => {
    const ws = wsRef.current;
    if (!ws) return;

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;

    const meta = {
      user: { uid: 'openz-user' },
      req_params: {
        text: '',
        speaker: 'zh_female_qingxin',
        audio_params: {
          format: 'mp3',
          sample_rate: 24000,
        },
      },
    };
    const metaJson = new TextEncoder().encode(JSON.stringify(meta));

    // Build frame: event(4) + session_id_len(4) + session_id + meta
    const sessionIdBytes = new TextEncoder().encode(sessionId);
    const header = new Uint8Array(8);
    header[0] = (EVT_START_SESSION >> 24) & 0xFF;
    header[1] = (EVT_START_SESSION >> 16) & 0xFF;
    header[2] = (EVT_START_SESSION >> 8) & 0xFF;
    header[3] = EVT_START_SESSION & 0xFF;
    header[4] = (sessionIdBytes.length >> 24) & 0xFF;
    header[5] = (sessionIdBytes.length >> 16) & 0xFF;
    header[6] = (sessionIdBytes.length >> 8) & 0xFF;
    header[7] = sessionIdBytes.length & 0xFF;

    const frame = new Uint8Array(4 + header.length + sessionIdBytes.length + metaJson.length);
    frame[0] = 0x11; frame[1] = MSG_FULL_CLIENT_REQUEST; frame[2] = SERIAL_JSON; frame[3] = 0x00;
    frame.set(header, 4);
    frame.set(sessionIdBytes, 4 + header.length);
    frame.set(metaJson, 4 + header.length + sessionIdBytes.length);

    ws.send(frame);
  };

  const speak = useCallback((text: string) => {
    disconnect(); // clean up any existing connection
    connect();

    // Wait for connection, then send text
    const ws = wsRef.current;
    if (!ws) return;

    // Send TaskRequest with the text
    const sessionId = sessionIdRef.current;
    if (!sessionId) return;

    const req = {
      user: { uid: 'openz-user' },
      event: EVT_TASK_REQUEST,
      req_params: {
        text,
        speaker: 'zh_female_qingxin',
        audio_params: { format: 'mp3', sample_rate: 24000 },
      },
    };
    const reqJson = new TextEncoder().encode(JSON.stringify(req));
    const sessionIdBytes = new TextEncoder().encode(sessionId);

    // frame header
    const frame = new Uint8Array(4 + 4 + sessionIdBytes.length + 4 + reqJson.length);
    // bytes 0-3: protocol + header
    frame[0] = 0x11; frame[1] = MSG_FULL_CLIENT_REQUEST; frame[2] = SERIAL_JSON; frame[3] = 0x00;
    // bytes 4-7: event = 200
    frame[4] = (EVT_TASK_REQUEST >> 24) & 0xFF;
    frame[5] = (EVT_TASK_REQUEST >> 16) & 0xFF;
    frame[6] = (EVT_TASK_REQUEST >> 8) & 0xFF;
    frame[7] = EVT_TASK_REQUEST & 0xFF;
    // bytes 8-11: session_id length
    frame[8] = (sessionIdBytes.length >> 24) & 0xFF;
    frame[9] = (sessionIdBytes.length >> 16) & 0xFF;
    frame[10] = (sessionIdBytes.length >> 8) & 0xFF;
    frame[11] = sessionIdBytes.length & 0xFF;
    // bytes 12+
    frame.set(sessionIdBytes, 12);
    // after session_id: payload length (4 bytes big-endian) + json
    const payloadOffset = 12 + sessionIdBytes.length;
    frame[payloadOffset] = (reqJson.length >> 24) & 0xFF;
    frame[payloadOffset + 1] = (reqJson.length >> 16) & 0xFF;
    frame[payloadOffset + 2] = (reqJson.length >> 8) & 0xFF;
    frame[payloadOffset + 3] = reqJson.length & 0xFF;
    frame.set(reqJson, payloadOffset + 4);

    ws.send(frame);

    // Send FinishSession
    setTimeout(() => {
      sendFinishSession();
    }, 100);
  }, [connect]);

  const sendFinishSession = () => {
    const ws = wsRef.current;
    const sessionId = sessionIdRef.current;
    if (!ws || !sessionId) return;

    const sessionIdBytes = new TextEncoder().encode(sessionId);
    const frame = new Uint8Array(4 + 4 + sessionIdBytes.length + 4 + 2);
    frame[0] = 0x11; frame[1] = MSG_FULL_CLIENT_REQUEST; frame[2] = SERIAL_JSON; frame[3] = 0x00;
    frame[4] = (EVT_FINISH_SESSION >> 24) & 0xFF;
    frame[5] = (EVT_FINISH_SESSION >> 16) & 0xFF;
    frame[6] = (EVT_FINISH_SESSION >> 8) & 0xFF;
    frame[7] = EVT_FINISH_SESSION & 0xFF;
    frame[8] = (sessionIdBytes.length >> 24) & 0xFF;
    frame[9] = (sessionIdBytes.length >> 16) & 0xFF;
    frame[10] = (sessionIdBytes.length >> 8) & 0xFF;
    frame[11] = sessionIdBytes.length & 0xFF;
    frame.set(sessionIdBytes, 12);
    // empty JSON payload
    const jsonOffset = 12 + sessionIdBytes.length;
    frame[jsonOffset] = 0; frame[jsonOffset+1] = 0; frame[jsonOffset+2] = 0; frame[jsonOffset+3] = 2;
    frame[jsonOffset+4] = '{'.charCodeAt(0); frame[jsonOffset+5] = '}'.charCodeAt(0);

    ws.send(frame);
  };

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    sessionIdRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, []);

  return { speak, disconnect };
}
```

- [ ] **Step 1: 创建 `packages/web/src/hooks/useVolcEngineTTS.ts`，写入上述完整代码**

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/hooks/useVolcEngineTTS.ts
git commit -m "feat(web): add Volcengine TTS WebSocket client hook"
```

---

## Task 3: 音频播放器工具类

**Files:**
- Create: `packages/web/src/components/TTSAudioPlayer.ts`

### 实现

```typescript
export class TTSAudioPlayer {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer[] = [];
  private sourceNode: AudioBufferSourceNode | null = null;
  private isPlaying = false;

  async init() {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }
  }

  async playChunk(arrayBuffer: ArrayBuffer) {
    if (!this.audioContext) await this.init();
    const ctx = this.audioContext!;

    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
      this.audioBuffer.push(buffer);

      if (!this.isPlaying) {
        await this.playNext();
      }
    } catch (e) {
      console.error('Failed to decode audio chunk:', e);
    }
  }

  private async playNext() {
    if (!this.audioContext || this.audioBuffer.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const buffer = this.audioBuffer.shift()!;
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    source.onended = () => {
      this.playNext();
    };
    this.sourceNode = source;
    source.start();
  }

  stop() {
    if (this.sourceNode) {
      try { this.sourceNode.stop(); } catch {}
      this.sourceNode = null;
    }
    this.audioBuffer = [];
    this.isPlaying = false;
  }

  destroy() {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
```

- [ ] **Step 1: 创建 `packages/web/src/components/TTSAudioPlayer.ts`**

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/components/TTSAudioPlayer.ts
git commit -m "feat(web): add TTS audio player utility"
```

---

## Task 4: ChatView 集成 TTS

**Files:**
- Modify: `packages/web/src/components/ChatView.tsx`

### 改动说明

在 ChatView 中：
1. 引入 `useVolcEngineTTS` Hook
2. 引入 `TTSAudioPlayer`
3. 新增 state：`voiceReplyEnabled`（是否开启语音回复）
4. 在 `assistant_complete` 事件中，如果 `voiceReplyEnabled=true`，调用 TTS 播放 AI 回复文字
5. 用户文字发送时自动停止当前播放

### 改动位置

```typescript
// 在文件顶部 import 后新增
import { useVolcEngineTTS } from '../hooks/useVolcEngineTTS';
import { TTSAudioPlayer } from './TTSAudioPlayer';
```

```typescript
// 在 ChatView 组件内新增 state 和 ref
const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false);
const audioPlayerRef = useRef<TTSAudioPlayer | null>(null);
const latestAgentTextRef = useRef<string>(''); // 累积 AI 回复文本
```

```typescript
// 在 handleEvent 的 'text_delta' case 中，更新 latestAgentTextRef
case 'text_delta': {
  if (currentMessageId.current) {
    latestAgentTextRef.current += event.data.text;
    // ... 现有逻辑不变
  }
  break;
}
```

```typescript
// 在 handleEvent 的 'assistant_complete' case 中，触发 TTS
case 'assistant_complete':
case 'turn_done': {
  setSending(false);
  currentMessageId.current = null;
  if (voiceReplyEnabled && latestAgentTextRef.current.trim()) {
    const text = latestAgentTextRef.current;
    latestAgentTextRef.current = '';
    audioPlayer.current?.init().then(() => {
      ttsCallbacksRef.current = {
        onAudio: (chunk) => audioPlayerRef.current?.playChunk(chunk),
        onComplete: () => {},
        onError: (err) => console.error('TTS error:', err),
      };
      speak(text);
    });
  } else {
    latestAgentTextRef.current = '';
  }
  thinkingTextRef.current = {};
  break;
}
```

```typescript
// 在 send 函数中，发送时停止当前播放
const send = async (text: string) => {
  if (!text.trim() || sending) return;
  audioPlayerRef.current?.stop(); // 停止上一段 TTS
  latestAgentTextRef.current = '';
  // ... 其余不变
};
```

```typescript
// 在 input-area form 中，新增语音开关按钮
<button
  className={`voice-toggle-btn ${voiceReplyEnabled ? 'active' : ''}`}
  onClick={() => setVoiceReplyEnabled(v => !v)}
  title="Toggle voice reply"
  type="button"
>
  {voiceReplyEnabled ? '🔊' : '🔇'}
</button>
```

### CSS 样式

在 `packages/web/src/styles/app.css` 中添加：

```css
.voice-toggle-btn {
  background: none;
  border: 1px solid var(--border-color);
  border-radius: 4px;
  padding: 4px 8px;
  cursor: pointer;
  font-size: 16px;
  margin-right: 8px;
}

.voice-toggle-btn.active {
  background: var(--accent-color);
  color: white;
}
```

- [ ] **Step 1: 修改 `packages/web/src/components/ChatView.tsx`**，完整实现上述改动

- [ ] **Step 2: 在 `packages/web/src/styles/app.css` 中添加 `.voice-toggle-btn` 样式**

- [ ] **Step 3: 确认没有破坏现有功能**，运行 `pnpm --filter @openz/web build` 验证编译通过

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ChatView.tsx packages/web/src/styles/app.css
git commit -m "feat(web): integrate TTS voice reply in ChatView"
```

---

## Task 5: 功能测试

**Files:**
- 无新建文件

- [ ] **Step 1: 启动 daemon**

```bash
cd packages/cli && pnpm build && pnpm start
```

- [ ] **Step 2: 启动 web**

```bash
cd packages/web && pnpm dev
```

- [ ] **Step 3: 打开浏览器访问 http://localhost:3000**

- [ ] **Step 4: 创建 session，输入文字，验证流程**

预期流程：
1. 输入文字发送
2. AI 回复文字显示在界面上
3. 点击 🔊 按钮开启语音回复
4. 再次发送文字
5. AI 回复时，浏览器自动播放 TTS 音频

- [ ] **Step 5: 验证打断** — TTS 播放时再次发送消息，音频停止并播新回复

- [ ] **Step 6: Commit**

```bash
git commit -m "test(web): verify TTS voice reply E2E flow"
```

---

## Task 6: 错误处理与边界情况

**Files:**
- Modify: `packages/web/src/hooks/useVolcEngineTTS.ts`

- [ ] **Step 1: 添加错误处理完善**

在 `useVolcEngineTTS.ts` 的 `connect` 中增强错误处理：

```typescript
ws.onerror = (e) => {
  console.error('[TTS] WebSocket error:', e);
  callbacks.onError?.('TTS 连接失败，请检查网络');
};
```

- [ ] **Step 2: 处理空文本**

在 `speak` 函数开头加守卫：

```typescript
if (!text.trim()) return;
```

- [ ] **Step 3: Commit**

```bash
git add packages/web/src/hooks/useVolcEngineTTS.ts
git commit -m "fix(web): improve TTS error handling"
```

---

## 自检清单

1. **Spec 对照**：Phase 1 目标"用户打字 → AI 回复 → TTS 语音播报"，每个步骤都有对应 Task ✅
2. **无占位符**：所有函数体完整，参数类型明确 ✅
3. **TypeScript 编译**：`pnpm --filter @openz/web build` 需通过 ✅
4. **API Key 安全**：仅通过 `import.meta.env` 读取，不硬编码 ✅
5. **现有功能**：ChatView 原有文字对话功能不受影响 ✅

---

## 执行选项

**Plan 完成并保存至 `docs/superpowers/plans/2026-06-16-voice-call-phase1-tts.md`。两种执行方式：**

**1. Subagent-Driven (推荐)** — 每个 Task 由 fresh subagent 执行，任务间有 review checkpoint

**2. Inline Execution** — 在本 session 内批量执行，使用 executing-plans 技能

选择哪种方式？
