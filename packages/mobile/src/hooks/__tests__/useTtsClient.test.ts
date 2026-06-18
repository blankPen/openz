/**
 * useTtsClient —— TTS 客户端 hook 测试
 *
 * 行为契约:
 * - useTtsClient() 返回 { speak, stop, isPlaying }
 * - speak(sessionId, message) → emit tts:start (ack 失败走 toast)
 * - 收到 tts:audio (binary Buffer) → 喂给 PCMPlayer
 * - 收到 tts:event { type: 'end' | 'error' } → 停(isPlaying=false)
 * - settingsStore.ttsAutoPlay=false 时 speak 立即返回不发请求
 * - stop() 立即清空 PCMPlayer + off tts 订阅
 * - onText 回调:speak 被调用时立即触发(让 UI 也能渲染文字)
 */

const mockEmit = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();
const mockDisconnect = jest.fn();
const mockRemoveAllListeners = jest.fn();
const mockAckCallback: ((...args: unknown[]) => void)[] = [];

function createFakeSocket() {
  return {
    emit: (event: string, ...args: unknown[]) => {
      mockEmit(event, ...args);
      // 给 ack 调用机会(speak 通常 emit tts:start 后传 ack cb)
      const ack = args[args.length - 1];
      if (typeof ack === 'function') {
        mockAckCallback.push(ack as (...a: unknown[]) => void);
      }
    },
    on: mockOn,
    off: mockOff,
    disconnect: mockDisconnect,
    removeAllListeners: mockRemoveAllListeners,
    id: `fake-${Math.random().toString(36).slice(2, 8)}`,
    connected: true,
  };
}

const mockIoFactory = jest.fn((..._args: unknown[]) => createFakeSocket());

// mock react-native-audio-api —— useTtsClient 通过 PCMPlayer 用到,
jest.mock('react-native-audio-api', () => ({
  AudioContext: jest.fn(),
  AudioBuffer: jest.fn(),
  AudioBufferQueueSourceNode: jest.fn(),
  __esModule: true,
}));

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => mockIoFactory(...args),
}));

// 默认可控:serverUrl + ttsAutoPlay
const mockSettingsGetState = jest.fn(() => ({
  serverUrl: 'http://localhost:19998',
  ttsAutoPlay: true,
}));

jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => mockSettingsGetState(),
  },
}));

// PCMPlayer mock —— 必须是 class 才能被 new
// 变量必须以 mock 开头(Jest hoisting 限制)
const mockEnqueue = jest.fn();
const mockClear = jest.fn();
const mockClose = jest.fn();
const mockFlush = jest.fn();
const mockPcmPlayerImpl = jest.fn().mockImplementation(() => ({
  enqueue: mockEnqueue,
  clear: mockClear,
  close: mockClose,
  flush: mockFlush,
}));
// 让 jest.fn() 支持 new 调用:用 function 包装
function mockPcmPlayer() {
  return mockPcmPlayerImpl();
}
// new mockPcmPlayer() 实际应返回 mockPcmPlayerImpl()
mockPcmPlayer.prototype = mockPcmPlayerImpl.prototype;

jest.mock('../../lib/audio-player', () => ({
  PCMPlayer: mockPcmPlayer,
}));

import { renderHook, act } from '@testing-library/react-native';
import { getSocket } from '../../lib/socket';
import { useTtsClient } from '../useTtsClient';

describe('useTtsClient', () => {
  beforeEach(() => {
    mockEmit.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockDisconnect.mockClear();
    mockRemoveAllListeners.mockClear();
    mockIoFactory.mockClear();
    mockEnqueue.mockClear();
    mockClear.mockClear();
    mockClose.mockClear();
    mockFlush.mockClear();
    /* mockPcmPlayer 是 class,不需要 mockClear */
    mockAckCallback.length = 0;
    mockSettingsGetState.mockReset();
    mockSettingsGetState.mockReturnValue({
      serverUrl: 'http://localhost:19998',
      ttsAutoPlay: true,
    });
  });

  it('初始 isPlaying=false', () => {
    const { result } = renderHook(() => useTtsClient());
    expect(result.current.isPlaying).toBe(false);
    expect(typeof result.current.speak).toBe('function');
    expect(typeof result.current.stop).toBe('function');
  });

  it('speak → emit tts:start 并触发 onText 回调', () => {
    const onText = jest.fn();
    const { result } = renderHook(() => useTtsClient({ onText }));

    act(() => {
      result.current.speak('session-1', '你好世界');
    });

    // emit 被调用,事件名是 tts:start
    const ttsStartCalls = mockEmit.mock.calls.filter((c) => c[0] === 'tts:start');
    expect(ttsStartCalls.length).toBe(1);
    const payload = ttsStartCalls[0][1] as Record<string, unknown>;
    expect(payload).toMatchObject({
      sessionId: 'session-1',
      message: '你好世界',
    });

    // onText 立即同步触发
    expect(onText).toHaveBeenCalledWith('session-1', '你好世界');
    // isPlaying 立即变 true
    expect(result.current.isPlaying).toBe(true);
  });

  it('speak 时把 tts:audio 帧喂给 PCMPlayer', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hello');
    });

    // 模拟服务器推送 tts:audio 二进制帧
    const audioHandler = mockOn.mock.calls.find((c) => c[0] === 'tts:audio')?.[1];
    expect(audioHandler).toBeDefined();
    const fakeAudio = new Uint8Array([1, 2, 3, 4]);
    act(() => {
      (audioHandler as (buf: Uint8Array) => void)(fakeAudio);
    });
    expect(mockEnqueue).toHaveBeenCalledWith(fakeAudio);
  });

  it('speak 时把 tts:event end 转成 isPlaying=false', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });
    expect(result.current.isPlaying).toBe(true);

    const endHandler = mockOn.mock.calls.find((c) => c[0] === 'tts:event')?.[1];
    expect(endHandler).toBeDefined();
    act(() => {
      (endHandler as (ev: { type: string }) => void)({ type: 'end' });
    });
    expect(result.current.isPlaying).toBe(false);
  });

  it('speak 时把 tts:event error 转成 isPlaying=false + toast', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });
    const evtHandler = mockOn.mock.calls.find((c) => c[0] === 'tts:event')?.[1];
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      (evtHandler as (ev: { type: string; error?: string }) => void)({
        type: 'error',
        error: 'synth failed',
      });
    });
    expect(result.current.isPlaying).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('ttsAutoPlay=false 时 speak 立即返回,不发请求、不播', () => {
    mockSettingsGetState.mockReturnValue({
      serverUrl: 'http://localhost:19998',
      ttsAutoPlay: false,
    });
    const onText = jest.fn();
    const { result } = renderHook(() => useTtsClient({ onText }));
    act(() => {
      result.current.speak('s1', 'hi');
    });
    // 没 emit
    expect(mockEmit).not.toHaveBeenCalled();
    // isPlaying 不变
    expect(result.current.isPlaying).toBe(false);
    // onText 仍触发(让 UI 渲染)
    expect(onText).toHaveBeenCalledWith('s1', 'hi');
  });

  it('stop 清空 PCMPlayer + 取消 tts 订阅', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });
    expect(result.current.isPlaying).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(mockClear).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    // off 收到 tts:audio / tts:event
    const offEventNames = mockOff.mock.calls.map((c) => c[0]);
    expect(offEventNames).toContain('tts:audio');
    expect(offEventNames).toContain('tts:event');
  });

  it('ack 失败时走 toast 提示', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });

    // 取出 tts:start 的 ack cb
    const ttsStartCalls = mockEmit.mock.calls.filter((c) => c[0] === 'tts:start');
    expect(ttsStartCalls.length).toBe(1);
    // emit 的最后一个参数是 ack function
    const args = ttsStartCalls[0];
    const ack = args[args.length - 1] as (resp: unknown) => void;
    expect(typeof ack).toBe('function');

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    act(() => {
      ack({ ok: false, error: 'session gone' });
    });
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(result.current.isPlaying).toBe(false);
    consoleErrorSpy.mockRestore();
  });

  it('ack 成功时收到 first_frame 事件,player 已就绪可继续 enqueue', () => {
    const { result } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });
    const ttsStartCalls = mockEmit.mock.calls.filter((c) => c[0] === 'tts:start');
    const ack = ttsStartCalls[0][ttsStartCalls[0].length - 1] as (
      resp: unknown
    ) => void;
    act(() => {
      ack({ ok: true });
    });
    // ack ok 不影响 isPlaying
    expect(result.current.isPlaying).toBe(true);

    // 模拟 tts:event first_frame —— 应不改变 isPlaying
    const evtHandler = mockOn.mock.calls.find((c) => c[0] === 'tts:event')?.[1];
    act(() => {
      (evtHandler as (ev: { type: string }) => void)({ type: 'first_frame' });
    });
    expect(result.current.isPlaying).toBe(true);
  });

  it('hook 卸载时关闭 PCMPlayer', () => {
    const { result, unmount } = renderHook(() => useTtsClient());
    act(() => {
      result.current.speak('s1', 'hi');
    });
    unmount();
    expect(mockClose).toHaveBeenCalled();
  });
});
