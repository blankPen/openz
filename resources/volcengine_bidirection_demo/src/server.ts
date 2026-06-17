import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { WebSocketServer, WebSocket as WsSocket } from 'ws'
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE, RunOptions } from './volcengine/bidirection'

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
    '[server] VOLC_APPKEY 未设置，POST /api/tts 会在收到请求时再校验。',
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

/**
 * 把一段文本按句末标点（。！？；\n）切成多段，逐段 yield 出去。
 *
 * 不切分直接整段喂入的话，server 端只会看到 1 个 chunk，体现不出
 * sender/receiver 并发的优势。切成多段后：首段一合成完就开始推
 * PCM，后续段在浏览器已经播放时陆续合成出来，浏览器侧真正是
 * 边生成边听。
 *
 * `delayMs` 控制段间基础延时（毫秒），`jitter: true` 时叠加
 * ±50% 随机抖动，模拟 LLM 边生成边喂入的真实场景。首段不延迟
 * （用户已经点击播放，不该让前端等几百 ms 才开始）。
 */
interface ChunkOptions {
  delayMs?: number
  jitter?: boolean
}

function chunkedTextStream(
  text: string,
  opts: ChunkOptions = {},
): AsyncIterable<string> {
  const delayMs = opts.delayMs ?? 0
  const jitter = opts.jitter ?? false
  const chunks = text
    .split(/(?<=[。！？；\n])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  // 没有任何切点时（例如用户输入「你好」），整段作为 1 个 chunk
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
          // i > 0 说明至少已经 yield 过一次，这时才 sleep
          // (否则首段也被延迟了，体感很差)
          if (i > 0 && delayMs > 0) {
            const ms = jitter
              ? delayMs * (0.5 + Math.random())
              : delayMs
            await new Promise<void>((r) => setTimeout(r, ms))
          }
          return { value: chunks[i++], done: false }
        },
      }
    },
  }
}

const server = http.createServer(async (req, res) => {
  const url = req.url ?? '/'

  // 静态文件:仅 / 与 /index.html
  if (req.method === 'GET' && (url === '/' || url === '/index.html')) {
    serveStaticFile(
      res,
      path.join(PUBLIC_DIR, 'index.html'),
      'text/html; charset=utf-8',
    )
    return
  }

  // 流式 TTS 接口
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

    // simulateStream:
    //   不传 / false / 0 → 不延迟
    //   true             → 段间 500ms ±50% 抖动(模拟 LLM 边生成)
    //   正数 n            → 段间固定 n ms
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
      // header 已经发出，没法改成 json，只能断流。
      try {
        res.destroy(err)
      } catch {
        /* noop */
      }
    })

    // 客户端中断
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

// ============================================================================
// WebSocket 路由 /api/tts/ws
//
// 用 ws 而不是 fetch 的关键原因：fetch 拿到的是纯 PCM 字节流，前端没法
// 知道「这一帧对应的是第几段文本」。ws 让我们把「段边界」「首帧」「音频
// 数据」「结束」作为结构化事件分开推，前端能按事件类型分别打日志
// / 状态，体验上真正能感受到「边喂文本边出音频」。
//
// 事件协议（所有文本事件都是 JSON）：
//   C → S:  { "type":"start", "text":..., "voiceType"?, "resourceId"?,
//                          "simulateStream": true | number }
//   S → C:  { "type":"session_start", "sampleRate":24000, "encoding":"pcm" }
//   S → C:  { "type":"chunk", "index":N, "text":"...", "at":<ms> }
//   S → C:  { "type":"first_frame", "at":<ms> }
//   S → C:  <binary frame>  Int16 LE PCM 16k/24kHz/48kHz mono
//   S → C:  { "type":"end", "totalFrames":N, "totalBytes":N }
//   S → C:  { "type":"error", "error":"..." }
// ============================================================================

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
      // 永远传 options + 回调,避开 ws.send 的重载歧义
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

    // 先告诉前端 sampleRate / encoding，让前端准备好 PCMPlayer
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

    // 客户端断开时立刻停掉火山引擎连接，省钱
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
