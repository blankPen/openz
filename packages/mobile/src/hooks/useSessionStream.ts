// useSessionStream —— SSE 流式订阅
//
// 调用 sendMessage(text)：
//   1. POST {serverUrl}/sessions/:id/send  body = { message: text }
//   2. 接收 text/event-stream 响应，逐行解析 `event: <type>\ndata: <json>` 帧
//   3. 每解析到一个事件，调用 onEvent(event) 回调
//   4. 收到 turn_done 或 error 事件自动关闭流
// 暴露 abort() 主动取消（AbortController）
//
// 注：本 hook 不直接渲染 React 状态机的事件——事件消费由调用方注入 reducer
// （参见 lib/eventReducer.ts）。

import { useCallback, useEffect, useRef, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import type { AgentEvent } from '@openz/shared';

import createDebug from 'debug';
const log = createDebug('openz:sse');

export interface UseSessionStreamOptions {
  /** 每解析到一个事件触发 */
  onEvent?: (event: AgentEvent) => void;
  /** 流结束（turn_done / error / 网络中断）时触发 */
  onClose?: (reason: 'turn_done' | 'error' | 'aborted' | 'network') => void;
}

export interface UseSessionStreamResult {
  sendMessage: (text: string) => Promise<void>;
  isStreaming: boolean;
  abort: () => void;
}

export function useSessionStream(
  sessionId: string | null,
  options: UseSessionStreamOptions = {},
): UseSessionStreamResult {
  const { onEvent, onClose } = options;
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // 保存最新的 callback，避免 deps 触发重建 effect
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const abort = useCallback(() => {
    log('abort() called');
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsStreaming(false);
  }, []);

  // session 变化时清理
  useEffect(() => {
    return () => {
      abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text: string, sessionIdOverride?: string) => {
      // 支持外部传入 sessionId，避免被闭包捕获的过期 sessionId
      const sid = sessionIdOverride ?? sessionId;
      if (!sid) {
        log('sendMessage: no sessionId, skip');
        return;
      }
      const serverUrl = useSettingsStore.getState().serverUrl;
      if (!serverUrl) {
        log('✗ sendMessage: serverUrl 未配置');
        throw new Error('serverUrl 未配置');
      }
      log('→ POST', `${serverUrl}/sessions/${sid}/send`, 'message=', JSON.stringify(text).slice(0, 60));

      // 取消上一次未完成请求
      if (abortRef.current) abortRef.current.abort();
      const ac = new AbortController();
      abortRef.current = ac;

      setIsStreaming(true);
      try {
        const resp = await fetch(`${serverUrl}/sessions/${sid}/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'text/event-stream',
          },
          body: JSON.stringify({ message: text }),
          signal: ac.signal,
        });
        log('← response', resp.status, resp.statusText, 'content-type=', (resp.headers as any)?.get?.('content-type') ?? '(none)');
        if (!resp.ok) {
          throw new Error(`SSE 请求失败: ${resp.status}`);
        }
        if (!resp.body) {
          throw new Error('SSE 响应无 body');
        }
        let eventCount = 0;
        await readSseStream(resp.body, {
          onEvent: (e) => {
            eventCount++;
            if (eventCount === 1 || eventCount % 10 === 0 || e.type === 'turn_done' || e.type === 'error') {
              log('  event #' + eventCount, e.type, e.seq !== undefined ? 'seq=' + e.seq : '');
            }
            onEventRef.current?.(e);
            if (e.type === 'turn_done') {
              log('✓ turn_done, closing stream');
              ac.abort();
              setIsStreaming(false);
              onCloseRef.current?.('turn_done');
            } else if (e.type === 'error') {
              log('✗ error event, closing stream');
              ac.abort();
              setIsStreaming(false);
              onCloseRef.current?.('error');
            }
          },
        });
        log('✓ stream closed, total events=', eventCount);
        // 正常结束
        setIsStreaming(false);
      } catch (err: any) {
        if (err?.name === 'AbortError') {
          log('aborted');
          onCloseRef.current?.('aborted');
        } else {
          log('✗ network error:', err?.message ?? err);
          onCloseRef.current?.('network');
        }
        setIsStreaming(false);
      } finally {
        if (abortRef.current === ac) abortRef.current = null;
      }
    },
    [sessionId],
  );

  return { sendMessage, isStreaming, abort };
}

// 解析 SSE 流
async function readSseStream(
  body: ReadableStream<Uint8Array>,
  handlers: { onEvent: (e: AgentEvent) => void },
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  let buf = '';
  let currentEvent = 'message';
  let currentData = '';

  const flushFrame = () => {
    if (!currentData && !currentEvent) return;
    try {
      const json = currentData.trim() ? JSON.parse(currentData) : {};
      // SSE data 字段是 JSON：可能是 { type, data, eventId, sessionId, seq, timestamp }
      // 也可能只发 data 子字段（如 {"text":"Hello"}）
      const evt: AgentEvent = {
        eventId: json.eventId ?? '',
        sessionId: json.sessionId ?? '',
        seq: json.seq ?? 0,
        timestamp: json.timestamp ?? Date.now(),
        type: currentEvent,
        data: json.data ?? json,
      } as AgentEvent;
      handlers.onEvent(evt);
    } catch (e) {
      log('✗ failed to parse SSE frame:', currentData, e);
    }
    currentEvent = 'message';
    currentData = '';
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      buf += decoder.decode();
      buf.split('\n').forEach(processLine);
      flushFrame();
      break;
    }
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() ?? '';
    lines.forEach(processLine);
  }

  function processLine(line: string) {
    if (line === '') {
      flushFrame();
      return;
    }
    if (line.startsWith(':')) return; // 注释
    const idx = line.indexOf(':');
    const field = idx === -1 ? line : line.slice(0, idx);
    const value = idx === -1 ? '' : line.slice(idx + 1).trimStart();
    if (field === 'event') currentEvent = value;
    else if (field === 'data') currentData = currentData ? currentData + '\n' + value : value;
  }
}
