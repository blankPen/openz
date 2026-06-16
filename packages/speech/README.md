# volc-speech-js-sdk

火山引擎 v3 双向流式 TTS 的 TypeScript SDK,含协议层 + Node 端 + 浏览器端三层,并附一个可跑的 example 服务。

## 项目结构

```
.
├── src/                       SDK 本体(3 层,纯函数 + 业务封装)
│   ├── protocol/              @openz/speech/protocol  零依赖,字节编解码
│   ├── server/                @openz/speech/server    Node 端 TTS 业务封装
│   └── client/                @openz/speech/client    浏览器 PCM 播放 + WS 客户端
├── dist/                      `npm run build` 产物(SDK 3 个子路径)
├── example/                   example 服务,SDK 用法参考实现
│   ├── src/server.ts          HTTP + WebSocket 入口
│   ├── src/chunked-text.ts    LLM 流式喂入模拟
│   └── public/index.html      浏览器播放页(import SDK 客户端 ESM)
└── docs/superpowers/          设计文档 + 实施计划
```

## 快速开始

### 1. 构建 SDK

```bash
npm install
npm run build      # 输出到 dist/{protocol,server,client}/
```

### 2. 配置鉴权

在仓库根目录创建或编辑 `.env`:

```bash
cp .env.example .env
# 编辑 .env 填入 VOLC_APPKEY
```

获取 APPKEY:火山引擎新版控制台 → 「大模型语音合成」→ 「在线体验」页面会显示 API Key,或在「密钥管理」中创建。

### 3. 跑 example

```bash
cd example
npm install
npm run dev        # 监听 http://localhost:3000
```

打开浏览器访问 `http://localhost:3000/`,点击「▶ 播放」即可听到合成。

## SDK 子路径

SDK 通过 `package.json` 的 `exports` 字段暴露 3 个子路径,使用者按需 import:

| 子路径 | 用途 | 运行时 |
|--------|------|--------|
| `@openz/speech/protocol` | 协议编解码、`build*` 纯函数 | 跨端(Node / 浏览器) |
| `@openz/speech/server` | Node 端 TTS 业务封装(`bidirectionTts` / `bidirectionTtsStream`) | Node only |
| `@openz/speech/client` | 浏览器 PCM 播放器 + WebSocket 客户端 | 浏览器 only |

### @openz/speech/server(服务端用法)

```typescript
import { bidirectionTts, bidirectionTtsStream, DEFAULT_SAMPLE_RATE } from '@openz/speech/server'
import * as fs from 'node:fs'

// 1. 落盘版本:合成完毕写到单个文件
const file = await bidirectionTts({
  appkey: process.env.VOLC_APPKEY!,
  resourceId: 'seed-tts-2.0',
  voiceType: 'saturn_zh_female_aojiaonvyou_tob',
  texts: ['你好,世界。'],   // 也支持 AsyncIterable
  encoding: 'mp3',
})
// → '/path/to/saturn_zh_female_aojiaonvyou_tob.mp3'

// 2. 流式版本:每收到一帧音频就 push 到 Readable,边收边推
const stream = bidirectionTtsStream({
  appkey: process.env.VOLC_APPKEY!,
  resourceId: 'seed-tts-2.0',
  voiceType: 'saturn_zh_female_aojiaonvyou_tob',
  texts: asyncGen(),   // AsyncIterable<string>,可边生成边喂入
  encoding: 'pcm',      // 流式场景建议 pcm
  sampleRate: DEFAULT_SAMPLE_RATE,  // 24000
  onAudioFrame: (frame) => { /* 每帧回调 */ },
  onChunk: (index, text, at) => { /* 每段文本回调 */ },
  onFirstFrame: (at) => { /* 首帧回调 */ },
})

stream.on('data', (chunk) => res.write(chunk))
stream.on('end', () => res.end())
stream.on('error', (err) => res.destroy(err))
```

`texts` 是 `AsyncIterable<string> | Iterable<string>`,关键设计:用 `for await` 拉取每个片段,前一个 `TaskRequest` 发完才拉取下一段,**LLM 边生成边喂入的延迟会被自然吞掉**。

```typescript
// 模拟 LLM 流式:每段间 500ms ±50% 抖动
async function* simulatedLlm() {
  yield '你好,'
  await sleep(500 + Math.random() * 500)
  yield '我是豆包。'
  await sleep(500 + Math.random() * 500)
  yield '再见!'
}
```

### @openz/speech/client(浏览器端用法)

ESM 引入 + DOM API 即可:

```html
<script type="module">
  import { PCMPlayer, TtsClient } from '/path/to/sdk-client.esm.js'

  // 1. 建 PCM 播放器
  const pcmPlayer = new PCMPlayer({
    inputCodec: 'Int16',
    channels: 1,
    sampleRate: 24000,
    flushTime: 200,
  })

  // 2. 建 WS 客户端
  const client = new TtsClient({
    url: '/api/tts/ws',
    text: '你好,世界。',
    voiceType: 'saturn_zh_female_aojiaonvyou_tob',
    resourceId: 'seed-tts-2.0',
    simulateStream: false,  // true / number 模拟 LLM
    onSessionStart: (info) => {
      console.log('session:', info.sampleRate, info.encoding)
    },
    onChunk: (info) => {
      console.log(`chunk #${info.index} "${info.text.slice(0, 20)}..."`)
    },
    onFirstFrame: (at) => {
      console.log(`first frame +${at}ms`)
    },
    onAudioFrame: (data) => {
      // ArrayBuffer 原始 PCM 字节
      pcmPlayer.feed(new Uint8Array(data))
    },
    onEnd: (info) => {
      console.log(`end: ${info.totalFrames} frames, ${info.totalBytes} bytes`)
    },
    onError: (msg) => console.error(msg),
    onClose: () => console.log('closed'),
  })

  client.start()
</script>
```

**音频帧协议**(PCMPlayer 与 TtsClient 配合时):
- `encoding: 'pcm'`,`sampleRate: 24000`,`channels: 1`
- `Int16` little-endian 单声道
- 直接把 ArrayBuffer 喂给 `pcmPlayer.feed()`,内部按 200ms 间隔分批 `AudioBufferSourceNode.start()` 顺序播放

### @openz/speech/protocol(协议层,可选)

低层使用场景:自己做协议层实现或调试。

```typescript
import { EventType, MsgType, buildStartConnection, marshalMessage, unmarshalMessage } from '@openz/speech/protocol'

// 构造 StartConnection 帧(纯函数,不发)
const frame = buildStartConnection()  // Uint8Array

// 解析服务端响应
const msg = unmarshalMessage(receivedBytes)
console.log(msg.type, msg.event, msg.payload)
```

## example 服务详解

`example/` 是 SDK 的参考实现,展示如何在真实业务里组合使用 SDK。

### 路由

| 路径 | 方法 | 用途 |
|------|------|------|
| `/` | GET | 浏览器播放页面 |
| `/static/*` | GET | 暴露 `dist/client/` 下所有 SDK 客户端 ESM(供 `<script type="module">` 引用) |
| `/api/tts` | POST | 流式 PCM 字节流(原始 `Readable` 转发) |
| `/api/tts/ws` | WebSocket | 结构化事件流(推荐,见下) |

### WS 事件协议(推荐用法)

`/api/tts/ws` 用结构化事件流,前端能区分「段边界」「首帧」「音频数据」「结束」:

**C → S:**
```json
{
  "type": "start",
  "text": "你好,世界。今天天气不错,适合出门。",
  "voiceType": "saturn_zh_female_aojiaonvyou_tob",
  "resourceId": "seed-tts-2.0",
  "simulateStream": false
}
```

**S → C(文本事件):**
```json
{ "type": "session_start", "sampleRate": 24000, "encoding": "pcm", "channels": 1 }
{ "type": "chunk", "index": 1, "text": "你好,世界。", "at": 12 }
{ "type": "first_frame", "at": 567 }
{ "type": "end", "totalFrames": 13, "totalBytes": 228702 }
{ "type": "error", "error": "..." }
```

**S → C(二进制帧):** Int16 LE PCM 字节流,直接喂 PCMPlayer。

## 测试

```bash
# SDK 端到端
cd example
npm run dev

# 浏览器打开 http://localhost:3000/
# 点击 ▶ 播放,听合成;勾选「模拟 LLM」听分段效果
```

无 APPKEY 时浏览器会收到 `error: VOLC_APPKEY not configured` 事件,链路仍可验证(DevTools Network 应看到 `/static/sdk-client.esm.js` → `pcm-player.js` → `tts-client.js` 三个 200)。

## SDK API 全景

### Server 层

```typescript
export const DEFAULT_SAMPLE_RATE: 24000

export interface BidirectionTtsOptions {
  appkey: string
  resourceId: string                 // 'seed-tts-1.0' | 'seed-tts-2.0'
  voiceType: string                  // 必须与 resourceId 同一代
  texts: AsyncIterable<string> | Iterable<string>
  encoding?: string                  // 默认 'mp3',流式建议 'pcm'
  sampleRate?: number                // 默认 24000
  endpoint?: string                  // 默认官方 bidirection
  outputFile?: string                // 仅 bidirectionTts(落盘版本)
}

export interface RunOptions extends BidirectionTtsOptions {
  onAudioFrame?: (frame: Buffer) => void | Promise<void>
  onChunk?: (index: number, text: string, at: number) => void
  onFirstFrame?: (at: number) => void
}

export async function bidirectionTts(opts: BidirectionTtsOptions): Promise<string>
export function bidirectionTtsStream(opts: RunOptions): Readable
```

### Client 层

```typescript
export class PCMPlayer {
  constructor(options: PCMPlayerOptions)
  feed(data: ArrayBuffer | Uint8Array): void
  volume(v: number): void
  pause(): Promise<void>
  continue(): Promise<void>
  destroy(): void
  readonly audioCtx: AudioContext
}

export class TtsClient {
  constructor(options: TtsClientOptions)
  start(): void
  stop(): void
  readonly state: 'idle' | 'connecting' | 'open' | 'streaming' | 'closed'
}
```

## 关键设计点

1. **协议层零运行时依赖** — 纯 TS + Uint8Array + TextEncoder,Node / 浏览器通用
2. **服务端用 ws 库的 WebSocket,客户端用浏览器原生 WebSocket** — 两边 API 表面类似,但 runtime 隔离清晰
3. **PCM 流式优于 MP3 流式** — MP3 必须整段解码,无法边收边播;PCM Int16 + 24kHz 可以被 Web Audio API 边收边解码
4. **sender/receiver 并发** — TaskRequest 流式喂入的同时,服务端就开始推 AudioOnlyServer 帧,首帧延迟 ≈ 首段合成时间,而不是整段合成时间
5. **错误用 `Error` 实例** — `stream.destroy(err)` 推到 Readable,消费者自行处理
6. **资源释放** — `_runBidirection` 用 `try/finally` 关闭 ws;`PCMPlayer.destroy()` 清理 `setInterval` 和 AudioContext

## 故障排查

| 现象 | 原因 | 解决 |
|------|------|------|
| `[server] VOLC_APPKEY 未设置` | 根 `.env` 没配 | 编辑 `/Users/admin/Downloads/volcengine_bidirection_demo/.env` |
| 浏览器 `❌ error: VOLC_APPKEY not configured` | 同上,鉴权未通过 | 同上 |
| 浏览器收到 `❌ error: ...` 但无 APPKEY 提示 | APPKEY 错误或过期 | 重新生成 API Key |
| 浏览器 Network `GET .../pcm-player 404` | SDK tsconfig 用了 `Bundler`,产物 import 不带 `.js` | 改用 `NodeNext` 重新 build |
| `tsc` 报 `TS2835: Relative import paths need explicit file extensions` | 强制 NodeNext 后未给所有 import 加 `.js` | 所有相对 import 写成 `./foo.js` |
| 浏览器无声音 | 用户首次点击未触发 AudioContext resume | 已在 SDK client 中 `audioCtx.resume()`,但浏览器自动播放策略可能仍拦截,确认是用户主动点击 |
| `Cannot find module 'ws'` | example 依赖未装 | `cd example && npm install` |

## 文档

- 设计文档: `docs/superpowers/specs/2026-06-16-volc-tts-sdk-refactor-design.md`
- 实施计划: `docs/superpowers/plans/2026-06-16-volc-tts-sdk-refactor.md`
