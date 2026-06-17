import type { PCMPlayerOptions } from './types.js'

/**
 * 浏览器端 PCM 实时播放器。
 *
 * 把 Int16/Int8/Int32/Float32 的 PCM 字节流喂入 `feed()`,内部按
 * `flushTime` 间隔把累积的样本写入 `AudioBuffer` 并通过
 * `AudioBufferSourceNode` 顺序播放,实现「边收边播」。
 */
interface PCMPlayerInternalOptions {
  inputCodec: 'Int8' | 'Int16' | 'Int32' | 'Float32'
  channels: number
  sampleRate: number
  flushTime: number
  fftSize: number
  volume: number
  onended?: PCMPlayerOptions['onended']
  onstatechange?: PCMPlayerOptions['onstatechange']
}

export class PCMPlayer {
  private option!: PCMPlayerInternalOptions
  private samples: Float32Array = new Float32Array()
  private interval: ReturnType<typeof setInterval> | null = null
  private convertValue = 0
  private typedArray: typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Float32Array = Int16Array
  audioCtx!: AudioContext
  private gainNode!: GainNode
  private analyserNode!: AnalyserNode
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
    }

    this.interval = setInterval(
      () => this.flush(),
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
        '输入编解码错误,请传入以下之一:Int8、Int16、Int32、Float32',
      )
    }
    return inputCodecs[this.option.inputCodec]
  }

  private getTypedArray(): typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Float32Array {
    const typedArrays: Record<string, typeof Int8Array | typeof Int16Array | typeof Int32Array | typeof Float32Array> = {
      Int8: Int8Array,
      Int16: Int16Array,
      Int32: Int32Array,
      Float32: Float32Array,
    }
    if (!typedArrays[this.option.inputCodec]) {
      throw new Error(
        '输入编解码错误,请传入以下之一:Int8、Int16、Int32、Float32',
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
      throw new Error('请传入 ArrayBuffer 或任意 TypedArray')
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
      // Uint8Array 可能是其他 ArrayBuffer 的 view,拷贝到新 ArrayBuffer 避免 SharedArrayBuffer 类型问题
      const copy = new ArrayBuffer(data.byteLength)
      new Uint8Array(copy).set(data)
      view = new this.typedArray(copy)
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
    this.startTime = null
    if (this.audioCtx && this.audioCtx.state !== 'closed') {
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
      bufferSource.onended = (event: Event) => {
        if (self.option.onended) {
          self.option.onended(bufferSource, event)
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
      this.audioCtx.onstatechange = (event: Event) => {
        if (self.audioCtx && self.option.onstatechange) {
          self.option.onstatechange(self.audioCtx, event, self.audioCtx.state)
        }
      }
    }
  }
}
