import * as fs from 'fs'
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
  /** 音频编码格式，默认 mp3 */
  encoding?: string
  /** WebSocket 端点，默认官方 bidirection 地址 */
  endpoint?: string
  /**
   * 输出文件路径（含扩展名）。留空则默认
   * `<voiceType>.<encoding>`，写到当前工作目录。
   */
  outputFile?: string
}

/**
 * 调用一次双向流式 TTS 合成。
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
  const endpoint = opts.endpoint ?? DEFAULT_ENDPOINT
  const outputFile = opts.outputFile ?? `${opts.voiceType}.${encoding}`

  // 注：AsyncIterable 没有 length 可查，是否为空在拉取阶段检查。

  // 新版控制台鉴权：单个 X-Api-Key 头。
  // 旧版控制台才需要同时传 X-Api-App-Id + X-Api-Access-Key 两件套。
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
    sample_rate: 24000,
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

  // 流式喂入：异步拉取每一个 chunk，片段之间天然支持任意延迟。
  let chunkIndex = 0
  let hasAnyChunk = false
  for await (const chunk of opts.texts) {
    hasAnyChunk = true
    chunkIndex += 1
    const now = new Date().toISOString().slice(11, 23)
    console.log(
      `\n[stream @${now}] chunk ${chunkIndex}: ${chunk.slice(0, 40)}${chunk.length > 40 ? '...' : ''}`,
    )
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

  // 收齐所有音频帧，拼成一段完整的音频。
  const audio: Uint8Array[] = []
  let audioFrames = 0
  while (true) {
    const msg = await ReceiveMessage(ws)
    console.log(`${msg.toString()}`)

    switch (msg.type) {
      case MsgType.FullServerResponse:
        break
      case MsgType.AudioOnlyServer:
        audio.push(msg.payload)
        audioFrames += 1
        break
      default:
        throw new Error(`${msg.toString()}`)
    }
    if (msg.event === EventType.SessionFinished) {
      break
    }
  }

  if (audio.length === 0) {
    throw new Error('no audio received')
  }

  const total = audio.reduce((sum, buf) => sum + buf.length, 0)
  const merged = new Uint8Array(total)
  let offset = 0
  for (const buf of audio) {
    merged.set(buf, offset)
    offset += buf.length
  }
  await fs.promises.writeFile(outputFile, merged)
  console.log(
    `\naudio saved to ${outputFile} (${audioFrames} frames, ${total} bytes)`,
  )

  await FinishConnection(ws)

  console.log(
    `${await WaitForEvent(
      ws,
      MsgType.FullServerResponse,
      EventType.ConnectionFinished,
    ).then((msg) => msg.toString())}`,
  )

  ws.close()
  return outputFile
}

/**
 * 作为入口文件直接运行时（`npx ts-node src/volcengine/bidirection.ts`）
 * 走一次流式喂入示例调用：模拟「语音通话」场景，调用方边产生文本边
 * 喂入，每段之间还有几百毫秒延迟，演示片段间任意延迟也能合成。
 * 作为模块 import 时不会执行，便于其它代码直接复用 `bidirectionTts`。
 */
if (require.main === module) {
  const sleep = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms))

  // 异步生成器：把同一段话按句号切成 4 段，每段之间随机 sleep
  // 一段时间，模拟 LLM 边吐 token 边喂入。
  async function* streamedText() {
    const fullText =
      '你好，我是火山引擎的语音合成服务。今天天气怎么样？' +
      '我推荐你试试豆包语音合成模型2.0，效果更自然。好的，那就这样，再见！'
    const chunks = fullText
      .split(/(?<=[。！？])/)
      .filter((s) => s.trim().length > 0)
    for (const chunk of chunks) {
      // 模拟 LLM/用户的输入延迟（300 ~ 1200ms）
      await sleep(300 + Math.random() * 900)
      yield chunk
    }
  }

  bidirectionTts({
    appkey: 'd098393c-32be-4b38-9814-c85da94dc6c6',
    resourceId: 'seed-tts-2.0',
    voiceType: 'saturn_zh_female_aojiaonvyou_tob',
    texts: streamedText(),
  }).catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
