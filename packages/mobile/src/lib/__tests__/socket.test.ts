// 测试 src/lib/socket.ts —— Socket.IO 单例工厂

const mockEmit = jest.fn();
const mockOn = jest.fn();
const mockOff = jest.fn();
const mockDisconnect = jest.fn();
const mockConnect = jest.fn();
const mockRemoveAllListeners = jest.fn();

function createFakeSocket() {
  return {
    emit: mockEmit,
    on: mockOn,
    off: mockOff,
    disconnect: mockDisconnect,
    connect: mockConnect,
    removeAllListeners: mockRemoveAllListeners,
    id: `fake-${Math.random().toString(36).slice(2, 8)}`,
    connected: false,
  };
}

const mockIoFactory = jest.fn(() => createFakeSocket());

jest.mock('socket.io-client', () => ({
  io: (...args: unknown[]) => (mockIoFactory as any)(...args),
}));

const mockSettingsGetState = jest.fn(() => ({ serverUrl: '' }));
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => mockSettingsGetState(),
  },
}));

// 测试用：直接重置 socket 模块的内部缓存
// 由于 socket 模块没有暴露 _resetCache，我们在 disconnectAll 后清空所有 mock 计数
// 这样每个测试自己负责清理

import { getSocket, disconnectAll, DEFAULT_SOCKET_OPTIONS } from '../socket';

describe('socket 单例', () => {
  beforeEach(() => {
    // 每个测试先 disconnect 清掉之前测试遗留的缓存（仅在第一次会真正断开；后续缓存空就 noop）
    disconnectAll();
    mockIoFactory.mockClear();
    mockEmit.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockDisconnect.mockClear();
    mockConnect.mockClear();
    mockRemoveAllListeners.mockClear();
    mockSettingsGetState.mockReset();
    mockSettingsGetState.mockReturnValue({ serverUrl: '' });
  });

  it('同一 serverUrl 两次调用返回同一实例', () => {
    const a = getSocket('http://localhost:19998');
    const b = getSocket('http://localhost:19998');
    expect(a).toBe(b);
    expect(mockIoFactory).toHaveBeenCalledTimes(1);
  });

  it('不同 serverUrl 返回不同实例', () => {
    const a = getSocket('http://localhost:19998');
    const b = getSocket('http://localhost:19999');
    expect(a).not.toBe(b);
    expect(mockIoFactory).toHaveBeenCalledTimes(2);
  });

  it('disconnectAll 断开所有实例并清空缓存', () => {
    getSocket('http://localhost:19998');
    getSocket('http://localhost:19999');
    expect(mockIoFactory).toHaveBeenCalledTimes(2);
    // 此时缓存中有 2 个 socket。断开应该调用 2 次 disconnect。
    mockDisconnect.mockClear(); // 清掉之前可能的影响
    disconnectAll();
    expect(mockDisconnect).toHaveBeenCalledTimes(2);
    // 重新调用应建立新实例
    const a2 = getSocket('http://localhost:19998');
    expect(a2).toBeDefined();
    expect(mockIoFactory).toHaveBeenCalledTimes(3);
  });

  it('未传入 serverUrl 时从 settingsStore 读取', () => {
    mockSettingsGetState.mockReturnValue({ serverUrl: 'http://settings-host:1234' });
    const socket = getSocket();
    expect(mockIoFactory).toHaveBeenLastCalledWith(
      'http://settings-host:1234',
      expect.objectContaining({ transports: ['websocket'] }),
    );
    expect(socket).toBeDefined();
  });

  it('传入自定义配置会合并默认配置', () => {
    getSocket('http://localhost:19998', { reconnectionDelay: 500 } as any);
    const args = mockIoFactory.mock.calls[mockIoFactory.mock.calls.length - 1] as unknown[];
    expect(args[0]).toBe('http://localhost:19998');
    expect(args[1]).toEqual(
      expect.objectContaining({
        reconnection: true,
        reconnectionDelay: 500,
        reconnectionDelayMax: 5000,
        transports: ['websocket'],
      }),
    );
  });

  it('导出默认配置常量', () => {
    expect(DEFAULT_SOCKET_OPTIONS).toEqual({
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      transports: ['websocket'],
    });
  });
});
