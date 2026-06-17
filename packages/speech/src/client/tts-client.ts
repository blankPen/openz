import type {
  TtsClientOptions,
  TtsClientState,
  SessionStartInfo,
  ChunkInfo,
  EndInfo,
} from './types.js'

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
    if (
      this._state === 'connecting' ||
      this._state === 'open' ||
      this._state === 'streaming'
    ) {
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
        this._state = 'streaming'
        this.opts.onAudioFrame?.(e.data)
        return
      }

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
