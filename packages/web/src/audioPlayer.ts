/**
 * Standalone PCM audio player for use outside React components.
 * Based on the volcengine bidirection demo PCMPlayer.
 */

export class AudioPlayer {
  private audioCtx: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private samples: Float32Array = new Float32Array();
  private interval: ReturnType<typeof setInterval> | null = null;
  private startTime = 0;
  private sampleRate = 24000;
  private channels = 1;
  private convertValue = 32768;
  private flushing = false;
  private typedArray = Int16Array;

  constructor() {
    this.audioCtx = new AudioContext();
    this.gainNode = this.audioCtx.createGain();
    this.analyserNode = this.audioCtx.createAnalyser();
    this.analyserNode.fftSize = 2048;
    this.gainNode.connect(this.analyserNode);
    this.gainNode.connect(this.audioCtx.destination);
    this.interval = setInterval(() => this.flush(), 200);
  }

  feed(data: ArrayBuffer | Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array) {
    const formatted = this.getFormattedValue(data);
    const tmp = new Float32Array(this.samples.length + formatted.length);
    tmp.set(this.samples, 0);
    tmp.set(formatted, this.samples.length);
    this.samples = tmp;
  }

  private getFormattedValue(
    data: ArrayBuffer | Uint8Array | Int8Array | Int16Array | Int32Array | Float32Array,
  ): Float32Array {
    let view: TypedArray;
    if (data instanceof ArrayBuffer) {
      view = new this.typedArray(data);
    } else {
      view = new this.typedArray(data.buffer);
    }
    const float32 = new Float32Array(view.length);
    for (let i = 0; i < view.length; i++) {
      float32[i] = view[i] / this.convertValue;
    }
    return float32;
  }

  resume() {
    if (this.audioCtx?.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  stop() {
    this.samples = new Float32Array();
  }

  destroy() {
    if (this.interval) clearInterval(this.interval);
    this.interval = null;
    this.samples = new Float32Array();
    if (this.audioCtx) {
      this.audioCtx.close();
      this.audioCtx = null;
    }
  }

  private flush() {
    if (!this.samples.length || this.flushing) return;
    this.flushing = true;
    const bufferSource = this.audioCtx.createBufferSource();
    const length = this.samples.length / this.channels;
    const audioBuffer = this.audioCtx.createBuffer(
      this.channels,
      length,
      this.sampleRate,
    );

    for (let ch = 0; ch < this.channels; ch++) {
      const audioData = audioBuffer.getChannelData(ch);
      let offset = ch;
      let decrement = 50;
      for (let i = 0; i < length; i++) {
        audioData[i] = this.samples[offset];
        if (i < 50) {
          audioData[i] = (audioData[i] * i) / 50;
        }
        if (i >= length - 51) {
          audioData[i] = (audioData[i] * decrement--) / 50;
        }
        offset += this.channels;
      }
    }

    bufferSource.buffer = audioBuffer;
    bufferSource.connect(this.gainNode);
    bufferSource.start(this.startTime ?? 0);
    this.startTime =
      (this.startTime ?? this.audioCtx.currentTime) + audioBuffer.duration;
    this.samples = new Float32Array();
    this.flushing = false;
  }
}

export const audioPlayer = new AudioPlayer();
