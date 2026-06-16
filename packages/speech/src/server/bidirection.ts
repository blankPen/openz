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
  getMsgTypeName,
  getEventTypeName,
  type Message,
} from '../protocol/index.js'
import type { BidirectionTtsOptions, RunOptions } from './types.js'

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

  try {
    await Promise.all([sender, receiver])

    // FinishConnection
    ws.send(buildFinishConnection())
    await waitForEvent(ws, MsgType.FullServerResponse, EventType.ConnectionFinished)
  } finally {
    ws.close()
  }
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
        // 转为 ws error 事件,让 receiveMessage 的 errorHandler reject
        ws.emit('error', error instanceof Error ? error : new Error(String(error)))
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
      `Unexpected message: type=${getMsgTypeName(msg.type)}, event=${getEventTypeName(msg.event || 0)}`,
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
