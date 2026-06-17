# 火山引擎 TTS SDK 重构实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把音频处理/解析封装成 `@openz/speech` 单 npm 包(含 protocol / server / client 三层),当前 demo 改造为 `example/` 子目录的 example 服务

**Architecture:** 单包 + `exports` 子路径暴露,protocol 层零依赖 + 纯函数(`build*` / `marshal` / `unmarshal`),server 层封装 Node 端 TTS 业务,client 层封装浏览器 PCM 播放器 + WS 客户端;example 通过 `file:..` 引用 SDK

**Tech Stack:** TypeScript 5.8、`tsc` 直接构建(无 bundler)、`ts-node`(example 运行)、`ws` + `uuid`(Node 端)

**前置文档:** `docs/superpowers/specs/2026-06-16-volc-tts-sdk-refactor-design.md`

---

## 文件结构总览

**新建文件:**
- `src/protocol/{index,messages,codec,frame}.ts` — SDK 协议层
- `src/server/{index,bidirection,types}.ts` — SDK 服务端层
- `src/client/{index,types,pcm-player,tts-client}.ts` — SDK 客户端层
- `example/package.json`、`example/tsconfig.json` — example 服务配置
- `example/src/{server,chunked-text}.ts` — example 业务代码
- `example/public/index.html` — example 前端页面
- `docs/superpowers/plans/2026-06-16-volc-tts-sdk-refactor.md` — 本文件

**修改文件:**
- `package.json` — 改造为 SDK 的 package.json
- `tsconfig.json` — 输出 `dist/`,生成 `.d.ts`

**删除文件:**
- `src/protocols.ts`
- `src/volcengine/bidirection.ts`
- `src/server.ts`
- `public/index.html`

---

## Task 1: 实现 SDK 协议层

**Files:**
- Create: `src/protocol/messages.ts`
- Create: `src/protocol/codec.ts`
- Create: `src/protocol/frame.ts`
- Create: `src/protocol/index.ts`

### Step 1.1: 创建 `src/protocol/messages.ts`

从 `src/protocols.ts` 1-176 行复制枚举和 `Message` 接口,以及辅助函数 `getEventTypeName`、`getMsgTypeName`、`messageToString`、`createMessage`。

```typescript
/**
 * 协议层消息类型定义。
 * 与 Node 端 / 浏览器端运行时无关,纯枚举与数据结构。
 */
export enum EventType {
  None = 0,
  StartConnection = 1,
  FinishConnection = 2,
  ConnectionStarted = 50,
  ConnectionFailed = 51,
  ConnectionFinished = 52,
  StartSession = 100,
  CancelSession = 101,
  FinishSession = 102,
  SessionStarted = 150,
  SessionCanceled = 151,
  SessionFinished = 152,
  SessionFailed = 153,
  UsageResponse = 154,
  TaskRequest = 200,
  UpdateConfig = 201,
  AudioMuted = 250,
  SayHello = 300,
  TTSSentenceStart = 350,
  TTSSentenceEnd = 351,
  TTSResponse = 352,
  TTSEnded = 359,
  PodcastRoundStart = 360,
  PodcastRoundResponse = 361,
  PodcastRoundEnd = 362,
  ASRInfo = 450,
  ASRResponse = 451,
  ASREnded = 459,
  ChatTTSText = 500,
  ChatResponse = 550,
  ChatEnded = 559,
  SourceSubtitleStart = 650,
  SourceSubtitleResponse = 651,
  SourceSubtitleEnd = 652,
  TranslationSubtitleStart = 653,
  TranslationSubtitleResponse = 654,
  TranslationSubtitleEnd = 655,
}

export enum MsgType {
  Invalid = 0,
  FullClientRequest = 0b1,
  AudioOnlyClient = 0b10,
  FullServerResponse = 0b1001,
  AudioOnlyServer = 0b1011,
  FrontEndResultServer = 0b1100,
  Error = 0b1111,
}

export const MsgTypeServerACK = MsgType.AudioOnlyServer

export enum MsgTypeFlagBits {
  NoSeq = 0,
  PositiveSeq = 0b1,
  LastNoSeq = 0b10,
  NegativeSeq = 0b11,
  WithEvent = 0b100,
}

export enum VersionBits {
  Version1 = 1,
  Version2 = 2,
  Version3 = 3,
  Version4 = 4,
}

export enum HeaderSizeBits {
  HeaderSize4 = 1,
  HeaderSize8 = 2,
  HeaderSize12 = 3,
  HeaderSize16 = 4,
}

export enum SerializationBits {
  Raw = 0,
  JSON = 0b1,
  Thrift = 0b11,
  Custom = 0b1111,
}

export enum CompressionBits {
  None = 0,
  Gzip = 0b1,
  Custom = 0b1111,
}

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

export function getEventTypeName(eventType: EventType): string {
  return EventType[eventType] || `invalid event type: ${eventType}`
}

export function getMsgTypeName(msgType: MsgType): string {
  return MsgType[msgType] || `invalid message type: ${msgType}`
}

export function messageToString(msg: Message): string {
  const eventStr =
    msg.event !== undefined ? getEventTypeName(msg.event) : 'NoEvent'
  const typeStr = getMsgTypeName(msg.type)

  switch (msg.type) {
    case MsgType.AudioOnlyServer:
    case MsgType.AudioOnlyClient:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, PayloadSize: ${msg.payload.length}`
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, PayloadSize: ${msg.payload.length}`

    case MsgType.Error:
      return `MsgType: ${typeStr}, EventType: ${eventStr}, ErrorCode: ${msg.errorCode}, Payload: ${new TextDecoder().decode(msg.payload)}`

    default:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        return `MsgType: ${typeStr}, EventType: ${eventStr}, Sequence: ${msg.sequence}, Payload: ${new TextDecoder().decode(msg.payload)}`
      }
      return `MsgType: ${typeStr}, EventType: ${eventStr}, Payload: ${new TextDecoder().decode(msg.payload)}`
  }
}

export function createMessage(
  msgType: MsgType,
  flag: MsgTypeFlagBits,
): Message {
  const msg = {
    type: msgType,
    flag,
    version: VersionBits.Version1,
    headerSize: HeaderSizeBits.HeaderSize4,
    serialization: SerializationBits.JSON,
    compression: CompressionBits.None,
    payload: new Uint8Array(0),
  }

  Object.defineProperty(msg, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this)
    },
  })

  return msg as Message
}
```

### Step 1.2: 创建 `src/protocol/codec.ts`

从 `src/protocols.ts` 209-527 行复制 `marshalMessage` 和 `unmarshalMessage` 以及内部 writer/reader 函数。

```typescript
import {
  type Message,
  MsgType,
  MsgTypeFlagBits,
  createMessage,
  messageToString,
  EventType,
} from './messages'

/**
 * 协议层编解码。
 * 纯函数:输入 Message 输出字节数组,或反向。
 * 不依赖 Node 端 Buffer,内部使用 TextEncoder/TextDecoder + Uint8Array。
 */
export function marshalMessage(msg: Message): Uint8Array {
  const buffers: Uint8Array[] = []

  const headerSize = 4 * msg.headerSize
  const header = new Uint8Array(headerSize)

  header[0] = (msg.version << 4) | msg.headerSize
  header[1] = (msg.type << 4) | msg.flag
  header[2] = (msg.serialization << 4) | msg.compression

  buffers.push(header)

  const writers = getWriters(msg)
  for (const writer of writers) {
    const data = writer(msg)
    if (data) buffers.push(data)
  }

  const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  for (const buf of buffers) {
    result.set(buf, offset)
    offset += buf.length
  }

  return result
}

export function unmarshalMessage(data: Uint8Array): Message {
  if (data.length < 3) {
    throw new Error(
      `data too short: expected at least 3 bytes, got ${data.length}`,
    )
  }

  let offset = 0

  const versionAndHeaderSize = data[offset++]
  const typeAndFlag = data[offset++]
  const serializationAndCompression = data[offset++]

  const msg = {
    version: ((versionAndHeaderSize >> 4) & 0b1111) as Message['version'],
    headerSize: (versionAndHeaderSize & 0b00001111) as Message['headerSize'],
    type: ((typeAndFlag >> 4) & 0b1111) as Message['type'],
    flag: (typeAndFlag & 0b00001111) as Message['flag'],
    serialization: ((serializationAndCompression >> 4) & 0b1111) as Message['serialization'],
    compression: (serializationAndCompression & 0b00001111) as Message['compression'],
    payload: new Uint8Array(0),
  }

  Object.defineProperty(msg, 'toString', {
    enumerable: false,
    configurable: true,
    writable: true,
    value: function () {
      return messageToString(this)
    },
  })

  offset = 4 * msg.headerSize

  const readers = getReaders(msg as Message)
  for (const reader of readers) {
    offset = reader(msg as Message, data, offset)
  }

  return msg as Message
}

function getWriters(
  msg: Message,
): Array<(msg: Message) => Uint8Array | null> {
  const writers: Array<(msg: Message) => Uint8Array | null> = []

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    writers.push(writeEvent, writeSessionId)
  }

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        writers.push(writeSequence)
      }
      break
    case MsgType.Error:
      writers.push(writeErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  writers.push(writePayload)
  return writers
}

function getReaders(
  msg: Message,
): Array<(msg: Message, data: Uint8Array, offset: number) => number> {
  const readers: Array<
    (msg: Message, data: Uint8Array, offset: number) => number
  > = []

  switch (msg.type) {
    case MsgType.AudioOnlyClient:
    case MsgType.AudioOnlyServer:
    case MsgType.FrontEndResultServer:
    case MsgType.FullClientRequest:
    case MsgType.FullServerResponse:
      if (
        msg.flag === MsgTypeFlagBits.PositiveSeq ||
        msg.flag === MsgTypeFlagBits.NegativeSeq
      ) {
        readers.push(readSequence)
      }
      break
    case MsgType.Error:
      readers.push(readErrorCode)
      break
    default:
      throw new Error(`unsupported message type: ${msg.type}`)
  }

  if (msg.flag === MsgTypeFlagBits.WithEvent) {
    readers.push(readEvent, readSessionId, readConnectId)
  }

  readers.push(readPayload)
  return readers
}

function writeEvent(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.event, false)
  return new Uint8Array(buffer)
}

function writeSessionId(msg: Message): Uint8Array | null {
  if (msg.event === undefined) return null

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
      return null
  }

  const sessionId = msg.sessionId || ''
  const sessionIdBytes = new TextEncoder().encode(sessionId)
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, sessionIdBytes.length, false)

  const result = new Uint8Array(4 + sessionIdBytes.length)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(sessionIdBytes, 4)

  return result
}

function writeSequence(msg: Message): Uint8Array | null {
  if (msg.sequence === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setInt32(0, msg.sequence, false)
  return new Uint8Array(buffer)
}

function writeErrorCode(msg: Message): Uint8Array | null {
  if (msg.errorCode === undefined) return null
  const buffer = new ArrayBuffer(4)
  const view = new DataView(buffer)
  view.setUint32(0, msg.errorCode, false)
  return new Uint8Array(buffer)
}

function writePayload(msg: Message): Uint8Array | null {
  const payloadSize = msg.payload.length
  const sizeBuffer = new ArrayBuffer(4)
  const sizeView = new DataView(sizeBuffer)
  sizeView.setUint32(0, payloadSize, false)

  const result = new Uint8Array(4 + payloadSize)
  result.set(new Uint8Array(sizeBuffer), 0)
  result.set(msg.payload, 4)

  return result
}

function readEvent(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for event')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.event = view.getInt32(0, false)
  return offset + 4
}

function readSessionId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.StartConnection:
    case EventType.FinishConnection:
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for session ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for session ID')
    }
    msg.sessionId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readConnectId(msg: Message, data: Uint8Array, offset: number): number {
  if (msg.event === undefined) return offset

  switch (msg.event) {
    case EventType.ConnectionStarted:
    case EventType.ConnectionFailed:
    case EventType.ConnectionFinished:
      break
    default:
      return offset
  }

  if (offset + 4 > data.length) {
    throw new Error('insufficient data for connect ID size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for connect ID')
    }
    msg.connectId = new TextDecoder().decode(data.slice(offset, offset + size))
    offset += size
  }

  return offset
}

function readSequence(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for sequence')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.sequence = view.getInt32(0, false)
  return offset + 4
}

function readErrorCode(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for error code')
  }
  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  msg.errorCode = view.getUint32(0, false)
  return offset + 4
}

function readPayload(msg: Message, data: Uint8Array, offset: number): number {
  if (offset + 4 > data.length) {
    throw new Error('insufficient data for payload size')
  }

  const view = new DataView(data.buffer, data.byteOffset + offset, 4)
  const size = view.getUint32(0, false)
  offset += 4

  if (size > 0) {
    if (offset + size > data.length) {
      throw new Error('insufficient data for payload')
    }
    msg.payload = data.slice(offset, offset + size)
    offset += size
  }

  return offset
}
```

### Step 1.3: 创建 `src/protocol/frame.ts`

帧构造纯函数。从原 `src/protocols.ts` 620-771 行的 `StartConnection` / `FinishConnection` / `StartSession` / `FinishSession` / `CancelSession` / `TaskRequest` / `FullClientRequest` / `AudioOnlyClient` 函数改造:去除 `ws.send` 调用,只返回字节。

```typescript
import { EventType, MsgType, MsgTypeFlagBits, createMessage, type Message } from './messages'
import { marshalMessage } from './codec'

/**
 * 帧构造:纯函数,输入字段 → 输出字节,不发送。
 * 用于 server 层把构造好的字节交给 ws 发送。
 * 也可在测试或浏览器端本地组包验证时直接使用。
 */
function serializeAndReturn(msg: Message): Uint8Array {
  return marshalMessage(msg)
}

export function buildStartConnection(): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartConnection
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildFinishConnection(): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishConnection
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildStartSession(
  payload: Uint8Array,
  sessionId: string,
): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.StartSession
  msg.sessionId = sessionId
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildFinishSession(sessionId: string): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.FinishSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildCancelSession(sessionId: string): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.CancelSession
  msg.sessionId = sessionId
  msg.payload = new TextEncoder().encode('{}')
  return serializeAndReturn(msg)
}

export function buildTaskRequest(
  payload: Uint8Array,
  sessionId: string,
): Uint8Array {
  const msg = createMessage(
    MsgType.FullClientRequest,
    MsgTypeFlagBits.WithEvent,
  )
  msg.event = EventType.TaskRequest
  msg.sessionId = sessionId
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildFullClientRequest(payload: Uint8Array): Uint8Array {
  const msg = createMessage(MsgType.FullClientRequest, MsgTypeFlagBits.NoSeq)
  msg.payload = payload
  return serializeAndReturn(msg)
}

export function buildAudioOnlyClient(
  payload: Uint8Array,
  flag: MsgTypeFlagBits,
): Uint8Array {
  const msg = createMessage(MsgType.AudioOnlyClient, flag)
  msg.payload = payload
  return serializeAndReturn(msg)
}
```

### Step 1.4: 创建 `src/protocol/index.ts`

```typescript
/**
 * 火山引擎 v3 双向通信协议层。
 *
 * 纯函数模块,不依赖 Node 端运行时;浏览器和 Node 都可使用。
 * 不发送 WebSocket 帧,只构造和解析字节;ws 收发由 server 层负责。
 */

// 消息类型与枚举
export {
  EventType,
  MsgType,
  MsgTypeServerACK,
  MsgTypeFlagBits,
  VersionBits,
  HeaderSizeBits,
  SerializationBits,
  CompressionBits,
  type Message,
  getEventTypeName,
  getMsgTypeName,
  messageToString,
  createMessage,
} from './messages'

// 编解码
export { marshalMessage, unmarshalMessage } from './codec'

// 帧构造
export {
  buildStartConnection,
  buildFinishConnection,
  buildStartSession,
  buildFinishSession,
  buildCancelSession,
  buildTaskRequest,
  buildFullClientRequest,
  buildAudioOnlyClient,
} from './frame'
```

### Step 1.5: 类型检查

```bash
npx tsc --noEmit src/protocol/messages.ts src/protocol/codec.ts src/protocol/frame.ts src/protocol/index.ts --target ES2020 --module ESNext --moduleResolution Bundler --strict
```

预期:无错误(注:此命令临时用于协议层独立检查,完整构建在 Task 5)

### Step 1.6: 提交(可选,如已初始化 git)

```bash
git add src/protocol/
git commit -m "feat(sdk): add protocol layer with pure-function build*/marshal/unmarshal"
```

---

## Task 2: 实现 SDK 服务端层

**Files:**
- Create: `src/server/types.ts`
- Create: `src/server/bidirection.ts`
- Create: `src/server/index.ts`

### Step 2.1: 创建 `src/server/types.ts`

从原 `src/volcengine/bidirection.ts` 36-80 行复制 `BidirectionTtsOptions` 和 `RunOptions`,去掉路径引用,只保留类型。

```typescript
/**
 * 火山引擎大模型语音合成 双向流式 TTS 调用参数。
 *
 * 鉴权:使用「新版控制台」时仅需传入 appkey(API Key),握手时通过
 *      `X-Api-Key` 头发送。旧版控制台需要同时传 appid + access_key
 *      两个头,本模块不直接支持旧版控制台。
 *
 * 资源:resourceId 与 voiceType 必须匹配(同一代模型)。
 *      * 声音为 TTS 1.0 音色(如 `xxx_tob` 之前的老音色)时,
 *        配 `seed-tts-1.0` 或 `seed-tts-1.0-concurr`。
 *      * 声音为 TTS 2.0 音色(豆包语音合成模型 2.0 列表)时,
 *        配 `seed-tts-2.0`。
 */
export interface BidirectionTtsOptions {
  /** 新版控制台的 API Key */
  appkey: string
  /** 资源 ID,决定模型版本与计费方式 */
  resourceId: string
  /** 音色 ID,必须与 resourceId 同一代模型 */
  voiceType: string
  /**
   * 流式输入的文本片段:模拟「语音通话」场景,调用方按自己的节奏
   * 逐段喂入文本(可以是整句、几个字、或大模型流式吐出的 token 块),
   * 片段之间可以存在任意延迟。
   *
   * 用 `AsyncIterable<string>` 而非 `string[]` 是关键:函数会
   * `for await` 拉取每个片段,前一个 TaskRequest 发完之后才拉取
   * 下一段,因此 LLM 边生成边喂入的延迟会被自然吞掉,不会出现
   * 「攒齐再发」的等待。
   *
   * 所有片段最终合成到 **一个** 音频文件中(不是按 turn 切片)。
   */
  texts: AsyncIterable<string> | Iterable<string>
  /** 音频编码格式,默认 mp3。流式场景建议 pcm */
  encoding?: string
  /** 采样率(Hz),默认 24000。仅 pcm 时真正生效 */
  sampleRate?: number
  /** WebSocket 端点,默认官方 bidirection 地址 */
  endpoint?: string
  /**
   * 输出文件路径(含扩展名)。仅 `bidirectionTts`(落盘版本)使用。
   * 留空则默认 `<voiceType>.<encoding>`,写到当前工作目录。
   */
  outputFile?: string
}

export interface RunOptions extends BidirectionTtsOptions {
  /** 收到每一帧音频时立刻回调。用于实时转发。 */
  onAudioFrame?: (frame: Buffer) => void | Promise<void>
  /**
   * sender 协程每 yield 一段文本就回调。`at` 是相对会话开始的毫秒数。
   * 传 `simulateStream` 时这个回调尤其有用——能看到 sender 是不是
   * 真的在「边生成边喂」。
   */
  onChunk?: (index: number, text: string, at: number) => void
  /** receiver 协程收到第一个 AudioOnlyServer 帧时回调一次。`at` 同上。 */
  onFirstFrame?: (at: number) => void
}
```

### Step 2.2: 创建 `src/server/bidirection.ts`

从原 `src/volcengine/bidirection.ts` 迁移 `_runBidirection` / `bidirectionTts` / `bidirectionTtsStream`,主要改动:
1. 路径从 `'../protocols'` 改为 `'../protocol'`
2. `StartConnection(ws)` / `StartSession(ws, ...)` 等替换为 `ws.send(buildStartConnection())` 等
3. `ReceiveMessage` / `WaitForEvent` 直接搬过来(它们依赖 `ws` 类型,放在 server 层)
4. 删掉 `DEFAULT_ENDPOINT` 的对外导出(只 server 内部用)

```typescript
import * as fs from 'node:fs'
import { Readable } from 'node:stream'
import WebSocket from 'ws'
import * as uuid from 'uuid'
import {
  MsgType,
  EventType,
  marshalMessage,
  unmarshalMessage,
  buildStartConnection,
  buildFinishConnection,
  buildStartSession,
  buildFinishSession,
  buildTaskRequest,
  type Message,
} from '../protocol'
import type { BidirectionTtsOptions, RunOptions } from './types'

const DEFAULT_ENDPOINT =
  'wss://openspeech.bytedance.com/api/v3/tts/bidirection'

/** 默认 PCM 采样率(Hz),流式 PCM 播放时用。 */
export const DEFAULT_SAMPLE_RATE = 24000

/**
 * 内部:完成一次完整的 bidirection 合成流程。
 *
 * 流程:建连 → StartConnection → StartSession → 流式喂入 TaskRequest
 *       → FinishSession → 边收音频帧边回调 `onAudioFrame` → 收齐
 *       SessionFinished → FinishConnection。
 */
async function _runBidirection(
  opts: RunOptions,
): Promise<{ audioFrames: number; totalBytes: number }> {
  const encoding = opts.encoding ?? 'mp3'
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT
  const sampleRate = opts.sampleRate ?? 24000

  const headers = {
    'X-Api-Key': opts.appkey,
    'X-Api-Resource-Id': opts.resourceId,
    'X-Api-Connect-Id': uuid.v4(),
  }

  const ws = new WebSocket(endpoint, {
    headers,
    skipUTF8Validation: true,
  })

  await new Promise<void>((resolve, reject) => {
    ws.on('open', resolve)
    ws.on('error', reject)
  })

  // StartConnection
  ws.send(buildStartConnection())
  await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionStarted)

  const sessionId = uuid.v4()
  const userId = uuid.v4()
  const audioParams = {
    format: encoding,
    sample_rate: sampleRate,
    enable_timestamp: true,
  }
  const additions = JSON.stringify({
    disable_markdown_filter: false,
  })

  // StartSession
  ws.send(
    buildStartSession(
      new TextEncoder().encode(
        JSON.stringify({
          user: { uid: userId },
          req_params: {
            speaker: opts.voiceType,
            audio_params: audioParams,
            additions,
          },
          event: EventType.StartSession,
        }),
      ),
      sessionId,
    ),
  )
  await waitForEvent(ws, MsgType.FullServerResponse, EventType.SessionStarted)

  // 并发收发
  const startedAt = Date.now()
  let audioFrames = 0
  let totalBytes = 0
  let hasAnyChunk = false
  let firstFrameLogged = false

  const sender = (async () => {
    let chunkIndex = 0
    for await (const chunk of opts.texts) {
      hasAnyChunk = true
      chunkIndex += 1
      const at = Date.now() - startedAt
      if (opts.onChunk) {
        opts.onChunk(chunkIndex, chunk, at)
      } else {
        const now = new Date().toISOString().slice(11, 23)
        console.log(
          `\n[stream @${now}] chunk ${chunkIndex}: ${chunk.slice(0, 40)}${chunk.length > 40 ? '...' : ''}`,
        )
      }
      ws.send(
        buildTaskRequest(
          new TextEncoder().encode(
            JSON.stringify({
              user: { uid: userId },
              req_params: {
                speaker: opts.voiceType,
                audio_params: audioParams,
                additions,
                text: chunk,
              },
              event: EventType.TaskRequest,
            }),
          ),
          sessionId,
        ),
      )
    }
    if (!hasAnyChunk) {
      throw new Error('texts 为空,至少要 yield 一段文本')
    }
    ws.send(buildFinishSession(sessionId))
  })()

  const receiver = (async () => {
    while (true) {
      const msg = await receiveMessage(ws)
      switch (msg.type) {
        case MsgType.FullServerResponse:
          // 进度/ack 帧,忽略即可
          break
        case MsgType.AudioOnlyServer:
          audioFrames += 1
          totalBytes += msg.payload.length
          if (opts.onAudioFrame) {
            await opts.onAudioFrame(Buffer.from(msg.payload))
          }
          if (!firstFrameLogged) {
            firstFrameLogged = true
            const elapsed = Date.now() - startedAt
            if (opts.onFirstFrame) {
              opts.onFirstFrame(elapsed)
            } else {
              const now = new Date().toISOString().slice(11, 23)
              console.log(`\n[first-frame @${now}] +${elapsed}ms`)
            }
          }
          break
        default:
          throw new Error(`${msg.toString()}`)
      }
      if (msg.event === EventType.SessionFinished) {
        break
      }
    }
  })()

  await Promise.all([sender, receiver])

  // FinishConnection
  ws.send(buildFinishConnection())
  await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionFinished)

  ws.close()
  return { audioFrames, totalBytes }
}

// === ws 收发辅助(原 protocols.ts 内的 ReceiveMessage/WaitForEvent 改造) ===
// 因为要复用 ws 库的 WebSocket 类型,放在 server 层而非 protocol 层

const messageQueues = new Map<WebSocket, Message[]>()
const messageCallbacks = new Map<WebSocket, ((msg: Message) => void)[]>()

function setupMessageHandler(ws: WebSocket) {
  if (!messageQueues.has(ws)) {
    messageQueues.set(ws, [])
    messageCallbacks.set(ws, [])

    ws.on('message', (data: WebSocket.RawData) => {
      try {
        let uint8Data: Uint8Array
        if (Buffer.isBuffer(data)) {
          uint8Data = new Uint8Array(data)
        } else if (data instanceof ArrayBuffer) {
          uint8Data = new Uint8Array(data)
        } else if (data instanceof Uint8Array) {
          uint8Data = data
        } else {
          throw new Error(`Unexpected WebSocket message type: ${typeof data}`)
        }

        const msg = unmarshalMessage(uint8Data)
        const queue = messageQueues.get(ws)!
        const callbacks = messageCallbacks.get(ws)!

        if (callbacks.length > 0) {
          const callback = callbacks.shift()!
          callback(msg)
        } else {
          queue.push(msg)
        }
      } catch (error) {
        throw new Error(`Error processing message: ${error}`)
      }
    })

    ws.on('close', () => {
      messageQueues.delete(ws)
      messageCallbacks.delete(ws)
    })
  }
}

function receiveMessage(ws: WebSocket): Promise<Message> {
  setupMessageHandler(ws)

  return new Promise((resolve, reject) => {
    const queue = messageQueues.get(ws)!
    const callbacks = messageCallbacks.get(ws)!

    if (queue.length > 0) {
      resolve(queue.shift()!)
      return
    }

    const errorHandler = (error: WebSocket.ErrorEvent) => {
      const index = callbacks.findIndex((cb) => cb === resolver)
      if (index !== -1) {
        callbacks.splice(index, 1)
      }
      reject(error)
    }

    const resolver = (msg: Message) => {
      ws.removeListener('error', errorHandler)
      resolve(msg)
    }

    callbacks.push(resolver)
    ws.once('error', errorHandler)
  })
}

async function waitForEvent(
  ws: WebSocket,
  msgType: MsgType,
  eventType: EventType,
): Promise<Message> {
  const msg = await receiveMessage(ws)
  if (msg.type !== msgType || msg.event !== eventType) {
    throw new Error(
      `Unexpected message: type=${msg.type}, event=${msg.event || 0}`,
    )
  }
  return msg
}

/**
 * 调用一次双向流式 TTS 合成,把结果写到单个文件。
 */
export async function bidirectionTts(
  opts: BidirectionTtsOptions,
): Promise<string> {
  const encoding = opts.encoding ?? 'mp3'
  const outputFile = opts.outputFile ?? `${opts.voiceType}.${encoding}`

  const frames: Buffer[] = []
  const { audioFrames, totalBytes } = await _runBidirection({
    ...opts,
    onAudioFrame: (frame) => {
      frames.push(frame)
    },
  })

  if (frames.length === 0) {
    throw new Error('no audio received')
  }

  const merged = Buffer.concat(frames)
  await fs.promises.writeFile(outputFile, merged)
  console.log(
    `\naudio saved to ${outputFile} (${audioFrames} frames, ${totalBytes} bytes)`,
  )
  return outputFile
}

/**
 * 调用一次双向流式 TTS 合成,把音频以「边收边推」的方式通过
 * Node `Readable` 流式返回。
 */
export function bidirectionTtsStream(
  opts: RunOptions,
): Readable {
  const encoding = opts.encoding ?? 'pcm'
  const sampleRate = opts.sampleRate ?? 24000

  const stream = new Readable({
    read() {
      /* 推模式:read() 由 _runBidirection 主动 push */
    },
  })

  _runBidirection({
    ...opts,
    encoding,
    sampleRate,
    onAudioFrame: async (frame) => {
      stream.push(frame)
    },
  })
    .then(() => {
      stream.push(null)
    })
    .catch((err) => {
      stream.destroy(err instanceof Error ? err : new Error(String(err)))
    })

  return stream
}
```

### Step 2.3: 创建 `src/server/index.ts`

```typescript
/**
 * Node 端火山引擎 TTS 业务封装。
 *
 * 依赖 `ws` 和 `uuid`,仅可在 Node 环境使用。
 * 浏览器端请用 `@openz/speech/client`。
 */
export {
  bidirectionTts,
  bidirectionTtsStream,
  DEFAULT_SAMPLE_RATE,
} from './bidirection'
export type { BidirectionTtsOptions, RunOptions } from './types'
```

### Step 2.4: 提交(可选)

```bash
git add src/server/
git commit -m "feat(sdk): add server layer with bidirectionTts/bidirectionTtsStream"
```

---

## Task 3: 实现 SDK 客户端层(PCMPlayer)

**Files:**
- Create: `src/client/types.ts`
- Create: `src/client/pcm-player.ts`
- Create: `src/client/index.ts`(临时只导出 PCMPlayer)

### Step 3.1: 创建 `src/client/types.ts`

```typescript
/**
 * 浏览器端 PCM 实时播放器选项。
 */
export interface PCMPlayerOptions {
  /** 输入编码,默认 'Int16' */
  inputCodec?: 'Int8' | 'Int16' | 'Int32' | 'Float32'
  /** 通道数,默认 1(单声道) */
  channels?: number
  /** 采样率(Hz),必填(常用 24000) */
  sampleRate: number
  /** flush 间隔(ms),默认 200 */
  flushTime?: number
  /** FFT 大小,默认 2048(供 onstatechange/可视化用) */
  fftSize?: number
  /** 初始音量,默认 1 */
  volume?: number
  /** AudioBufferSourceNode 播放结束回调 */
  onended?: (source: AudioBufferSourceNode, event: Event) => void
  /** AudioContext 状态变化回调 */
  onstatechange?: (
    source: AudioContext,
    event: Event,
    state: AudioContextState,
  ) => void
}

/**
 * TTS 客户端(WS 客户端)选项。
 */
export interface SessionStartInfo {
  sampleRate: number
  encoding: string
  channels: number
}

export interface ChunkInfo {
  index: number
  text: string
  at: number
}

export interface EndInfo {
  totalFrames: number
  totalBytes: number
}

export interface TtsClientOptions {
  /** WS URL,如 '/api/tts/ws' 或 'ws://host:port/path' */
  url: string
  /** 要合成的文本 */
  text: string
  /** 音色 ID */
  voiceType?: string
  /** 资源 ID */
  resourceId?: string
  /** 模拟 LLM 逐步生成:true=250~750ms 随机,number=固定毫秒 */
  simulateStream?: boolean | number
  /** WS 二进制帧类型,默认 'arraybuffer' */
  binaryType?: 'arraybuffer' | 'blob'
  /** session_start 事件 */
  onSessionStart?: (info: SessionStartInfo) => void
  /** chunk 事件(每段文本) */
  onChunk?: (info: ChunkInfo) => void
  /** first_frame 事件(首个音频帧) */
  onFirstFrame?: (at: number) => void
  /** 音频帧(原始 PCM 字节) */
  onAudioFrame?: (data: ArrayBuffer) => void
  /** end 事件 */
  onEnd?: (info: EndInfo) => void
  /** error 事件(服务端 error 帧或 ws 异常) */
  onError?: (message: string) => void
  /** ws close 事件 */
  onClose?: (event: CloseEvent) => void
}

export type TtsClientState =
  | 'idle'
  | 'connecting'
  | 'open'
  | 'streaming'
  | 'closed'
```

### Step 3.2: 创建 `src/client/pcm-player.ts`

从原 `public/index.html` 102-279 行抽出来,class 改成 `export class`,增加类型注解。

```typescript
import type { PCMPlayerOptions } from './types'

/**
 * 浏览器端 PCM 实时播放器。
 *
 * 把 Int16/Int8/Int32/Float32 的 PCM 字节流喂入 `feed()`,内部按
 * `flushTime` 间隔把累积的样本写入 `AudioBuffer` 并通过
 * `AudioBufferSourceNode` 顺序播放,实现「边收边播」。
 */
export class PCMPlayer {
  private option: Required<Omit<PCMPlayerOptions, 'onended' | 'onstatechange'>> & {
    onended?: PCMPlayerOptions['onended']
    onstatechange?: PCMPlayerOptions['onstatechange']
  }
  private samples: Float32Array = new Float32Array()
  private interval: ReturnType<typeof setInterval> | null = null
  private convertValue = 0
  private typedArray: typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Float32Array = Int16Array
  audioCtx: AudioContext
  private gainNode: GainNode
  private analyserNode: AnalyserNode
  private startTime: number | null = null

  constructor(option: PCMPlayerOptions) {
    this.init(option)
  }

  private init(option: PCMPlayerOptions) {
    const defaultOption = {
      inputCodec: 'Int16' as const,
      channels: 1,
      flushTime: 200,
      fftSize: 2048,
      volume: 1,
    }
    this.option = {
      ...defaultOption,
      ...option,
    } as typeof this.option

    this.interval = setInterval(
      this.flush.bind(this),
      this.option.flushTime,
    )
    this.convertValue = this.getConvertValue()
    this.typedArray = this.getTypedArray()
    this.initAudioContext()
    this.bindAudioContextEvent()
  }

  private getConvertValue(): number {
    const inputCodecs: Record<string, number> = {
      Int8: 128,
      Int16: 32768,
      Int32: 2147483648,
      Float32: 1,
    }
    if (!inputCodecs[this.option.inputCodec]) {
      throw new Error(
        'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
      )
    }
    return inputCodecs[this.option.inputCodec]
  }

  private getTypedArray(): typeof Int8Array {
    const typedArrays: Record<string, typeof Int8Array> = {
      Int8: Int8Array,
      Int16: Int16Array,
      Int32: Int32Array,
      Float32: Float32Array,
    }
    if (!typedArrays[this.option.inputCodec]) {
      throw new Error(
        'wrong codec.please input one of these codecs:Int8,Int16,Int32,Float32',
      )
    }
    return typedArrays[this.option.inputCodec]
  }

  private initAudioContext() {
    this.audioCtx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext)()
    this.gainNode = this.audioCtx.createGain()
    this.analyserNode = this.audioCtx.createAnalyser()
    this.analyserNode.fftSize = this.option.fftSize
    this.gainNode.connect(this.analyserNode)
    this.gainNode.connect(this.audioCtx.destination)
    if (this.option.volume !== undefined) {
      this.gainNode.gain.value = this.option.volume
    }
  }

  private static isTypedArray(
    data: ArrayBuffer | Uint8Array | unknown,
  ): data is ArrayBuffer | Uint8Array {
    return (
      (typeof data === 'object' &&
        data !== null &&
        'byteLength' in data &&
        'buffer' in data &&
        (data as { buffer: { constructor: unknown } }).buffer.constructor ===
          ArrayBuffer) ||
      data instanceof ArrayBuffer
    )
  }

  private isSupported(data: unknown): boolean {
    if (!PCMPlayer.isTypedArray(data)) {
      throw new Error('请传入ArrayBuffer或者任意TypedArray')
    }
    return true
  }

  feed(data: ArrayBuffer | Uint8Array): void {
    this.isSupported(data)
    const formatted = this.getFormattedValue(data)
    const tmp = new Float32Array(this.samples.length + formatted.length)
    tmp.set(this.samples, 0)
    tmp.set(formatted, this.samples.length)
    this.samples = tmp
  }

  private getFormattedValue(data: ArrayBuffer | Uint8Array): Float32Array {
    let view: Int8Array | Int16Array | Int32Array | Float32Array
    if (data instanceof ArrayBuffer) {
      view = new this.typedArray(data)
    } else {
      view = new this.typedArray(data.buffer)
    }
    const float32 = new Float32Array(view.length)
    for (let i = 0; i < view.length; i++) {
      float32[i] = view[i] / this.convertValue
    }
    return float32
  }

  volume(volume: number): void {
    this.gainNode.gain.value = volume
  }

  destroy(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    this.samples = new Float32Array()
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {})
    }
  }

  async pause(): Promise<void> {
    if (this.audioCtx) await this.audioCtx.suspend()
  }

  async continue(): Promise<void> {
    if (this.audioCtx) await this.audioCtx.resume()
  }

  private flush(): void {
    if (!this.samples || this.samples.length === 0) return
    const self = this
    const bufferSource = this.audioCtx.createBufferSource()
    if (typeof this.option.onended === 'function') {
      bufferSource.onended = function (event) {
        if (self.option.onended) {
          self.option.onended(this, event)
        }
      }
    }
    const length = this.samples.length / this.option.channels
    const audioBuffer = this.audioCtx.createBuffer(
      this.option.channels,
      length,
      this.option.sampleRate,
    )

    for (let channel = 0; channel < this.option.channels; channel++) {
      const audioData = audioBuffer.getChannelData(channel)
      let offset = channel
      let decrement = 50
      for (let i = 0; i < length; i++) {
        audioData[i] = this.samples[offset]
        if (i < 50) {
          audioData[i] = (audioData[i] * i) / 50
        }
        if (i >= length - 51) {
          audioData[i] = (audioData[i] * decrement--) / 50
        }
        offset += this.option.channels
      }
    }

    bufferSource.buffer = audioBuffer
    bufferSource.connect(this.gainNode)
    bufferSource.start(this.startTime ?? 0)
    this.startTime =
      (this.startTime ?? this.audioCtx.currentTime) + audioBuffer.duration

    this.samples = new Float32Array()
  }

  private bindAudioContextEvent() {
    const self = this
    if (typeof self.option.onstatechange === 'function') {
      this.audioCtx.onstatechange = function (event) {
        if (self.audioCtx && self.option.onstatechange) {
          self.option.onstatechange(this, event, self.audioCtx.state)
        }
      }
    }
  }
}
```

### Step 3.3: 创建 `src/client/index.ts`(临时版,Task 4 再扩展)

```typescript
/**
 * 浏览器端火山引擎 TTS 客户端。
 *
 * 零依赖,只用浏览器原生 API(AudioContext, WebSocket)。
 * ESM 输出,example 用 `<script type="module">` 引用。
 */
export { PCMPlayer } from './pcm-player'
export type { PCMPlayerOptions } from './types'
```

### Step 3.4: 提交(可选)

```bash
git add src/client/
git commit -m "feat(sdk): add client layer with PCMPlayer (browser audio playback)"
```

---

## Task 4: 实现 SDK 客户端层(TtsClient)

**Files:**
- Create: `src/client/tts-client.ts`
- Modify: `src/client/index.ts`

### Step 4.1: 创建 `src/client/tts-client.ts`

从原 `public/index.html` 282-426 行的 ws 处理逻辑抽出来,封装成 `TtsClient` 类。

```typescript
import type {
  TtsClientOptions,
  TtsClientState,
  SessionStartInfo,
  ChunkInfo,
  EndInfo,
} from './types'

interface ServerEventSessionStart extends SessionStartInfo {
  type: 'session_start'
}
interface ServerEventChunk extends ChunkInfo {
  type: 'chunk'
}
interface ServerEventFirstFrame {
  type: 'first_frame'
  at: number
}
interface ServerEventEnd extends EndInfo {
  type: 'end'
}
interface ServerEventError {
  type: 'error'
  error: string
}
type ServerEvent =
  | ServerEventSessionStart
  | ServerEventChunk
  | ServerEventFirstFrame
  | ServerEventEnd
  | ServerEventError

/**
 * 浏览器端 TTS WebSocket 客户端。
 *
 * 内部建 WebSocket、发送 start 消息、按事件类型分发到对应回调。
 * 消费者只需要在 `onAudioFrame` 里把 `ArrayBuffer` 喂给 `PCMPlayer`。
 */
export class TtsClient {
  private ws: WebSocket | null = null
  private opts: TtsClientOptions
  private _state: TtsClientState = 'idle'

  constructor(options: TtsClientOptions) {
    this.opts = options
  }

  get state(): TtsClientState {
    return this._state
  }

  start(): void {
    if (this._state === 'connecting' || this._state === 'open' || this._state === 'streaming') {
      console.warn('TtsClient: already started')
      return
    }
    this._state = 'connecting'

    const { url, binaryType = 'arraybuffer' } = this.opts
    const ws = new WebSocket(url)
    ws.binaryType = binaryType
    this.ws = ws

    ws.onopen = () => {
      this._state = 'open'
      ws.send(
        JSON.stringify({
          type: 'start',
          text: this.opts.text,
          voiceType: this.opts.voiceType,
          resourceId: this.opts.resourceId,
          simulateStream: this.opts.simulateStream ?? false,
        }),
      )
    }

    ws.onmessage = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        // 二进制帧:原始 PCM 字节
        this._state = 'streaming'
        this.opts.onAudioFrame?.(e.data)
        return
      }

      // 文本事件
      let msg: ServerEvent
      try {
        msg = JSON.parse(e.data) as ServerEvent
      } catch {
        return
      }
      switch (msg.type) {
        case 'session_start':
          this.opts.onSessionStart?.({
            sampleRate: msg.sampleRate,
            encoding: msg.encoding,
            channels: msg.channels,
          })
          break
        case 'chunk':
          this.opts.onChunk?.({
            index: msg.index,
            text: msg.text,
            at: msg.at,
          })
          break
        case 'first_frame':
          this.opts.onFirstFrame?.(msg.at)
          break
        case 'end':
          this.opts.onEnd?.({
            totalFrames: msg.totalFrames,
            totalBytes: msg.totalBytes,
          })
          break
        case 'error':
          this.opts.onError?.(msg.error)
          break
      }
    }

    ws.onerror = () => {
      this.opts.onError?.('WebSocket 异常')
    }

    ws.onclose = (event: CloseEvent) => {
      this._state = 'closed'
      this.opts.onClose?.(event)
    }
  }

  stop(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
    this._state = 'closed'
  }
}
```

### Step 4.2: 更新 `src/client/index.ts`

```typescript
/**
 * 浏览器端火山引擎 TTS 客户端。
 *
 * 零依赖,只用浏览器原生 API(AudioContext, WebSocket)。
 * ESM 输出,example 用 `<script type="module">` 引用。
 */
export { PCMPlayer } from './pcm-player'
export { TtsClient } from './tts-client'
export type {
  PCMPlayerOptions,
  TtsClientOptions,
  TtsClientState,
  SessionStartInfo,
  ChunkInfo,
  EndInfo,
} from './types'
```

### Step 4.3: 提交(可选)

```bash
git add src/client/
git commit -m "feat(sdk): add TtsClient (WebSocket client for structured events)"
```

---

## Task 5: 配置 SDK 构建

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`

### Step 5.1: 修改 `package.json`

把当前根 `package.json` 改为 SDK 的 package.json。name 沿用 `volc-speech-js-sdk`,加 `type: module`、`exports`、`build` 脚本。

```json
{
  "name": "volc-speech-js-sdk",
  "version": "0.1.0",
  "description": "火山引擎 v3 双向流式 TTS SDK(含协议层、Node 服务端、浏览器客户端)",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    },
    "./protocol": {
      "types": "./dist/protocol/index.d.ts",
      "import": "./dist/protocol/index.js"
    },
    "./server": {
      "types": "./dist/server/index.d.ts",
      "import": "./dist/server/index.js"
    },
    "./client": {
      "types": "./dist/client/index.d.ts",
      "import": "./dist/client/index.js"
    }
  },
  "files": [
    "dist",
    "src"
  ],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "clean": "rm -rf dist",
    "typecheck": "tsc --noEmit",
    "lint": "eslint src/**/*.ts",
    "lint:fix": "eslint src/**/*.ts --fix",
    "prettier": "prettier --write ."
  },
  "dependencies": {
    "uuid": "^11.1.0",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "@eslint/js": "^9.30.1",
    "@types/node": "^24.0.13",
    "@types/uuid": "^10.0.0",
    "@types/ws": "^8.18.1",
    "@typescript-eslint/eslint-plugin": "^8.36.0",
    "@typescript-eslint/parser": "^8.36.0",
    "eslint": "^9.30.1",
    "globals": "^16.3.0",
    "prettier": "^3.6.2",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.36.0"
  }
}
```

**关键差异(对比原 package.json):**
- `commander` 依赖移除(原 `bidirection.ts` 直接用 commander 做 CLI,重构后不再有 CLI 入口)
- `dotenv` 依赖移除(example 自己的依赖,SDK 不需要)
- `name` 沿用 `volc-speech-js-sdk`
- 新增 `type: module`、`exports`、`build` / `clean` 脚本
- `dev` / `start` 脚本移除(SDK 本体不需要启动服务,example 才有)

### Step 5.2: 修改 `tsconfig.json`

把现有 `tsconfig.json` 改为输出到 `dist/`。

定位到 `tsconfig.json` 的 `compilerOptions`,修改/添加以下字段:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "outDir": "./dist",
    "rootDir": "./src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "lib": ["ES2020", "DOM"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "example"]
}
```

**说明:** `lib` 包含 `DOM` 是因为 `src/client/pcm-player.ts` 用到 `window` / `AudioContext` 等浏览器 API;protocol / server 层虽然不直接用 DOM,但同一 tsconfig 涵盖全部源码,加 `DOM` lib 没有副作用。

### Step 5.3: 跑构建

```bash
rm -rf dist
npm run build
```

预期:
- 无错误
- `dist/protocol/{index.js,index.d.ts}`、`dist/server/{index.js,index.d.ts}`、`dist/client/{index.js,index.d.ts}` 都生成
- 顶层 `dist/index.js` 不存在(因为我们没有创建根 `src/index.ts`)

### Step 5.4: 检查产物

```bash
ls dist/protocol dist/server dist/client
find dist -name "*.d.ts" | sort
```

预期:每个子目录有 `index.js` + `index.d.ts`。

### Step 5.5: 提交(可选)

```bash
git add package.json tsconfig.json
git commit -m "build(sdk): configure tsc output to dist/ with exports map"
```

---

## Task 6: 创建 example 服务

**Files:**
- Create: `example/package.json`
- Create: `example/tsconfig.json`
- Create: `example/src/server.ts`
- Create: `example/src/chunked-text.ts`
- Create: `example/public/index.html`

### Step 6.1: 创建 `example/package.json`

```json
{
  "name": "@openz/tts-demo-example",
  "version": "0.1.0",
  "description": "火山引擎 TTS SDK 的 example 服务(参考实现)",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "dotenv_config_path=../.env ts-node --transpile-only -r dotenv/config src/server.ts",
    "start": "dotenv_config_path=../.env ts-node --transpile-only -r dotenv/config src/server.ts"
  },
  "dependencies": {
    "@openz/speech": "file:..",
    "dotenv": "^17.2.0",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "@types/node": "^24.0.13",
    "@types/ws": "^8.18.1",
    "ts-node": "^10.9.2",
    "typescript": "^5.8.3"
  }
}
```

> `dotenv_config_path=../.env` 是 `dotenv/config` 的内置机制,显式加载根级 `.env`。

### Step 6.2: 创建 `example/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "lib": ["ES2020"],
    "types": ["node"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

> 用 `CommonJS` 模块(配合 `ts-node --transpile-only` 走 Node CJS 加载),不要用 ESM——避免 `ts-node + ESM` 的兼容问题。

### Step 6.3: 创建 `example/src/chunked-text.ts`

从原 `src/server.ts` 95-130 行抽出来,变成可复用模块。

```typescript
/**
 * 把一段文本按句末标点(。！？；\n)切成多段,逐段 yield 出去。
 *
 * 不切分直接整段喂入的话,server 端只会看到 1 个 chunk,体现不出
 * sender/receiver 并发的优势。切成多段后:首段一合成完就开始推
 * PCM,后续段在浏览器已经播放时陆续合成出来,浏览器侧真正是
 * 边生成边听。
 *
 * `delayMs` 控制段间基础延时(毫秒),`jitter: true` 时叠加
 * ±50% 随机抖动,模拟 LLM 边生成边喂入的真实场景。首段不延迟
 * (用户已经点击播放,不该让前端等几百 ms 才开始)。
 */
export interface ChunkOptions {
  delayMs?: number
  jitter?: boolean
}

export function chunkedTextStream(
  text: string,
  opts: ChunkOptions = {},
): AsyncIterable<string> {
  const delayMs = opts.delayMs ?? 0
  const jitter = opts.jitter ?? false
  const chunks = text
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  if (chunks.length === 0) {
    chunks.push(text)
  }
  return {
    [Symbol.asyncIterator]() {
      let i = 0
      return {
        async next(): Promise<IteratorResult<string>> {
          if (i >= chunks.length) {
            return { value: undefined, done: true }
          }
          if (i > 0 && delayMs > 0) {
            const ms = jitter ? delayMs * (0.5 + Math.random()) : delayMs
            await new Promise<void>((r) => setTimeout(r, ms))
          }
          return { value: chunks[i++], done: false }
        },
      }
    },
  }
}
```

### Step 6.4: 创建 `example/src/server.ts`

从原 `src/server.ts` 1-435 行迁移,主要改动:
- 删掉内联的 `chunkedTextStream`,改为 `import { chunkedTextStream, type ChunkOptions } from './chunked-text'`
- 删掉 `import` 自 `./volcengine/bidirection`,改为 `import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE, type RunOptions } from '@openz/speech/server'`

```typescript
import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { WebSocketServer, WebSocket as WsSocket } from 'ws'
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE, type RunOptions } from '@openz/speech/server'
import { chunkedTextStream, type ChunkOptions } from './chunked-text'

const PORT = Number(process.env.PORT ?? 3000)
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public')

const APPKEY = process.env.VOLC_APPKEY ?? ''
const DEFAULT_VOICE_TYPE =
  process.env.VOLC_VOICE_TYPE ?? 'saturn_zh_female_aojiaonvyou_tob'
const DEFAULT_RESOURCE_ID =
  process.env.VOLC_RESOURCE_ID ?? 'seed-tts-2.0'

const MAX_TEXT_LEN = 2000

if (!APPKEY) {
  console.warn(
    '[server] VOLC_APPKEY 未设置,POST /api/tts 会在收到请求时再校验。',
  )
}

function sendJson(
  res: http.ServerResponse,
  status: number,
  body: unknown,
): void {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

function sendPcmHeaders(res: http.ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'application/octet-stream',
    'X-Audio-Encoding': 'pcm',
    'X-Audio-Sample-Rate': String(DEFAULT_SAMPLE_RATE),
    'X-Audio-Channels': '1',
    'Cache-Control': 'no-store',
  })
}

function serveStaticFile(
  res: http.ServerResponse,
  filePath: string,
  contentType: string,
): void {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    res.writeHead(200, { 'Content-Type': contentType })
    res.end(data)
  })
}

async function readJsonBody<T>(req: http.IncomingMessage): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) {
        reject(new Error('empty body'))
        return
      }
      try {
        resolve(JSON.parse(raw) as T)
      } catch (e) {
        reject(new Error('invalid json'))
      }
    })
    req.on('error', reject)
  })
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/'

  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    serveStaticFile(
      res,
      path.join(PUBLIC_DIR, 'index.html'),
      'text/html; charset=utf-8',
    )
    return
  }

  if (req.method === 'POST' && url === '/api/tts') {
    if (!APPKEY) {
      sendJson(res, 500, { error: 'VOLC_APPKEY not configured' })
      return
    }

    let body: {
      text?: string
      voiceType?: string
      resourceId?: string
      simulateStream?: boolean | number
    }
    try {
      body = await readJsonBody<{
        text?: string
        voiceType?: string
        resourceId?: string
        simulateStream?: boolean | number
      }>(req)
    } catch (e) {
      sendJson(res, 400, { error: (e as Error).message })
      return
    }

    const text = (body.text ?? '').trim()
    if (!text) {
      sendJson(res, 400, { error: 'text 不能为空' })
      return
    }
    if (text.length > MAX_TEXT_LEN) {
      sendJson(res, 400, {
        error: `text 超过最大长度 ${MAX_TEXT_LEN} 字`,
      })
      return
    }

    const voiceType = (body.voiceType ?? DEFAULT_VOICE_TYPE).trim()
    const resourceId = (body.resourceId ?? DEFAULT_RESOURCE_ID).trim()

    let streamOpts: ChunkOptions = {}
    if (body.simulateStream === true) {
      streamOpts = { delayMs: 500, jitter: true }
    } else if (
      typeof body.simulateStream === 'number' &&
      body.simulateStream > 0
    ) {
      streamOpts = { delayMs: body.simulateStream, jitter: false }
    }

    console.log(
      `[tts] request: voice=${voiceType} resource=${resourceId} text_len=${text.length}` +
        (Object.keys(streamOpts).length
          ? ` simulate=${JSON.stringify(streamOpts)}`
          : ''),
    )

    sendPcmHeaders(res)

    const stream = bidirectionTtsStream({
      appkey: APPKEY,
      resourceId,
      voiceType,
      encoding: 'pcm',
      sampleRate: DEFAULT_SAMPLE_RATE,
      texts: chunkedTextStream(text, streamOpts),
    })

    stream.on('data', (chunk: Buffer) => {
      res.write(chunk)
    })
    stream.on('end', () => {
      res.end()
      console.log('[tts] stream end')
    })
    stream.on('error', (err) => {
      console.error('[tts] stream error:', err)
      try {
        res.destroy(err)
      } catch {
        /* noop */
      }
    })

    req.on('close', () => {
      if (!res.writableEnded) {
        console.log('[tts] client closed, destroying stream')
        stream.destroy()
      }
    })
    return
  }

  sendJson(res, 404, { error: 'not found' })
})

// WebSocket 路由 /api/tts/ws
const wss = new WebSocketServer({ noServer: true })

server.on('upgrade', (req, socket, head) => {
  const url = req.url ?? ''
  if (url === '/api/tts/ws') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleTtsSocket(ws)
    })
  } else {
    socket.destroy()
  }
})

function handleTtsSocket(ws: WsSocket): void {
  let disposed = false
  const safeSend = (
    data: string | Buffer,
    opts: { binary?: boolean } = {},
  ) => {
    if (disposed) return
    try {
      ws.send(data, opts, () => {
        /* noop */
      })
    } catch {
      /* ignore */
    }
  }

  ws.on('close', () => {
    disposed = true
  })
  ws.on('error', () => {
    disposed = true
  })

  ws.on('message', async (data) => {
    if (disposed) return

    interface StartMessage {
      type: 'start'
      text?: string
      voiceType?: string
      resourceId?: string
      simulateStream?: boolean | number
    }

    let req: StartMessage
    try {
      req = JSON.parse(data.toString()) as StartMessage
    } catch {
      safeSend(JSON.stringify({ type: 'error', error: 'invalid json' }))
      return
    }
    if (req.type !== 'start') {
      safeSend(JSON.stringify({ type: 'error', error: 'unknown type' }))
      return
    }

    if (!APPKEY) {
      safeSend(
        JSON.stringify({ type: 'error', error: 'VOLC_APPKEY not configured' }),
      )
      return
    }

    const text = (req.text ?? '').trim()
    if (!text) {
      safeSend(JSON.stringify({ type: 'error', error: 'text 不能为空' }))
      return
    }
    if (text.length > MAX_TEXT_LEN) {
      safeSend(
        JSON.stringify({
          type: 'error',
          error: `text 超过最大长度 ${MAX_TEXT_LEN} 字`,
        }),
      )
      return
    }

    const voiceType = (req.voiceType ?? DEFAULT_VOICE_TYPE).trim()
    const resourceId = (req.resourceId ?? DEFAULT_RESOURCE_ID).trim()

    let streamOpts: ChunkOptions = {}
    if (req.simulateStream === true) {
      streamOpts = { delayMs: 500, jitter: true }
    } else if (
      typeof req.simulateStream === 'number' &&
      req.simulateStream > 0
    ) {
      streamOpts = { delayMs: req.simulateStream, jitter: false }
    }

    console.log(
      `[ws-tts] request: voice=${voiceType} resource=${resourceId} text_len=${text.length}` +
        (Object.keys(streamOpts).length
          ? ` simulate=${JSON.stringify(streamOpts)}`
          : ''),
    )

    safeSend(
      JSON.stringify({
        type: 'session_start',
        sampleRate: DEFAULT_SAMPLE_RATE,
        encoding: 'pcm',
        channels: 1,
      }),
    )

    let totalFrames = 0
    let totalBytes = 0

    const stream = bidirectionTtsStream({
      appkey: APPKEY,
      resourceId,
      voiceType,
      encoding: 'pcm',
      sampleRate: DEFAULT_SAMPLE_RATE,
      texts: chunkedTextStream(text, streamOpts),
      onChunk: (index: number, chunkText: string, at: number) => {
        console.log(`[ws-tts] chunk #${index} at=${at}ms "${chunkText.slice(0, 20)}"`)
        safeSend(
          JSON.stringify({ type: 'chunk', index, text: chunkText, at }),
        )
      },
      onFirstFrame: (at: number) => {
        console.log(`[ws-tts] first_frame at=${at}ms`)
        safeSend(JSON.stringify({ type: 'first_frame', at }))
      },
    } satisfies RunOptions)

    stream.on('data', (chunk: Buffer) => {
      totalFrames += 1
      totalBytes += chunk.length
      safeSend(chunk, { binary: true })
    })
    stream.on('end', () => {
      safeSend(
        JSON.stringify({ type: 'end', totalFrames, totalBytes }),
      )
      console.log(
        `[ws-tts] end: totalFrames=${totalFrames} totalBytes=${totalBytes}`,
      )
    })
    stream.on('error', (err) => {
      safeSend(
        JSON.stringify({ type: 'error', error: (err as Error).message }),
      )
      console.error('[ws-tts] error:', err)
    })

    ws.on('close', () => {
      disposed = true
      stream.destroy()
    })
  })
}

server.listen(PORT, () => {
  console.log(`[server] listening on http://localhost:${PORT}`)
  console.log(`[server] ws endpoint: ws://localhost:${PORT}/api/tts/ws`)
  console.log(
    `[server] voice=${DEFAULT_VOICE_TYPE} resource=${DEFAULT_RESOURCE_ID}`,
  )
})
```

### Step 6.5: 创建 `example/public/index.html`

从原 `public/index.html` 迁移,主要改动:
- 把内联 `PCMPlayer` 类删除(改用 SDK)
- 把 ws 处理逻辑删除(改用 `TtsClient`)
- 头部加 `<script type="module">` 引入 SDK

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>火山引擎 TTS 流式播放 Demo</title>
    <style>
      :root { color-scheme: light dark; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
          'Helvetica Neue', Arial, 'PingFang SC', 'Microsoft YaHei', sans-serif;
        max-width: 720px;
        margin: 40px auto;
        padding: 0 16px;
        line-height: 1.6;
      }
      h1 { font-size: 20px; margin-bottom: 4px; }
      .hint { color: #888; font-size: 13px; margin-bottom: 24px; }
      textarea {
        width: 100%; min-height: 100px; padding: 8px 10px;
        font-size: 15px; font-family: inherit; border-radius: 6px;
        border: 1px solid #ccc; box-sizing: border-box; resize: vertical;
      }
      .row { margin-top: 12px; display: flex; gap: 8px; align-items: center; }
      button {
        padding: 8px 16px; font-size: 15px; border: none; border-radius: 6px;
        cursor: pointer; background: #2563eb; color: white;
      }
      button:disabled { background: #94a3b8; cursor: not-allowed; }
      button.stop { background: #dc2626; }
      #status { margin-top: 12px; font-size: 13px; color: #555; min-height: 1.4em; }
      #status.error { color: #dc2626; }
    </style>
  </head>
  <body>
    <h1>火山引擎 TTS 流式播放 Demo</h1>
    <p class="hint">
      基于 <code>@openz/speech/client</code>(SDK 浏览器端),点击「播放」会向
      <code>ws://&lt;host&gt;/api/tts/ws</code> 发起请求,服务端把火山引擎返回的
      PCM 字节流边收边推给浏览器,SDK 用 PCMPlayer 边收边喂给 AudioContext 实时播放。
    </p>

    <label for="text">要合成的文本:</label>
    <textarea id="text" placeholder="例如:今天天气不错,适合出门走走。">
你好,我是火山引擎的语音合成服务。今天天气怎么样?我推荐你试试豆包语音合成模型 2.0,效果更自然。好的,那就这样,再见!</textarea>

    <div class="row">
      <button id="playBtn">▶ 播放</button>
      <button id="stopBtn" class="stop" disabled>■ 停止</button>
      <label class="hint" style="user-select: none; cursor: pointer;">
        <input type="checkbox" id="simulateStream" />
        模拟 LLM 逐步生成(段间 250~750ms 随机延迟)
      </label>
    </div>
    <div id="status">就绪</div>
    <pre id="log" style="margin-top:14px;padding:10px;background:#0b1020;color:#d1d5db;
      font:12px/1.5 ui-monospace,Menlo,monospace;border-radius:6px;
      max-height:240px;overflow:auto;white-space:pre-wrap;"></pre>

    <!-- 静态服务:example server 启动后,浏览器需要能解析这个路径。example server
         在 Step 6.6 中要加一个 GET /static/sdk-client.esm.js 的路由,把
         <root>/dist/client/index.js 暴露出去。或者把 dist/client/index.js
         复制到 example/public/sdk-client.esm.js 后再 import。推荐用前者。 -->
    <script type="module">
      import { PCMPlayer, TtsClient } from '/static/sdk-client.esm.js'

      const $text = document.getElementById('text')
      const $play = document.getElementById('playBtn')
      const $stop = document.getElementById('stopBtn')
      const $simulate = document.getElementById('simulateStream')
      const $status = document.getElementById('status')
      const $log = document.getElementById('log')

      let pcmPlayer = null
      let ttsClient = null
      let sessionStart = 0
      const t0 = () => (typeof performance !== 'undefined' ? performance.now() : Date.now())
      const tStr = (t) => `+${(t / 1000).toFixed(2)}s`

      function log(line) {
        const ts = tStr(t0() - sessionStart)
        $log.textContent += `[${ts}] ${line}\n`
        $log.scrollTop = $log.scrollHeight
      }

      function setStatus(text, isError = false) {
        $status.textContent = text
        $status.classList.toggle('error', isError)
      }

      function setBusy(busy) {
        $play.disabled = busy
        $stop.disabled = !busy
      }

      let audioFrameCount = 0
      let audioBytes = 0
      let chunkCount = 0

      function play() {
        const text = $text.value.trim()
        if (!text) {
          setStatus('请输入要合成的文本', true)
          return
        }

        setBusy(true)
        sessionStart = t0()
        audioFrameCount = 0
        audioBytes = 0
        chunkCount = 0
        $log.textContent = ''
        setStatus('连接中...')
        log('点击播放,开始建连')

        // 必须在用户点击事件内建 AudioContext(浏览器自动播放策略)
        pcmPlayer = new PCMPlayer({
          inputCodec: 'Int16',
          channels: 1,
          sampleRate: 24000,
          flushTime: 200,
        })
        if (pcmPlayer.audioCtx.state === 'suspended') {
          pcmPlayer.audioCtx.resume()
        }

        const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
        ttsClient = new TtsClient({
          url: `${proto}//${location.host}/api/tts/ws`,
          text,
          simulateStream: $simulate.checked ? true : false,
          onSessionStart: (info) => {
            log(`📡 session_start: sampleRate=${info.sampleRate} encoding=${info.encoding}`)
            // 如果 sampleRate 变化,重建 player
            if (pcmPlayer && pcmPlayer.audioCtx.sampleRate !== info.sampleRate) {
              pcmPlayer.destroy()
              pcmPlayer = new PCMPlayer({
                inputCodec: 'Int16',
                channels: info.channels,
                sampleRate: info.sampleRate,
                flushTime: 200,
              })
            }
          },
          onChunk: (info) => {
            chunkCount = info.index
            log(`📝 收到第 ${info.index} 段文本 (${tStr(info.at)}): "${info.text.slice(0, 30)}${info.text.length > 30 ? '...' : ''}"`)
          },
          onFirstFrame: (at) => {
            log(`⚡ first_frame ${tStr(at)} - 服务端推回首帧`)
          },
          onAudioFrame: (data) => {
            audioFrameCount += 1
            audioBytes += data.byteLength
            if (pcmPlayer) pcmPlayer.feed(new Uint8Array(data))
            if (audioFrameCount === 1) {
              log(`🎵 第一个音频帧到达: ${data.byteLength} bytes,累计 ${(audioBytes/1024).toFixed(1)} KB`)
            } else if (audioFrameCount % 10 === 0) {
              log(`🎵 音频帧 #${audioFrameCount}: 累计 ${(audioBytes/1024).toFixed(1)} KB`)
            }
            setStatus(`合成中... 段 ${chunkCount}/音频帧 ${audioFrameCount}`)
          },
          onEnd: (info) => {
            log(`✅ end: totalFrames=${info.totalFrames} totalBytes=${(info.totalBytes/1024).toFixed(1)} KB`)
            setStatus('合成完成,等待播放结束')
          },
          onError: (msg) => {
            log(`❌ error: ${msg}`)
            setStatus('出错:' + msg, true)
          },
          onClose: () => {
            log('🔌 ws closed')
            setBusy(false)
          },
        })
        ttsClient.start()
      }

      function stop() {
        if (ttsClient) ttsClient.stop()
        if (pcmPlayer) pcmPlayer.destroy()
        pcmPlayer = null
        ttsClient = null
        setBusy(false)
        setStatus('已停止')
      }

      $play.addEventListener('click', play)
      $stop.addEventListener('click', stop)
    </script>
  </body>
</html>
```

### Step 6.6: 在 example server 中加静态资源路由

修改 `example/src/server.ts`,在 HTTP 路由部分增加一个 `/static/*` 路由,把 `<root>/dist/client/index.js` 暴露成 `/static/sdk-client.esm.js`。

在 `http.createServer` 回调的开头,GET 路由的判断中,加入:

```typescript
// SDK 客户端 ESM 静态资源
if (req.method === 'GET' && url.startsWith('/static/')) {
  const filename = url.slice('/static/'.length)
  // 只允许暴露 client ESM
  if (filename !== 'sdk-client.esm.js') {
    sendJson(res, 404, { error: 'not found' })
    return
  }
  const sdkPath = path.resolve(__dirname, '..', '..', 'dist', 'client', 'index.js')
  serveStaticFile(res, sdkPath, 'application/javascript; charset=utf-8')
  return
}
```

注意:这段代码要放在已有的 GET 路由判断之前(在 `if (req.method === 'GET' && (url === '/' || ...))` 之前)。

### Step 6.7: 安装 example 依赖

```bash
cd example
npm install
```

预期:`@openz/speech` 通过 `file:..` 链接,`ws` / `dotenv` 安装成功。

### Step 6.8: 提交(可选)

```bash
git add example/
git commit -m "feat(example): create tts-demo-example as SDK reference implementation"
```

---

## Task 7: 端到端冒烟测试

### Step 7.1: 启动 example 服务

```bash
cd example
npm run dev
```

预期输出:
```
[server] VOLC_APPKEY 未设置,POST /api/tts 会在收到请求时再校验。
[server] listening on http://localhost:3000
[server] ws endpoint: ws://localhost:3000/api/tts/ws
[server] voice=saturn_zh_female_aojiaonvyou_tob resource=seed-tts-2.0
```

如果 `VOLC_APPKEY` 未设置也无妨——浏览器侧会收到 error 事件,不会崩溃。

### Step 7.2: 验证 SDK 静态资源可访问

```bash
curl -I http://localhost:3000/static/sdk-client.esm.js
```

预期:`HTTP/1.1 200 OK`,`Content-Type: application/javascript; charset=utf-8`

### Step 7.3: 验证 index.html 可访问

```bash
curl -I http://localhost:3000/
```

预期:`HTTP/1.1 200 OK`,`Content-Type: text/html; charset=utf-8`

### Step 7.4: 浏览器端到端

1. 打开浏览器访问 `http://localhost:3000/`
2. 打开 DevTools Console,确认无 JS 报错(尤其是 SDK 加载错误)
3. 点击「播放」按钮
4. 预期:
   - `#log` 区域出现 `📡 session_start: sampleRate=24000 encoding=pcm`
   - 出现 `📝 收到第 1 段文本`
   - 出现 `⚡ first_frame +N.NNs`(N 较小,通常 0.5-1.5s)
   - 出现多个 `🎵 音频帧 #N` 日志
   - 听到 PCM 实时播放声音
   - 最终出现 `✅ end: totalFrames=N totalBytes=N KB`
   - 出现 `🔌 ws closed`
5. 勾选「模拟 LLM 逐步生成」再次点击,应能听到明显分段的播放效果

### Step 7.5: 停止服务

```bash
# 在 dev 进程运行的终端按 Ctrl+C
```

---

## Task 8: 清理旧文件

**Files:**
- Delete: `src/protocols.ts`
- Delete: `src/volcengine/bidirection.ts`(及整个 `src/volcengine/` 目录)
- Delete: `src/server.ts`
- Delete: `public/index.html`(及整个 `public/` 目录)

### Step 8.1: 删除旧文件

```bash
rm src/protocols.ts
rm -rf src/volcengine
rm src/server.ts
rm -rf public
```

### Step 8.2: 重新构建 SDK 确认仍然通过

```bash
cd <root>  # 回到仓库根
rm -rf dist
npm run build
```

预期:无错误,`dist/{protocol,server,client}/` 都生成。

### Step 8.3: 重新启动 example 确认仍然工作

```bash
cd example
npm run dev
```

预期:服务正常启动。

打开浏览器访问 `http://localhost:3000/` 并点击「播放」,再次走一遍 Step 7.4。

### Step 8.4: 提交(可选)

```bash
git add -u
git commit -m "refactor: remove old src/protocols.ts, src/volcengine, src/server.ts, public/"
```

---

## 验收 checklist

- [ ] `src/protocol/{index,messages,codec,frame}.ts` 存在
- [ ] `src/server/{index,bidirection,types}.ts` 存在
- [ ] `src/client/{index,types,pcm-player,tts-client}.ts` 存在
- [ ] `example/{package.json,tsconfig.json}` 存在
- [ ] `example/src/{server,chunked-text}.ts` 存在
- [ ] `example/public/index.html` 存在
- [ ] `package.json` 含 `type: module` + `exports` map
- [ ] `tsconfig.json` 输出到 `./dist`,生成 `.d.ts`
- [ ] `npm run build` 通过
- [ ] `dist/protocol/index.d.ts`、`dist/server/index.d.ts`、`dist/client/index.d.ts` 都存在
- [ ] 旧文件 `src/protocols.ts`、`src/volcengine/`、`src/server.ts`、`public/index.html` 已删除
- [ ] example 服务启动成功
- [ ] 浏览器访问 `http://localhost:3000/` 走完一遍 ws 流式 TTS
- [ ] 浏览器 Console 无报错
- [ ] `#log` 区域显示完整事件流(connect / chunk / first_frame / end)
- [ ] 「模拟 LLM 逐步生成」开关有效
- [ ] `example/public/index.html` 行数从 433 行降到 ~250 行
