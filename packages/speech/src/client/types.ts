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
