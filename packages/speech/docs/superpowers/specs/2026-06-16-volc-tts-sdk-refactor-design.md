# 火山引擎 TTS 流式 SDK 重构设计

> 2026-06-16 · 重构目标:把音频处理/解析封装成 SDK(含前后端),当前 demo 服务改造为 example

## 1. 背景与目标

当前仓库 `volcengine_bidirection_demo` 是一个端到端 demo:`src/server.ts`(Node) +
`public/index.html`(浏览器)演示了火山引擎 v3 双向流式 TTS 的「边生成边播放」能力。

问题:
- `src/protocols.ts`(协议编解码)、`src/volcengine/bidirection.ts`(TTS 业务)、
  `public/index.html` 内的 `PCMPlayer` 类和 ws 处理逻辑混在一起,无法被其他项目复用
- demo 的 HTTP 路由、WS 路由、模拟 LLM 流式延时、UI 日志展示业务代码与核心逻辑未分离
- 没有清晰的 SDK 边界,既不能独立测试,也无法在浏览器 / Node 不同运行时分别打包

目标:
- 把「音频处理 / 解析」相关代码(协议编解码、TTS 业务、浏览器 PCM 播放 + WS 客户端)封装成
  一个 npm 包 `@openz/speech`,通过 exports map 暴露 `@openz/speech/protocol` /
  `@openz/speech/server` / `@openz/speech/client` 三个子路径
- 当前 demo 改造为 `example/` 子目录下的 example 服务,作为 SDK 用法的参考实现

不在本次重构范围:
- 不引入新框架(保持纯 `tsc` + `ts-node`,无 webpack/rollup/vite)
- 不引入测试框架(以类型检查 + 端到端冒烟为验证手段)
- 不改变 SDK 的对外 API 行为(语义保持兼容)
- 不发布到 npm(本地 `file:` 引用即可)

## 2. 架构

### 2.1 目录布局

```
volcengine_bidirection_demo/
├── package.json                          ← SDK 本体 (name: volc-speech-js-sdk)
├── tsconfig.json                         (SDK 根 tsconfig,生成 .d.ts)
├── src/                                  ← SDK 源码
│   ├── protocol/
│   │   ├── index.ts                      (re-export 公共 API)
│   │   ├── messages.ts                   (EventType / MsgType / ... 枚举 + Message 接口)
│   │   ├── codec.ts                      (createMessage / marshalMessage / unmarshalMessage)
│   │   └── frame.ts                      (build* 纯函数)
│   ├── server/
│   │   ├── index.ts
│   │   ├── bidirection.ts                (_runBidirection / bidirectionTts / bidirectionTtsStream)
│   │   └── types.ts                      (BidirectionTtsOptions / RunOptions)
│   └── client/
│       ├── index.ts
│       ├── pcm-player.ts                 (PCMPlayer 类)
│       ├── tts-client.ts                 (TtsClient 类)
│       └── types.ts                      (PCMPlayerOptions / TtsClientOptions / 事件信息类型)
├── dist/                                 (SDK 构建产物,git 忽略)
├── example/                              ← example 服务
│   ├── package.json                      (name: @openz/tts-demo-example)
│   ├── tsconfig.json
│   ├── src/
│   │   ├── server.ts                     (HTTP + WS 入口)
│   │   └── chunked-text.ts               (LLM 模拟:段间延时)
│   └── public/
│       └── index.html                    (import SDK 客户端 ESM)
├── docs/superpowers/specs/
├── .env
├── .env.example
└── ...
```

### 2.2 包结构与依赖

```
@openz/speech/protocol  ←  运行时零依赖
        ↑             (内部不 import 'buffer' 包,使用 Node 与浏览器都内置的 Uint8Array;
        │              若需 Buffer.from(str, 'utf8') 等 API,改用 TextEncoder.encode)
        │
        │ (仅 server 层 import build*;client 层不依赖 protocol)
        │
@openz/speech/server     ←  ws, uuid, node:stream
        (仅 Node 端,通过 'file:..' 引用)

@openz/speech/client     ←  零依赖(只用浏览器原生 API: AudioContext, WebSocket)
        (构建为 ESM,example 用 <script type="module"> 引用)
```

`server` 与 `client` **不互相依赖**,只共享 `protocol` 层。`protocol` 不知道
`server` / `client` 存在。

## 3. SDK 三层 API 设计

### 3.1 `@openz/speech/protocol`

#### 枚举与消息

```typescript
export enum EventType { ... }              // 1 / 50 / 100 / 150 ...
export enum MsgType { ... }
export enum MsgTypeFlagBits { ... }
export enum VersionBits { ... }
export enum HeaderSizeBits { ... }
export enum SerializationBits { ... }
export enum CompressionBits { ... }

export interface Message {
  version: VersionBits
  headerSize: HeaderSizeBits
  type: MsgType
  flag: MsgTypeFlagBits
  serialization: SerializationBits
  compression: CompressionBits
  event?: EventType
  sessionId?: string
  connectId?: string
  sequence?: number
  errorCode?: number
  payload: Uint8Array
}
```

#### 编解码

```typescript
export function createMessage(msgType: MsgType, flag: MsgTypeFlagBits): Message
export function marshalMessage(msg: Message): Uint8Array
export function unmarshalMessage(data: Uint8Array): Message
export function messageToString(msg: Message): string
```

#### 帧构造(纯函数)

与当前 `src/protocols.ts` 的最大差异:把 `StartConnection(ws)` 等「既构造字节又发送」函数
拆成「只构造字节」的 `build*` 纯函数。`ws.send` 和 ws 接收逻辑下沉到 `server` 层。

```typescript
export function buildStartConnection(): Uint8Array
export function buildFinishConnection(): Uint8Array
export function buildStartSession(payload: Uint8Array, sessionId: string): Uint8Array
export function buildFinishSession(sessionId: string): Uint8Array
export function buildCancelSession(sessionId: string): Uint8Array
export function buildTaskRequest(payload: Uint8Array, sessionId: string): Uint8Array
export function buildFullClientRequest(payload: Uint8Array): Uint8Array
export function buildAudioOnlyClient(payload: Uint8Array, flag: MsgTypeFlagBits): Uint8Array
```

**为什么拆分:** 浏览器端如果只想本地组包测试,可以 import `build*` 而不拉进 `ws` / `uuid`
等 Node-only 依赖。`server` 层是「唯一」与 `ws` 耦合的地方。

### 3.2 `@openz/speech/server`

API 表面 100% 保持当前 `src/volcengine/bidirection.ts` 的语义(纯路径变化)。

```typescript
import { Readable } from 'node:stream'

export const DEFAULT_SAMPLE_RATE = 24000

export interface BidirectionTtsOptions {
  appkey: string                                  // 新版控制台 API Key
  resourceId: string                              // 资源 ID(seed-tts-1.0 / 2.0)
  voiceType: string                               // 音色 ID,必须与 resourceId 同代
  texts: AsyncIterable<string> | Iterable<string> // 流式文本片段
  encoding?: string                               // 默认 'mp3',流式场景建议 'pcm'
  sampleRate?: number                             // 默认 24000
  endpoint?: string                               // 默认 'wss://openspeech.bytedance.com/api/v3/tts/bidirection'
  outputFile?: string                             // 仅 bidirectionTts 落盘版本使用
}

export interface RunOptions extends BidirectionTtsOptions {
  onAudioFrame?: (frame: Buffer) => void | Promise<void>
  onChunk?: (index: number, text: string, at: number) => void
  onFirstFrame?: (at: number) => void
}

// 落盘版本:合成完一次性写到单个文件
export async function bidirectionTts(opts: BidirectionTtsOptions): Promise<string>

// 流式版本:每收到一帧就 push 到 Readable,边收边推
export function bidirectionTtsStream(opts: RunOptions): Readable
```

**实现要点:**
- 内部用 `build*` 纯函数构造字节
- 接收/发送通过 `ws` 库(`new WebSocket(...)`) + 自维护接收队列
- `_runBidirection` 私有函数保持当前 sender/receiver 并发模式

### 3.3 `@openz/speech/client`

#### PCMPlayer(从 public/index.html 抽出)

```typescript
export interface PCMPlayerOptions {
  inputCodec?: 'Int8' | 'Int16' | 'Int32' | 'Float32'  // 默认 'Int16'
  channels?: number     // 默认 1
  sampleRate: number    // 必填
  flushTime?: number    // ms,默认 200
  fftSize?: number      // 默认 2048
  volume?: number       // 默认 1
  onended?: (source: AudioBufferSourceNode, event: Event) => void
  onstatechange?: (source: AudioContext, event: Event, state: AudioContextState) => void
}

export class PCMPlayer {
  constructor(options: PCMPlayerOptions)
  feed(data: ArrayBuffer | Uint8Array): void
  volume(v: number): void
  pause(): Promise<void>
  continue(): Promise<void>
  destroy(): void
  readonly audioCtx: AudioContext  // 暴露给消费者(浏览器自动播放策略需 resume)
}
```

行为与当前 `index.html` 内联 `PCMPlayer` 类完全一致。

#### TtsClient(从 public/index.html 抽出)

```typescript
export interface SessionStartInfo { sampleRate: number; encoding: string; channels: number }
export interface ChunkInfo { index: number; text: string; at: number }
export interface EndInfo { totalFrames: number; totalBytes: number }

export interface TtsClientOptions {
  url: string           // 必填
  text: string          // 必填
  voiceType?: string
  resourceId?: string
  simulateStream?: boolean | number
  binaryType?: 'arraybuffer' | 'blob'  // 默认 'arraybuffer'
  onSessionStart?: (info: SessionStartInfo) => void
  onChunk?: (info: ChunkInfo) => void
  onFirstFrame?: (at: number) => void
  onAudioFrame?: (data: ArrayBuffer) => void
  onEnd?: (info: EndInfo) => void
  onError?: (message: string) => void
  onClose?: (event: CloseEvent) => void
}

export class TtsClient {
  constructor(options: TtsClientOptions)
  start(): void
  stop(): void
  readonly state: 'idle' | 'connecting' | 'open' | 'streaming' | 'closed'
}
```

**职责:** 内部建 `WebSocket`、发送 start 消息、按消息类型分发到对应回调。
消费者(浏览器应用)只需要在 `onAudioFrame` 里把 `ArrayBuffer` 喂给 `PCMPlayer`。

## 4. 数据流(端到端)

```
用户点击播放
  │
  ▼
TtsClient.start()                          [SDK client]
  │  ws.send(JSON {type:"start", text, voiceType, ...})
  │
  ▼ WebSocket
handleTtsSocket(ws)                        [example]
  │  解析 start 消息
  ▼
bidirectionTtsStream({                     [SDK server]
  appkey, resourceId, voiceType,
  texts: chunkedTextStream(text, opts),    [example 自有]
  onChunk, onFirstFrame
})
  │
  ▼ _runBidirection
buildStartConnection() / buildStartSession()   [SDK protocol]
buildTaskRequest() 每段顺序
buildFinishSession() / buildFinishConnection()
  │
  │ 火山引擎推 AudioOnlyServer 帧
  ▼
onAudioFrame(frame) → stream.push(frame)   [SDK server]
  │
  ▼ Readable
ws.send(frame, {binary:true})              [example]
  │
  ▼
TtsClient 收到 binary 帧 → onAudioFrame(arrayBuffer)  [SDK client]
  │
  ▼
PCMPlayer.feed(buf)                        [SDK client]
  │
  ▼ AudioContext
扬声器播放
```

## 5. 错误处理

### 5.1 错误传播路径

| 阶段 | 错误源 | SDK 处理 | example 处理 |
|------|--------|----------|--------------|
| 协议 | 字节不合法 | `unmarshalMessage` throw | 不应到达(由 SDK 内部捕获) |
| 火山引擎 | Error 帧 | server `default` 分支 throw | 推到 `Readable.destroy(err)` |
| 网络 | ws 断开 | server `error`/`close` 事件 | 同上 |
| 浏览器 | ws 异常 | client `onerror` 回调 | `setStatus(..., true)` + `log` |
| 浏览器 | 服务端 error 文本帧 | client 解析后调 `onError(msg)` | 同上 |

### 5.2 关键规则

- SDK 内部所有错误以 `Error` 实例抛出,不允许字符串或自定义类型
- `bidirectionTtsStream` 把 `Error` 通过 `stream.destroy(err)` 推给消费者
- `TtsClient` 把所有 ws 异常(包括服务端 `error` 事件帧)统一转成 `onError(string)` 回调
- 客户端中断:example 监听按钮事件,调 `stream.destroy()`(HTTP)或 `ws.close()`(WS)

## 6. 状态机

### TtsClient
```
       start()              onopen              收到 session_start
idle ──────────→ connecting ──────→ open ──────────────────────→ streaming
                  │                                                  │
                  │ ws error                                         │ 收到 end
                  ↓                                                  ↓
                closed ←──────── ws close / onEnd ──────────────────┘
```

### bidirectionTtsStream 的 Readable
- 正常:每帧 `push(frame)`,结束 `push(null)`
- 异常:`destroy(err)`,消费者通过 `stream.on('error', ...)` 拿到

## 7. 构建与部署

### 7.1 SDK 构建

**根 package.json scripts:**
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit"
  }
}
```

**根 tsconfig.json:**
- `target: ES2020`
- `module: ESNext`、`moduleResolution: Bundler`
- `outDir: ./dist`
- `declaration: true`、`declarationMap: true`、`sourceMap: true`

**根 package.json exports:**
```json
{
  "name": "@openz/speech",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./protocol": { "types": "./dist/protocol/index.d.ts",  "import": "./dist/protocol/index.js" },
    "./server":   { "types": "./dist/server/index.d.ts",    "import": "./dist/server/index.js" },
    "./client":   { "types": "./dist/client/index.d.ts",    "import": "./dist/client/index.js" }
  }
}
```

### 7.2 example 启动

```bash
# 第一次
cd <root> && npm install
npm run build                  # 输出 dist/

# example 通过 file: 引用 SDK
cd example && npm install
npm run dev                    # ts-node src/server.ts
```

**example/package.json:**
```json
{
  "name": "@openz/tts-demo-example",
  "type": "module",
  "scripts": {
    "dev": "dotenv_config_path=../.env ts-node --transpile-only -r dotenv/config src/server.ts"
  },
  "dependencies": {
    "@openz/speech": "file:..",
    "dotenv": "^17.2.0",
    "ws": "^8.18.3"
  }
}
```

> `dotenv_config_path=../.env` 是 `dotenv/config` 的内置机制:它读取 `process.env.dotenv_config_path` 并从该路径加载,无须改 `server.ts` 代码。

### 7.3 验证策略

不引入测试框架(当前项目无测试),以类型检查 + 端到端冒烟为主:
- `tsc --noEmit` 通过
- `npm run build` 通过
- example 启动后浏览器走完一遍 ws 流程(已在原始 demo 验证过)

## 8. 关键设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| 包结构 | 单一 npm 包 + 子路径 exports | 用户指定;避免 monorepo 工具链复杂度 |
| 协议层与收发分离 | `build*` 纯函数 + server 层负责 ws | 浏览器端可独立 import `build*`,不拉 `ws` 依赖 |
| HTTP `/api/tts` 保留 | 是 | 用户指定"全套保留";SDK 的 `bidirectionTtsStream` 自然兼容 |
| `chunkedTextStream` 归属 | example 而非 SDK | 只 example 用,模拟 LLM 行为是 example 关注的事 |
| 浏览器端打包形式 | ESM + `<script type="module">` | 用户指定;现代浏览器原生支持,体积小 |
| 引入测试框架 | 否 | 范围控制,验证靠 typecheck + 端到端 |
| 发布到 npm | 否 | 本地 `file:` 引用足够;SDK 接口稳定后再考虑 |

## 9. 实施步骤

1. **创建 `src/protocol/`** — 从 `src/protocols.ts` 拆出:
   - `messages.ts`(枚举 + `Message` 接口)
   - `codec.ts`(`createMessage` / `marshalMessage` / `unmarshalMessage`)
   - `frame.ts`(`build*` 纯函数)
   - `index.ts`(re-export 公共 API)
2. **创建 `src/server/`** — 移动 `src/volcengine/bidirection.ts` 至此目录:
   - 内部把 `StartConnection(ws)` 等调用替换为 `buildStartConnection()` + `ws.send`
   - 同样处理 `StartSession` / `FinishSession` / `CancelSession` / `TaskRequest` / `FinishConnection`
   - 把 `ReceiveMessage` / `WaitForEvent` 等 ws 收发逻辑移到 server 层(用 `ws` 库的 `WebSocket` 类型)
3. **创建 `src/client/`** — 从 `public/index.html` 抽出:
   - `PCMPlayer` 类 → `pcm-player.ts`(纯类,export)
   - ws 处理逻辑 → `tts-client.ts`(`TtsClient` 类,内部建 ws、解析消息)
4. **改造根 `package.json`** — 加 `exports`、`type: module`、`build` / `clean` 脚本
5. **改造根 `tsconfig.json`** — 输出到 `./dist`,生成 .d.ts
6. **构建 SDK** — `npm run build` 验证
7. **创建 `example/`** —
   - 复制 `src/server.ts` → `example/src/server.ts`,改 import 路径
   - 把 `chunkedTextStream` 移到 `example/src/chunked-text.ts`
   - 移动 `public/index.html` → `example/public/index.html`,改用 `<script type="module">` 引用 SDK
8. **删除旧文件** — `src/protocols.ts`、`src/volcengine/`、`public/index.html`
9. **更新 example 启动脚本** — `example/package.json` 的 dev 脚本加 `dotenv_config_path=../.env`,由 `dotenv/config` 加载根级 `.env`(`dotenv_config_path` 是 `dotenv/config` 的内置环境变量,不需要改 server.ts 代码)
10. **端到端冒烟** — 启动 example,浏览器走完 ws 流程

## 10. 风险与缓解

| 风险 | 缓解 |
|------|------|
| `buffer` 包在浏览器端不可用,protocol 层可能崩 | protocol 层内部不 import `buffer`,统一用 `TextEncoder.encode` / `Uint8Array` 操作;协议层不会被 client 层 import,因此不进入浏览器 bundle |
| 浏览器端 ESM 引入需要 `index.html` 改 `<script type="module">` | 接受这个改动;example 本来就是 demo,可以改 |
| `ts-node` + ESM (`type: "module"`) 可能踩坑 | 根级 SDK 用 `tsc` 构建(不依赖 ts-node);example 用 `ts-node --transpile-only`(不走 ESM 解析,只 transpile);若仍有冲突,改用 `tsx` 替代(同样支持 `--env-file`) |
| `exports` 字段在 Node < 12 不支持 | 项目 node 版本满足,无影响 |
| example 的 `.env` 路径 | example 启动时 `cwd` 是 `example/`,dotenv 默认从 cwd 加载;**采用方案**:在 `example/package.json` 的 dev 脚本加 `dotenv_config_path=../.env` 环境变量,由 `dotenv/config` 显式加载根级 `.env`。**禁止**把 `.env` 复制到 `example/`(会泄露部署) |

## 11. 验收标准

- [ ] `npm run build` 在 SDK 根目录通过,`dist/` 产物包含 protocol / server / client 三个子目录的 .js + .d.ts
- [ ] `npm run typecheck` 在 SDK 根目录通过
- [ ] `npm run dev` 在 `example/` 启动后,浏览器访问 `http://localhost:3000` 走完一遍 ws 流式 TTS
- [ ] 浏览器 Console 无报错,`#log` 区域显示完整事件流(connect / chunk / first_frame / end)
- [ ] 切段输入(多段标点)能听到「边生成边播放」,首帧延迟与重构前一致
- [ ] `chunkedTextStream` 的「模拟 LLM」开关有效
- [ ] 代码行数对比:example/public/index.html 由 433 行降到 ~200 行(删掉 PCMPlayer + ws 处理)
