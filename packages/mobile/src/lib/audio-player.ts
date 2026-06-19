/**
 * PCMPlayer —— react-native-audio-api 适配的 PCM 实时播放器。
 *
 * 算法照搬 web 端 packages/speech/src/client/pcm-player.ts:
 * 1. 把 Int16 (或 Uint8 字节序) 喂入的 PCM 帧累积到内部 Float32 队列
 * 2. 维护一个 flushTime 累积器(每帧 duration = samples / sampleRate),
 *    累积到 100ms 时自动调用 flush()
 * 3. flush() 把累积的 samples 写入新创建的 AudioBuffer,enqueue 到
 *    AudioBufferQueueSourceNode 实现「边收边播」
 *
 * 与 web 端差异:
 * - 不依赖浏览器 AudioContext,改用 react-native-audio-api 的 AudioContext
 * - AudioBufferQueueSourceNode 不暴露 onended 事件(参 d.ts),所以 onPlaybackEnd
 *   字段是 RN 端公开的回调字段,具体「播放结束」时机由 hook 层通过
 *   isPlaying 状态判定后调用
 */
import {
  AudioContext,
  AudioBuffer,
  AudioBufferQueueSourceNode,
} from 'react-native-audio-api';

/** 是否为 Web（浏览器标准 AudioContext，无 createBufferQueueSource） */
const IS_WEB = typeof window !== 'undefined' &&
  typeof window.AudioContext !== 'undefined' &&
  !('createBufferQueueSource' in window.AudioContext.prototype);

/** Int16 → Float32 [-1,1] 的归一化系数 */
const INT16_DIVISOR = 32768;

export interface PCMPlayerOptions {
  /** 采样率(Hz),默认 24000 —— 与火山 TTS 默认输出一致 */
  sampleRate?: number;
  /** 声道数,默认 1(单声道) */
  channels?: number;
  /**
   * 累积多少毫秒后自动 flush 到 source。
   * 默认 100ms,值越小延迟越低,但调度开销越高。
   */
  flushTime?: number;
}

export class PCMPlayer {
  private sampleRate: number;
  private channels: number;
  private flushTimeMs: number;
  /** 累积的 PCM 样本(归一化到 [-1, 1]) */
  private samples: Float32Array = new Float32Array();
  /** 当前累积的播放时长(秒) */
  private accumulatedDurationSec = 0;
  /** flush 定时器 */
  private interval: ReturnType<typeof setInterval> | null = null;
  private audioCtx: AudioContext;
  private gainNode: ReturnType<AudioContext['createGain']>;
  private source: AudioBufferQueueSourceNode;
  /** 已关闭标记,close 后所有操作降级为 no-op */
  private closed = false;
  /**
   * 播放结束回调字段。
   * RN 的 AudioBufferQueueSourceNode 没有 onended 事件,故仅暴露字段,
   * 由 hook 层在合适的时机(`tts:event` 收到 end / 用户调用 stop)调用。
   */
  public onPlaybackEnd?: () => void;

  constructor(options: PCMPlayerOptions = {}) {
    this.sampleRate = options.sampleRate ?? 24000;
    this.channels = options.channels ?? 1;
    this.flushTimeMs = options.flushTime ?? 100;

    if (IS_WEB) {
      // Web 环境：使用标准 AudioContext + AudioBufferSourceNode
      this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
      this.gainNode = this.audioCtx.createGain();
      this.gainNode.connect(this.audioCtx.destination);
      // Web 上无 createBufferQueueSource，使用空数组占位，play() 时创建一次性 source
      this.source = null as any;
      return;
    }

    // 创建 AudioContext(sampleRate 必须显式传入,RN 端无默认)
    this.audioCtx = new AudioContext({ sampleRate: this.sampleRate });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);

    // 队列式 source —— 支持 enqueueBuffer 流式喂数据
    this.source = this.audioCtx.createBufferQueueSource();
    this.source.connect(this.gainNode);
    this.source.start();

    // 启动 flush 定时器(仅当累积时间达阈值时才实际 flush)
    this.interval = setInterval(() => this.tick(), this.flushTimeMs);
  }

  /**
   * 把 Int16 字节流(或 Int16Array)喂入播放器。
   * 内部会做 Int16 → Float32 归一化,再累加到 samples 队列。
   */
  enqueue(pcm: Int16Array | Uint8Array): void {
    if (this.closed) return;
    const int16 = this.toInt16(pcm);
    if (int16.length === 0) return;

    const float = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float[i] = int16[i] / INT16_DIVISOR;
    }

    // 追加到累积队列
    const merged = new Float32Array(this.samples.length + float.length);
    merged.set(this.samples, 0);
    merged.set(float, this.samples.length);
    this.samples = merged;

    // 累积时长(按帧计,channels 已分摊到 float 长度里)
    this.accumulatedDurationSec += int16.length / this.channels / this.sampleRate;
  }

  /**
   * 定时器回调:只在累积时长达到 flushTimeMs 时才 flush。
   * 避免累积 < 100ms 时被空 flush 浪费调度。
   */
  private tick(): void {
    if (this.closed) return;
    if (this.accumulatedDurationSec * 1000 >= this.flushTimeMs) {
      this.flush();
    }
  }

  /**
   * 把累积的 samples 转成 AudioBuffer 并 enqueue 到 source（RN）或直接播放（Web）。
   * 空队列时是 no-op。
   * 显式调用可用于测试 / 立即刷出缓冲。
   */
  flush(): void {
    if (this.closed) return;
    if (this.samples.length === 0) return;

    const length = this.samples.length / this.channels;
    const audioBuffer: AudioBuffer = this.audioCtx.createBuffer(
      this.channels,
      length,
      this.sampleRate
    );

    // 把交错样本(Interleaved)按声道拆分
    for (let channel = 0; channel < this.channels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      let offset = channel;
      for (let i = 0; i < length; i++) {
        channelData[i] = this.samples[offset];
        offset += this.channels;
      }
    }

    if (IS_WEB) {
      // Web：创建一次性 AudioBufferSourceNode 播放
      const source = this.audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);
      source.start();
    } else {
      this.source.enqueueBuffer(audioBuffer);
    }

    // 重置累积器
    this.samples = new Float32Array();
    this.accumulatedDurationSec = 0;
  }

  /**
   * 清空内部状态但不关 AudioContext。
   * 用于 AppState background / 新一轮 TTS 开始时丢弃上一轮残留。
   * - 清空 samples 队列
   * - 清空 source 内未播放的 buffer
   */
  clear(): void {
    if (this.closed) return;
    this.samples = new Float32Array();
    this.accumulatedDurationSec = 0;
    if (IS_WEB || !this.source) return;
    try {
      this.source.clearBuffers();
    } catch {
      // 源可能尚未 start,忽略
    }
  }

  /**
   * 释放资源:清队列 + 停止 source + 关闭 AudioContext + 清定时器。
   * 之后所有方法都是 no-op。
   */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.samples = new Float32Array();
    if (!IS_WEB && this.source) {
      try {
        this.source.clearBuffers();
        this.source.stop();
      } catch {
        // 忽略
      }
    }
    void this.audioCtx.close().catch(() => {
      // RN 端 close() 一般立即 resolve,但写防御
    });
  }

  /**
   * 把 Uint8 字节缓冲(小端)转成 Int16Array。
   * 已经是 Int16Array 的直接返回。
   * 奇数字节尾部截断。
   */
  private toInt16(pcm: Int16Array | Uint8Array): Int16Array {
    if (pcm instanceof Int16Array) return pcm;
    const u8 = pcm as Uint8Array;
    const length = u8.byteLength - (u8.byteLength % 2);
    // 复制到独立的 ArrayBuffer,避免外部 Uint8Array 被 SharedArrayBuffer 持有
    const buffer = new ArrayBuffer(length);
    new Uint8Array(buffer).set(u8.subarray(0, length));
    return new Int16Array(buffer);
  }
}
