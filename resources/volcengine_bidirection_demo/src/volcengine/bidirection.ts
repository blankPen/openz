import * as fs from 'fs'
import { Readable } from 'stream'
import WebSocket from 'ws'
import * as uuid from 'uuid'
import {
  MsgType,
  ReceiveMessage,
  EventType,
  StartConnection,
  StartSession,
  TaskRequest,
  FinishSession,
  FinishConnection,
  WaitForEvent,
} from '../protocols'

const DEFAULT_ENDPOINT =
  'wss://openspeech.bytedance.com/api/v3/tts/bidirection'

/** 默认 PCM 采样率（Hz），流式 PCM 播放时用。 */
export const DEFAULT_SAMPLE_RATE = 24000

/**
 * 火山引擎大模型语音合成 双向流式 TTS 调用参数。
 *
 * 鉴权：使用「新版控制台」时仅需传入 appkey（API Key），握手时通过
 *       `X-Api-Key` 头发送。旧版控制台需要同时传 appid + access_key
 *       两个头，本函数不直接支持旧版控制台。
 *
 * 资源：resourceId 与 voiceType 必须匹配（同一代模型）。
 *       * 声音为 TTS 1.0 音色（如 `xxx_tob` 之前的老音色）时，
 *         配 `seed-tts-1.0` 或 `seed-tts-1.0-concurr`。
 *       * 声音为 TTS 2.0 音色（豆包语音合成模型 2.0 列表）时，
 *         配 `seed-tts-2.0`。
 */
export interface BidirectionTtsOptions {
  /** 新版控制台的 API Key */
  appkey: string
  /** 资源 ID，决定模型版本与计费方式 */
  resourceId: string
  /** 音色 ID，必须与 resourceId 同一代模型 */
  voiceType: string
  /**
   * 流式输入的文本片段：模拟「语音通话」场景，调用方按自己的节奏
   * 逐段喂入文本（可以是整句、几个字、或大模型流式吐出的 token 块），
   * 片段之间可以存在任意延迟。
   *
   * 用 `AsyncIterable<string>` 而非 `string[]` 是关键：函数会
   * `for await` 拉取每个片段，前一个 TaskRequest 发完之后才拉取
   * 下一段，因此 LLM 边生成边喂入的延迟会被自然吞掉，不会出现
   * 「攒齐再发」的等待。
   *
   * 所有片段最终合成到 **一个** 音频文件中（不是按 turn 切片）。
   */
  texts: AsyncIterable<string> | Iterable<string>
  /** 音频编码格式，默认 mp3。流式场景建议 pcm */
  encoding?: string
  /** 采样率（Hz），默认 24000。仅 pcm 时真正生效 */
  sampleRate?: number
  /** WebSocket 端点，默认官方 bidirection 地址 */
  endpoint?: string
  /**
   * 输出文件路径（含扩展名）。仅 `bidirectionTts`（落盘版本）使用。
   * 留空则默认 `<voiceType>.<encoding>`，写到当前工作目录。
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

/**
 * 内部：完成一次完整的 bidirection 合成流程。
 *
 * 流程：建连 → StartConnection → StartSession → 流式喂入 TaskRequest
 *       → FinishSession → 边收音频帧边回调 `onAudioFrame` → 收齐
 *       SessionFinished → FinishConnection。
 *
 * 收音频帧阶段是「边收边调」：每收到一帧就调用一次 onAudioFrame，
 * 不等全部收齐，方便上游做流式转发。
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

  await StartConnection(ws)

  console.log(
    `${await WaitForEvent(
      ws,
      MsgType.FullServerResponse,
      EventType.ConnectionStarted,
    ).then((msg) => msg.toString())}`,
  )

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

  await StartSession(
    ws,
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
  )

  console.log(
    `${await WaitForEvent(
      ws,
      MsgType.FullServerResponse,
      EventType.SessionStarted,
    ).then((msg) => msg.toString())}`,
  )

  // 并发收发：sender 边从 texts 拉 chunk 边发 TaskRequest，receiver 同步
  // 收音频帧。每个 TaskRequest 之后服务端会立刻开始推流式音频帧
  // (这就是 v3 bidirection 协议真正的「边合成边回」)，如果串行
  // 「先全发完再收」会把所有早期音频帧堆在 ws recv buffer 里，
  // 首帧延迟从「首段合成」退化到「整段合成」。两个协程并发跑
  // 即可让 onAudioFrame 在首段合成完成时立即触发。
  //
  // SessionFinished 是服务端在收到 FinishSession 之后才回的，
  // 所以 receiver 见到它时 sender 一定已经走完，Promise.all
  // 会一起结束。
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
      await TaskRequest(
        ws,
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
      )
    }
    if (!hasAnyChunk) {
      throw new Error('texts 为空，至少要 yield 一段文本')
    }
    await FinishSession(ws, sessionId)
  })()

  const receiver = (async () => {
    while (true) {
      const msg = await ReceiveMessage(ws)
      switch (msg.type) {
        case MsgType.FullServerResponse:
          // 进度/ack 帧，忽略即可
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

  await FinishConnection(ws)

  console.log(
    `${await WaitForEvent(
      ws,
      MsgType.FullServerResponse,
      EventType.ConnectionFinished,
    ).then((msg) => msg.toString())}`,
  )

  ws.close()
  return { audioFrames, totalBytes }
}

/**
 * 调用一次双向流式 TTS 合成，把结果写到单个文件。
 *
 * 行为：建连 → StartConnection → StartSession →
 *       对 `texts` 中每段顺序发一次 TaskRequest（流式喂入）→
 *       FinishSession → 收齐全部音频帧并拼接落盘为单个文件 →
 *       FinishConnection。
 *
 * 与「按 turn 切分输出多个文件」的区别：本函数始终输出 1 个文件，
 * 适合「边生成边听、最后拿到一整段语音」的电话式交互。
 *
 * 任一步骤收到 Error 帧或连接异常都会抛错。
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
 * 调用一次双向流式 TTS 合成，把音频以「边收边推」的方式通过
 * Node `Readable` 流式返回。
 *
 * 与 `bidirectionTts` 的区别：本函数不会等所有音频帧收齐再返回，
 * 而是服务端每收到一帧就立刻 `push` 到 Readable，下游
 * (HTTP 响应、SSE、文件…) 即可边收边写。适合「边合成边播放」
 * 的实时场景（例如浏览器里实时 PCM 播放）。
 *
 * 默认 `encoding: 'pcm'`，因为 mp3 整段才能解码，边推边播
 * 浏览器原生不友好；pcm 16-bit le mono + 24kHz 可以被 Web
 * Audio API 边收边解码。
 */
export function bidirectionTtsStream(
  opts: RunOptions,
): Readable {
  const encoding = opts.encoding ?? 'pcm'
  const sampleRate = opts.sampleRate ?? 24000

  const stream = new Readable({
    read() {
      /* 推模式：read() 由 _runBidirection 主动 push */
    },
  })

  // 启动后台任务。错误要传给 Readable，否则消费方永远 hang。
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
