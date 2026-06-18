// 测试 src/hooks/useSessionStream.ts —— SSE 流式订阅

const mockSettingsGetState = jest.fn(() => ({ serverUrl: 'http://localhost:3000' }));
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => mockSettingsGetState(),
  },
}));

type Pair = {
  stream: ReadableStream<Uint8Array>;
  enqueue: (chunk: string) => void;
  close: () => void;
};

function createReadableStreamPair(): Pair {
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;
    },
  });
  return {
    stream,
    enqueue: (chunk: string) => {
      if (controllerRef) controllerRef.enqueue(encoder.encode(chunk));
    },
    close: () => {
      if (controllerRef) controllerRef.close();
    },
  };
}

function createResponse(stream: ReadableStream<Uint8Array>): any {
  return {
    ok: true,
    status: 200,
    body: stream,
    text: async () => '',
    json: async () => ({}),
  };
}

beforeAll(() => {
  if (typeof (globalThis as any).ReadableStream === 'undefined') {
    (globalThis as any).ReadableStream = ReadableStream;
  }
});

import { renderHook, act } from '@testing-library/react-native';
import { useSessionStream } from '../useSessionStream';

const originalFetch = (globalThis as any).fetch;
let mockFetchImpl: jest.Mock;
let mockAbortControllers: { abort: jest.Mock; signal: AbortSignal }[] = [];
let lastPair: Pair | null = null;

describe('useSessionStream', () => {
  beforeEach(() => {
    mockSettingsGetState.mockReset();
    mockSettingsGetState.mockReturnValue({ serverUrl: 'http://localhost:3000' });
    mockAbortControllers = [];
    lastPair = null;
    mockFetchImpl = jest.fn((url: string, init: any) => {
      const abortSpy = jest.fn();
      // 通过 init.signal 监听 abort 事件：当 useSessionStream 调 ac.abort() 时，
      // 这里 signal 也会触发 abort 事件，我们用 spy 记录。
      const signal: AbortSignal | undefined = init?.signal;
      if (signal) {
        signal.addEventListener('abort', () => abortSpy());
      }
      mockAbortControllers.push({ abort: abortSpy, signal: signal as AbortSignal });
      const pair = createReadableStreamPair();
      lastPair = pair;
      void url;
      void init;
      return Promise.resolve(createResponse(pair.stream));
    });
    (globalThis as any).fetch = mockFetchImpl;
  });
  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('sendMessage 触发 POST /sessions/:id/send，body 为 { message }', async () => {
    const onEvent = jest.fn();
    const { result } = renderHook(() => useSessionStream('sess-1', { onEvent }));
    // 启动 sendMessage（不要 await 整个 sendMessage，因 reader 会阻塞）
    act(() => {
      result.current.sendMessage('hello');
    });
    // 等待 fetch 微任务
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    expect(mockFetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetchImpl.mock.calls[0];
    expect(url).toBe('http://localhost:3000/sessions/sess-1/send');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ message: 'hello' });
    // 关闭流避免悬挂
    act(() => {
      lastPair!.close();
    });
  });

  it('多个 text_delta 事件被依次解析并回调', async () => {
    const onEvent = jest.fn();
    const { result } = renderHook(() => useSessionStream('sess-2', { onEvent }));
    act(() => {
      result.current.sendMessage('hi');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    expect(lastPair).not.toBeNull();
    const pair = lastPair!;
    act(() => {
      pair.enqueue(
        'event: text_delta\ndata: {"text":"Hello"}\n\n' +
          'event: text_delta\ndata: {"text":" World"}\n\n',
      );
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    const deltaEvents = onEvent.mock.calls.map((c) => c[0]).filter((e: any) => e.type === 'text_delta');
    expect(deltaEvents.length).toBe(2);
    expect(deltaEvents[0].data.text).toBe('Hello');
    expect(deltaEvents[1].data.text).toBe(' World');
    // 关闭
    act(() => {
      pair.close();
    });
  });

  it('收到 turn_done 时关闭流（isStreaming 回到 false）', async () => {
    const onEvent = jest.fn();
    const { result } = renderHook(() => useSessionStream('sess-3', { onEvent }));
    act(() => {
      result.current.sendMessage('go');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    const pair = lastPair!;
    act(() => {
      pair.enqueue('event: turn_done\ndata: {}\n\n');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    expect(result.current.isStreaming).toBe(false);
    expect(onEvent).toHaveBeenCalledWith(expect.objectContaining({ type: 'turn_done' }));
  });

  it('error 事件被识别并触发回调', async () => {
    const onEvent = jest.fn();
    const { result } = renderHook(() => useSessionStream('sess-4', { onEvent }));
    act(() => {
      result.current.sendMessage('go');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    const pair = lastPair!;
    act(() => {
      pair.enqueue('event: error\ndata: {"error":"boom"}\n\n');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    const errEvent = onEvent.mock.calls
      .map((c) => c[0])
      .find((e: any) => e.type === 'error');
    expect(errEvent).toBeDefined();
    expect(errEvent.data.error).toBe('boom');
  });

  it('abort() 取消 fetch', async () => {
    const { result } = renderHook(() => useSessionStream('sess-5'));
    act(() => {
      result.current.sendMessage('go');
    });
    await act(async () => {
      await new Promise<void>((r) => setImmediate(() => r()));
    });
    expect(mockAbortControllers.length).toBe(1);
    act(() => {
      result.current.abort();
    });
    expect(mockAbortControllers[0].abort).toHaveBeenCalled();
    // 关闭以免悬挂
    act(() => {
      lastPair!.close();
    });
  });
});
