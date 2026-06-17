# Phase 1: TTS 语音回复实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用户在 ChatView 输入文字 → daemon AI 处理 + 流式 TTS → 音频帧推送回前端 → 前端实时播放

**Architecture:** TTS 放在 daemon 层（Node.js），利用 `ws` 库支持自定义 headers。AI `text_delta` 边吐边给 TTS，实现并行流式管道（不是等 AI 完全回复再调 TTS）。

**Tech Stack:** Node.js `ws` + `socket.io` + Web Audio API

**关键文件（已跑通参考）：**
- `resources/src/protocols.ts` — V3 二进制协议完整 marshal/unmarshal
- `resources/src/volcengine/bidirection.ts` — TTS 调用入口（Node.js）

---

## 文件结构

```
packages/cli/src/
├── daemon/
│   ├── volcengine/
│   │   ├── protocols.ts    # [从 resources/src 复制] V3 协议
│   │   └── ttsManager.ts   # [新建] TTS 管理器（流式文本输入 → 音频帧输出）
│   └── server.ts           # [修改] 新增 session:voice_reply 事件
└── agents/
    └── volcengine/         # TTS 相关目录（可选组织）

packages/web/src/
├── hooks/
│   └── useAudioPlayer.ts   # [新建] Web Audio API 音频播放器
└── components/
    └── ChatView.tsx        # [修改] 集成语音回复开关 + 音频帧接收
```

---

## Task 1: Daemon — 复制 TTS 协议层

**Files:**
- Create: `packages/cli/src/daemon/volcengine/protocols.ts`
- Create: `packages/cli/src/daemon/volcengine/index.ts`

- [ ] **Step 1: 创建目录并复制 protocols.ts**

```bash
mkdir -p packages/cli/src/daemon/volcengine
cp resources/src/protocols.ts packages/cli/src/daemon/volcengine/protocols.ts
```

- [ ] **Step 2: 验证 protocols.ts 语法**

```bash
cd packages/cli && pnpm tsc --noEmit src/daemon/volcengine/protocols.ts
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/daemon/volcengine/
git commit -m "feat(daemon): copy TTS protocols from resources"
```

---

## Task 2: Daemon — TTS 管理器（TTSManager）

**Files:**
- Create: `packages/cli/src/daemon/volcengine/ttsManager.ts`

### TTSManager 职责

```typescript
// TTSManager 接收 AI 吐出的文字片段，边收边合成
// 音频帧通过回调实时吐出，由调用方（server.ts）推送给前端
export class TTSManager {
  constructor(opts: {
    appkey: string;
    resourceId: string;
    voiceType: string;
    onAudio: (frame: Buffer) => void;
    onComplete: () => void;
    onError: (err: string) => void;
  })

  // 喂入一个文字片段（可多次调用）
  feedText(text: string): void

  // 结束当前 TTS session
  finish(): void

  // 打断（CancelSession）
  interrupt(): void

  // 销毁连接
  destroy(): void
}
```

### 核心逻辑（基于 bidirection.ts 改造）

参考 `resources/src/volcengine/bidirection.ts` 的实现，但改造为：
1. 不等所有文本收齐，而是 `feedText()` 后立即发送 `TaskRequest`
2. `onAudio` 回调实时吐出音频帧
3. 支持 `interrupt()` 发送 `CancelSession`

```typescript
import WebSocket from 'ws';
import { MsgType, EventType, StartConnection, StartSession, TaskRequest, FinishSession, FinishConnection, ReceiveMessage, WaitForEvent } from './protocols';

const TTS_WS_URL = 'wss://openspeech.bytedance.com/api/v3/tts/bidirection';

export class TTSManager {
  private ws: WebSocket | null = null;
  private sessionId: string = '';
  private headers: Record<string, string>;
  private onAudio: (frame: Buffer) => void;
  private onComplete: () => void;
  private onError: (err: string) => void;
  private isFinished = false;
  private textBuffer: string[] = [];
  private connectResolve?: () => void;

  constructor(opts: {
    appkey: string;
    resourceId: string;
    voiceType: string;
    onAudio: (frame: Buffer) => void;
    onComplete: () => void;
    onError: (err: string) => void;
  }) {
    this.headers = {
      'X-Api-Key': opts.appkey,
      'X-Api-Resource-Id': opts.resourceId,
    };
    this.onAudio = opts.onAudio;
    this.onComplete = opts.onComplete;
    this.onError = opts.onError;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(TTS_WS_URL, { headers: this.headers });
      this.ws.on('open', async () => {
        await StartConnection(this.ws!);
        const connMsg = await WaitForEvent(this.ws!, MsgType.FullServerResponse, EventType.ConnectionStarted);
        this.sessionId = crypto.randomUUID();
        await StartSession(this.ws!, new TextEncoder().encode(JSON.stringify({
          user: { uid: 'openz-daemon' },
          req_params: {
            speaker: 'saturn_zh_female_aojiaonvyou_tob',
            audio_params: { format: 'mp3', sample_rate: 24000, enable_timestamp: true },
            additions: JSON.stringify({ disable_markdown_filter: false }),
          },
          event: EventType.StartSession,
        })), this.sessionId);
        const sessMsg = await WaitForEvent(this.ws!, MsgType.FullServerResponse, EventType.SessionStarted);
        resolve();
      });
      this.ws.on('error', (err) => this.onError(err.message));
      this.ws.on('close', () => { if (!this.isFinished) this.onError('connection closed'); });
    });
  }

  feedText(text: string): void {
    if (!this.ws || !this.sessionId) return;
    const payload = new TextEncoder().encode(JSON.stringify({
      user: { uid: 'openz-daemon' },
      req_params: {
        speaker: 'saturn_zh_female_aojiaonvyou_tob',
        audio_params: { format: 'mp3', sample_rate: 24000 },
        text,
      },
      event: EventType.TaskRequest,
    }));
    TaskRequest(this.ws, payload, this.sessionId);
  }

  async finish(): Promise<void> {
    if (!this.ws || !this.sessionId) return;
    this.isFinished = true;
    await FinishSession(this.ws, this.sessionId);
    // 收集所有音频帧
    while (true) {
      const msg = await ReceiveMessage(this.ws);
      if (msg.type === MsgType.AudioOnlyServer) {
        this.onAudio(Buffer.from(msg.payload));
      }
      if (msg.event === EventType.SessionFinished) break;
    }
    await FinishConnection(this.ws);
    this.ws.close();
    this.onComplete();
  }

  interrupt(): void {
    this.isFinished = true;
    // 发送 CancelSession
    if (this.ws && this.sessionId) {
      // 调用 CancelSession（需要先定义，或用现有协议）
    }
    this.destroy();
  }

  destroy(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
```

- [ ] **Step 1: 创建 `packages/cli/src/daemon/volcengine/ttsManager.ts`**

实现上述 TTSManager 类，参考 `resources/src/volcengine/bidirection.ts` 的流式逻辑。

- [ ] **Step 2: 验证编译**

```bash
cd packages/cli && pnpm tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/src/daemon/volcengine/ttsManager.ts
git commit -m "feat(daemon): add TTSManager for streaming TTS"
```

---

## Task 3: Daemon — 新增 session:voice_reply 事件

**Files:**
- Modify: `packages/cli/src/daemon/server.ts`

### 改动说明

在 `session:send` 的处理中，当用户开启语音回复时，daemon 需要：
1. 启动 TTSManager
2. 把 AI 的 `text_delta` 实时 feed 给 TTS
3. TTS 音频帧通过 `socket.emit('session:voice_audio', { sessionId, data: audioBuffer })` 推给前端

### 新增事件处理

```typescript
// 在 server.ts 的 io.on('connection') 内添加

socket.on('session:voice_reply', async (req: { sessionId: string; text: string }, ack) => {
  const session = sessionManager.getSession(req.sessionId);
  if (!session) { ack?.({ error: 'Session not found' }); return; }

  const ttsManager = new TTSManager({
    appkey: process.env.VOLCENGINE_API_KEY!,
    resourceId: 'seed-tts-2.0',
    voiceType: 'saturn_zh_female_aojiaonvyou_tob',
    onAudio: (frame) => {
      // 流式推送音频帧给前端
      socket.emit('session:voice_audio', { sessionId: req.sessionId, data: frame.toString('base64') });
    },
    onComplete: () => {
      socket.emit('session:voice_audio', { sessionId: req.sessionId, data: null }); // null = 结束
    },
    onError: (err) => {
      socket.emit('session:voice_error', { sessionId: req.sessionId, error: err });
    },
  });

  await ttsManager.connect();
  ttsManager.feedText(req.text);
  ttsManager.finish();

  ack?.({ ok: true });
});
```

- [ ] **Step 1: 修改 `packages/cli/src/daemon/server.ts`**

新增 `session:voice_reply` 事件处理。

- [ ] **Step 2: 添加环境变量读取**

在 `server.ts` 顶部添加：

```typescript
const VOLCENGINE_API_KEY = process.env.VOLCENGINE_API_KEY;
```

- [ ] **Step 3: 验证编译**

```bash
cd packages/cli && pnpm tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/daemon/server.ts
git commit -m "feat(daemon): add session:voice_reply event with TTS streaming"
```

---

## Task 4: Frontend — 音频播放器 Hook

**Files:**
- Create: `packages/web/src/hooks/useAudioPlayer.ts`

### 实现

```typescript
import { useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioBufferRef = useRef<AudioBuffer[]>([]);
  const sourceNodeRef = useRef<AudioBufferSourceNode | null>(null);
  const isPlayingRef = useRef(false);

  const init = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
  }, []);

  const playChunk = useCallback(async (base64Data: string) => {
    await init();
    const ctx = audioContextRef.current!;
    const arrayBuffer = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0)).buffer;
    try {
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      audioBufferRef.current.push(buffer);
      if (!isPlayingRef.current) {
        playNext(ctx);
      }
    } catch (e) {
      console.error('[AudioPlayer] decode error:', e);
    }
  }, [init]);

  const playNext = useCallback((ctx: AudioContext) => {
    if (audioBufferRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;
    const buffer = audioBufferRef.current.shift()!;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => playNext(ctx);
    sourceNodeRef.current = source;
    source.start();
  }, []);

  const stop = useCallback(() => {
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.stop(); } catch {}
      sourceNodeRef.current = null;
    }
    audioBufferRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const destroy = useCallback(() => {
    stop();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stop]);

  return { playChunk, stop, destroy };
}
```

- [ ] **Step 1: 创建 `packages/web/src/hooks/useAudioPlayer.ts`**

- [ ] **Step 2: Commit**

```bash
git add packages/web/src/hooks/useAudioPlayer.ts
git commit -m "feat(web): add useAudioPlayer Web Audio API hook"
```

---

## Task 5: Frontend — ChatView 集成语音回复

**Files:**
- Modify: `packages/web/src/components/ChatView.tsx`

### 改动说明

1. 引入 `useAudioPlayer`
2. 新增 state：`voiceReplyEnabled`
3. 监听 `socket.on('session:voice_audio', ...)` 事件，调用 `playChunk`
4. `text_delta` 时：如果是语音回复模式，实时把文字发送给 daemon（通过 `session:voice_reply`）
5. 输入框旁新增 🔊 按钮

### 关键代码位置

```typescript
import { useAudioPlayer } from '../hooks/useAudioPlayer';

// 在 ChatView 内
const [voiceReplyEnabled, setVoiceReplyEnabled] = useState(false);
const { playChunk, stop: stopAudio } = useAudioPlayer();

// 在 useEffect 中监听音频帧
useEffect(() => {
  const handler = (data: { sessionId: string; data: string | null }) => {
    if (data.sessionId !== sessionId) return;
    if (data.data === null) {
      // 结束
    } else {
      playChunk(data.data);
    }
  };
  socket.on('session:voice_audio', handler);
  return () => socket.off('session:voice_audio', handler);
}, [sessionId, playChunk]);

// 在 handleSubmit 或 send 函数中
// 如果 voiceReplyEnabled=true，改为调用 session:voice_reply 而不是 session:send
// 或者：session:send 保持不变，同时触发 voice_reply（daemon 自动语音回复）
```

- [ ] **Step 1: 修改 `ChatView.tsx`**

集成语音回复开关和音频播放。

- [ ] **Step 2: 添加 CSS 样式**

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
  background: var(--accent-color, #4a90e2);
  color: white;
}
```

- [ ] **Step 3: 验证编译**

```bash
cd packages/web && pnpm build
```

- [ ] **Step 4: Commit**

```bash
git add packages/web/src/components/ChatView.tsx packages/web/src/styles/app.css
git commit -m "feat(web): integrate voice reply in ChatView"
```

---

## Task 6: 环境变量配置

**Files:**
- Create: `packages/cli/.env`（或确认已有）
- Modify: `packages/cli/src/daemon/server.ts`（读取 env）

- [ ] **Step 1: 创建 `packages/cli/.env`**

```env
VOLCENGINE_API_KEY=d098393c-32be-4b38-9814-c85da94dc6c6
```

- [ ] **Step 2: 确认 `.env` 在 `.gitignore` 中**

```bash
grep -q ".env" packages/cli/.gitignore || echo ".env" >> packages/cli/.gitignore
```

- [ ] **Step 3: Commit**

```bash
git add packages/cli/.env packages/cli/.gitignore
git commit -m "chore(daemon): add VOLCENGINE_API_KEY env var"
```

---

## Task 7: E2E 测试验证

- [ ] **Step 1: 启动 daemon**

```bash
cd packages/cli && pnpm build && pnpm start
```

- [ ] **Step 2: 启动 web**

```bash
cd packages/web && pnpm dev
```

- [ ] **Step 3: 浏览器访问 http://localhost:3000**

1. 创建 session
2. 输入文字发送，观察 AI 回复是否正常（文字）
3. 点击 🔊 按钮开启语音回复
4. 再次输入文字
5. 观察是否听到 TTS 语音播报

- [ ] **Step 4: Commit**

```bash
git commit -m "test: E2E verify TTS voice reply flow"
```

---

## 自检清单

1. **Spec 对照**：Phase 1 目标"用户打字 → AI 回复 → TTS 流式播报" ✅
2. **架构正确**：TTS 在 daemon 层（Node.js ws），前端只接收音频帧 ✅
3. **并行流式**：AI `text_delta` 边吐边给 TTS，不是等完全回复 ✅
4. **Protocols 复用**：`resources/src/protocols.ts` 已验证，直接复制使用 ✅
5. **环境变量**：`VOLCENGINE_API_KEY` 不提交到 git ✅
6. **编译通过**：daemon 和 web 都要 `pnpm build` 通过 ✅

---

## 执行选项

**Plan 完成。两种执行方式：**

**1. Subagent-Driven (推荐)** — 每个 Task 由 fresh subagent 执行，任务间有 review checkpoint

**2. Inline Execution** — 在本 session 内批量执行，使用 executing-plans 技能

选择哪种方式？
