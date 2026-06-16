import * as http from 'http'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { WebSocketServer, WebSocket as WsSocket } from 'ws'
import {
  bidirectionTtsStream,
  DEFAULT_SAMPLE_RATE,
  type RunOptions,
} from '@openz/speech/server'
import { chunkedTextStream, type ChunkOptions } from './chunked-text.js'
import 'dotenv/config'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
  fs.readFile(filePath, (err: NodeJS.ErrnoException | null, data) => {
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

  // SDK 客户端 ESM 静态资源:把 dist/client/ 整个目录暴露在 /static/ 下
  if (req.method === 'GET' && url.startsWith('/static/')) {
    let rel = url.slice('/static/'.length).split('?')[0]
    // 防止路径穿越
    if (rel.includes('..') || rel.startsWith('/')) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    // 兼容旧的 /static/sdk-client.esm.js 路径,映射到 dist/client/index.js
    if (rel === 'sdk-client.esm.js') {
      rel = 'index.js'
    }
    const sdkPath = path.resolve(
      __dirname,
      '..',
      '..',
      'dist',
      'client',
      rel,
    )
    // 限制只暴露 dist/client/ 下的 .js 文件
    if (!sdkPath.endsWith('.js') || !sdkPath.startsWith(path.resolve(__dirname, '..', '..', 'dist', 'client'))) {
      sendJson(res, 404, { error: 'not found' })
      return
    }
    serveStaticFile(res, sdkPath, 'application/javascript; charset=utf-8')
    return
  }

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
    stream.on('error', (err: Error) => {
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
        console.log(
          `[ws-tts] chunk #${index} at=${at}ms "${chunkText.slice(0, 20)}"`,
        )
        safeSend(JSON.stringify({ type: 'chunk', index, text: chunkText, at }))
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
      safeSend(JSON.stringify({ type: 'end', totalFrames, totalBytes }))
      console.log(
        `[ws-tts] end: totalFrames=${totalFrames} totalBytes=${totalBytes}`,
      )
    })
    stream.on('error', (err: Error) => {
      safeSend(JSON.stringify({ type: 'error', error: err.message }))
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
