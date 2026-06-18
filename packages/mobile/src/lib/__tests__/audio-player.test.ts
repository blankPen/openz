/**
 * PCMPlayer（react-native-audio-api 适配）测试
 *
 * 行为契约:
 * - enqueue 把 Int16 / Uint8 字节转成 Float32 [-1, 1],创建 AudioBuffer 并 enqueue 到 source node
 * - flushTime 累积器每 100ms 触发一次 flush,把累积的 samples 喂给 source
 * - clear 清空 samples 队列
 * - close 释放 AudioContext
 * - onPlaybackEnd 字段存在(react-native-audio-api 的 AudioBufferQueueSourceNode
 *   没有 onended 事件,故 RN 端仅暴露字段,具体回调时机交给 hook 层用 isPlaying 状态判定)
 */

jest.mock('react-native-audio-api', () => {
  const enqueueBufferSpy = jest.fn();
  const clearBuffersSpy = jest.fn();
  const startSpy = jest.fn();
  const stopSpy = jest.fn();
  const closeSpy = jest.fn(() => Promise.resolve(true));
  const resumeSpy = jest.fn(() => Promise.resolve(true));
  const sourceConnectSpy = jest.fn();
  const createBufferQueueSourceSpy = jest.fn(() => ({
    enqueueBuffer: enqueueBufferSpy,
    clearBuffers: clearBuffersSpy,
    start: startSpy,
    stop: stopSpy,
    connect: sourceConnectSpy,
  }));
  const createBufferSpy = jest.fn(
    (numOfChannels: number, length: number, sampleRate: number) => {
      const channels: Float32Array[] = [];
      for (let c = 0; c < numOfChannels; c++) {
        channels.push(new Float32Array(length));
      }
      return {
        length,
        duration: length / sampleRate,
        sampleRate,
        numberOfChannels: numOfChannels,
        getChannelData: (ch: number) => channels[ch],
        _store: channels,
      };
    }
  );
  const createGainSpy = jest.fn(() => ({
    gain: { value: 1 },
    connect: jest.fn(),
  }));

  const AudioContextMock = jest.fn().mockImplementation(() => ({
    sampleRate: 24000,
    currentTime: 0,
    state: 'running',
    createBufferQueueSource: createBufferQueueSourceSpy,
    createBuffer: createBufferSpy,
    createGain: createGainSpy,
    close: closeSpy,
    resume: resumeSpy,
  }));

  return {
    __esModule: true,
    AudioContext: AudioContextMock,
    __spies__: {
      AudioContext: AudioContextMock,
      createBufferQueueSource: createBufferQueueSourceSpy,
      createBuffer: createBufferSpy,
      createGain: createGainSpy,
      sourceConnect: sourceConnectSpy,
      enqueueBuffer: enqueueBufferSpy,
      clearBuffers: clearBuffersSpy,
      start: startSpy,
      stop: stopSpy,
      close: closeSpy,
      resume: resumeSpy,
    },
  };
});

import { PCMPlayer } from '../audio-player';
import * as AudioApi from 'react-native-audio-api';

const spies = (AudioApi as unknown as { __spies__: Record<string, jest.Mock> })
  .__spies__;

describe('PCMPlayer (RN 适配)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('构造', () => {
    test('默认 sampleRate=24000, channels=1,创建 AudioContext 和 source', () => {
      const player = new PCMPlayer();
      expect(spies.AudioContext).toHaveBeenCalledWith({ sampleRate: 24000 });
      expect(spies.createBufferQueueSource).toHaveBeenCalledTimes(1);
      expect(spies.start).toHaveBeenCalled();
      player.close();
    });

    test('支持自定义 sampleRate 和 channels', () => {
      const player = new PCMPlayer({ sampleRate: 16000, channels: 2 });
      expect(spies.AudioContext).toHaveBeenCalledWith({ sampleRate: 16000 });
      player.close();
    });

    test('source node 通过 gain 连接到 destination', () => {
      const player = new PCMPlayer();
      const gain = spies.createGain.mock.results[0].value;
      expect(gain.connect).toHaveBeenCalled();
      expect(spies.sourceConnect).toHaveBeenCalledWith(gain);
      player.close();
    });
  });

  describe('Int16 → Float32 转换', () => {
    test('0 → 0', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([0]));
      player.flush();
      expect(spies.createBuffer).toHaveBeenCalledWith(1, 1, 24000);
      const bufferObj = spies.createBuffer.mock.results[0].value;
      const data = bufferObj.getChannelData(0);
      expect(data[0]).toBeCloseTo(0, 5);
      player.close();
    });

    test('32767 → 约 0.99996948 (Float32 精度)', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([32767]));
      player.flush();
      const bufferObj = spies.createBuffer.mock.results[0].value;
      const data = bufferObj.getChannelData(0);
      expect(data.length).toBe(1);
      expect(data[0]).toBeCloseTo(32767 / 32768, 5);
      player.close();
    });

    test('-32768 → -1', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([-32768]));
      player.flush();
      const bufferObj = spies.createBuffer.mock.results[0].value;
      const data = bufferObj.getChannelData(0);
      expect(data[0]).toBeCloseTo(-1, 5);
      player.close();
    });

    test('Uint8 字节输入同样工作(每 2 字节 = 1 个 Int16,小端)', () => {
      const player = new PCMPlayer();
      // Int16 [0, 32767] 的小端字节
      const bytes = new Uint8Array([0x00, 0x00, 0xff, 0x7f]);
      player.enqueue(bytes);
      player.flush();
      const bufferObj = spies.createBuffer.mock.results[0].value;
      const data = bufferObj.getChannelData(0);
      expect(data.length).toBe(2);
      expect(data[0]).toBeCloseTo(0, 5);
      expect(data[1]).toBeCloseTo(32767 / 32768, 5);
      player.close();
    });

    test('enqueue 后把 AudioBuffer 喂给 source node', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([0, 0, 0, 0]));
      player.flush();
      expect(spies.enqueueBuffer).toHaveBeenCalledTimes(1);
      player.close();
    });
  });

  describe('flushTime 累积器', () => {
    test('enqueue 不立即 flush,flush 只在显式调用或定时器触发时执行', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([100, 200, 300, 400]));
      expect(spies.enqueueBuffer).not.toHaveBeenCalled();
      player.close();
    });

    test('flush 把累积的 samples 转成 AudioBuffer 并 enqueue 到 source', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([100, 200, 300, 400]));
      player.flush();
      expect(spies.createBuffer).toHaveBeenCalledWith(1, 4, 24000);
      expect(spies.enqueueBuffer).toHaveBeenCalledTimes(1);
      player.close();
    });

    test('空 samples 时 flush 是 no-op', () => {
      const player = new PCMPlayer();
      player.flush();
      expect(spies.createBuffer).not.toHaveBeenCalled();
      expect(spies.enqueueBuffer).not.toHaveBeenCalled();
      player.close();
    });

    test('多声道 channels=2 写入立体声数据', () => {
      const player = new PCMPlayer({ sampleRate: 24000, channels: 2 });
      player.enqueue(new Int16Array([100, -100, 200, -200]));
      player.flush();
      expect(spies.createBuffer).toHaveBeenCalledWith(2, 2, 24000);
      const bufferObj = spies.createBuffer.mock.results[0].value;
      const left = bufferObj.getChannelData(0);
      const right = bufferObj.getChannelData(1);
      expect(left.length).toBe(2);
      expect(right.length).toBe(2);
      expect(left[0]).toBeCloseTo(100 / 32768, 5);
      expect(right[0]).toBeCloseTo(-100 / 32768, 5);
      player.close();
    });

    test('flushTime=100:累积时间到 100ms 时自动 flush', () => {
      jest.useFakeTimers();
      const player = new PCMPlayer();
      // sampleRate=24000, 100ms = 2400 samples
      const samples = new Int16Array(2400);
      player.enqueue(samples);
      expect(spies.enqueueBuffer).not.toHaveBeenCalled();
      jest.advanceTimersByTime(100);
      expect(spies.enqueueBuffer).toHaveBeenCalledTimes(1);
      player.close();
      jest.useRealTimers();
    });

    test('flushTime 内累积 < 100ms 不触发 flush', () => {
      jest.useFakeTimers();
      const player = new PCMPlayer();
      // 50ms = 1200 samples
      const samples = new Int16Array(1200);
      player.enqueue(samples);
      jest.advanceTimersByTime(100);
      // 累积仅 50ms,未达 100ms 阈值 → 不 flush
      expect(spies.enqueueBuffer).not.toHaveBeenCalled();
      player.close();
      jest.useRealTimers();
    });
  });

  describe('clear / close', () => {
    test('clear 清空 samples 队列', () => {
      const player = new PCMPlayer();
      player.enqueue(new Int16Array([1, 2, 3, 4]));
      player.clear();
      player.flush();
      // 队列已清空,flush 不应触发
      expect(spies.createBuffer).not.toHaveBeenCalled();
      player.close();
    });

    test('clear 调用 source.clearBuffers', () => {
      const player = new PCMPlayer();
      player.clear();
      expect(spies.clearBuffers).toHaveBeenCalled();
      player.close();
    });

    test('close 释放 AudioContext 并停止定时器', () => {
      jest.useFakeTimers();
      const player = new PCMPlayer();
      player.close();
      expect(spies.close).toHaveBeenCalled();
      // close 后再 enqueue 不会触发定时器
      player.enqueue(new Int16Array([1]));
      jest.advanceTimersByTime(200);
      expect(spies.enqueueBuffer).not.toHaveBeenCalled();
      jest.useRealTimers();
    });
  });

  describe('onPlaybackEnd 回调字段', () => {
    test('onPlaybackEnd 是公开可写字段', () => {
      const onEnd = jest.fn();
      const player = new PCMPlayer();
      player.onPlaybackEnd = onEnd;
      expect(player.onPlaybackEnd).toBe(onEnd);
      player.close();
    });
  });
});
