// 测试 src/hooks/useSocket.ts —— 通用 socket 订阅 hook + 连接状态 + 心跳

const mockEmit = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();
const mockDisconnect = jest.fn();
const mockRemoveAllListeners = jest.fn();

function createFakeSocket() {
  return {
    emit: mockEmit,
    on: mockOn,
    off: mockOff,
    disconnect: mockDisconnect,
    removeAllListeners: mockRemoveAllListeners,
    id: `fake-${Math.random().toString(36).slice(2, 8)}`,
    connected: false,
  };
}

const mockIoFactory = jest.fn(() => createFakeSocket());

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => (mockIoFactory as any)(...args),
}));

const mockSettingsGetState = jest.fn(() => ({ serverUrl: 'http://localhost:19998' }));
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => mockSettingsGetState(),
  },
}));

// 不再 mock connectionStore，使用真实 store；通过 setState 直接驱动。

import { renderHook, act } from '@testing-library/react-native';
import { getSocket, disconnectAll } from '../../lib/socket';
import { useConnectionStore } from '../../stores/connectionStore';

describe('useSocket 通用订阅', () => {
  beforeEach(() => {
    disconnectAll();
    mockEmit.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockDisconnect.mockClear();
    mockRemoveAllListeners.mockClear();
    mockIoFactory.mockClear();
    mockSettingsGetState.mockReset();
    mockSettingsGetState.mockReturnValue({ serverUrl: 'http://localhost:19998' });
    // 重置 connectionStore
    useConnectionStore.setState({ status: 'disconnected', failCount: 0, lastError: null });
  });

  it('useSocket 订阅事件，handler 被 socket.on 注册', () => {
    const { useSocket } = require('../useSocket');
    renderHook(() => useSocket('session:event', jest.fn()));
    // socket.on 至少被调用一次（'session:event'）
    const events = mockOn.mock.calls.map((c) => c[0]);
    expect(events).toContain('session:event');
  });

  it('useSocket 卸载时取消订阅（socket.off）', () => {
    const { useSocket } = require('../useSocket');
    const { unmount } = renderHook(() => useSocket('foo', jest.fn()));
    unmount();
    const offEventNames = mockOff.mock.calls.map((c) => c[0]);
    expect(offEventNames).toContain('foo');
  });

  it('deps 变化时重新订阅', () => {
    const { useSocket } = require('../useSocket');
    let dep = 'a';
    const { rerender } = renderHook(({ d }) => useSocket('evt', jest.fn(), [d]), {
      initialProps: { d: 'a' },
    });
    rerender({ d: 'b' });
    expect(mockOn.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(mockOff.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('_setupSocketConnection：connect 事件触发 markConnected', () => {
    const { _setupSocketConnection } = require('../useSocket');
    const socket = getSocket('http://localhost:19998');
    _setupSocketConnection(socket);
    const connectHandler = mockOn.mock.calls.find((c) => c[0] === 'connect')?.[1];
    expect(connectHandler).toBeDefined();
    act(() => {
      connectHandler();
    });
    expect(useConnectionStore.getState().status).toBe('connected');
  });
});

describe('useConnectionStatus', () => {
  beforeEach(() => {
    useConnectionStore.setState({ status: 'disconnected', failCount: 0, lastError: null });
  });

  it('从 connectionStore 返回 status/failCount/lastError', () => {
    const { useConnectionStatus } = require('../useSocket');
    useConnectionStore.setState({ status: 'connecting', failCount: 2, lastError: 'timeout' });
    const { result } = renderHook(() => useConnectionStatus());
    expect(result.current.status).toBe('connecting');
    expect(result.current.failCount).toBe(2);
    expect(result.current.lastError).toBe('timeout');
  });
});

describe('useClientPing 心跳', () => {
  beforeEach(() => {
    disconnectAll();
    mockEmit.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockIoFactory.mockClear();
    mockSettingsGetState.mockReset();
    mockSettingsGetState.mockReturnValue({ serverUrl: 'http://localhost:19998' });
    useConnectionStore.setState({ status: 'connected', failCount: 0, lastError: null });
  });

  it('按 intervalMs 周期发送 client:ping', () => {
    jest.useFakeTimers();
    const { useClientPing } = require('../useSocket');
    renderHook(() => useClientPing(1000));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    const pingCalls = mockEmit.mock.calls.filter((c) => c[0] === 'client:ping');
    expect(pingCalls.length).toBeGreaterThanOrEqual(1);
    jest.useRealTimers();
  });

  it('连续 3 次无响应触发 recordPingTimeout', () => {
    jest.useFakeTimers();
    const { useClientPing } = require('../useSocket');
    renderHook(() => useClientPing(1000));
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(useConnectionStore.getState().failCount).toBeGreaterThan(0);
    expect(useConnectionStore.getState().lastError).toBe('ping timeout');
    jest.useRealTimers();
  });
});
