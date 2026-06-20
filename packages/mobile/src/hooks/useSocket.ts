// 通用 Socket 订阅与连接状态 hook
//
// 导出：
//   - useSocket(event, handler, deps?)  ：订阅一个 socket 事件，卸载时取消订阅；deps 变化重新订阅
//   - useConnectionStatus()             ：从 connectionStore 读取 status / failCount / lastError
//   - useClientPing(intervalMs = 30000)：每 N 毫秒发送 client:ping，连续 3 次无响应触发 recordPingTimeout
//   - _setupSocketConnection(socket)   ：在 socket 上安装 connect/error/disconnect 监听，更新 connectionStore

import { useEffect, useRef } from 'react';
import { useConnectionStore } from '../stores/connectionStore';
import { getSocket } from '../lib/socket';
import type { Socket } from 'socket.io-client';

/**
 * 订阅 socket 事件。handler 在 deps 变化时会重新订阅（先 off 再 on）。
 */
export function useSocket<T = unknown>(
  event: string,
  handler: (payload: T) => void,
  deps: ReadonlyArray<unknown> = [],
): void {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    const socket = getSocket();
    const wrapper = (payload: T) => handlerRef.current(payload);
    socket.on(event, wrapper);
    return () => {
      socket.off(event, wrapper);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, ...deps]);
}

/**
 * 从 connectionStore 读取连接状态。
 */
export function useConnectionStatus(): {
  status: 'connected' | 'connecting' | 'disconnected';
  failCount: number;
  lastError: string | null;
} {
  const status = useConnectionStore((s) => s.status);
  const failCount = useConnectionStore((s) => s.failCount);
  const lastError = useConnectionStore((s) => s.lastError);
  return { status, failCount, lastError };
}

/**
 * 心跳：按 intervalMs 周期发送 client:ping；若 store 仍为 connected 状态连续 3 次无 pong 响应，
 * 调用 connectionStore.recordPingTimeout() 标记心跳超时。
 */
export function useClientPing(intervalMs: number = 30000): void {
  useEffect(() => {
    const socket = getSocket();
    let pendingPings = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const onPong = () => {
      pendingPings = 0;
    };

    socket.on('client:pong', onPong);

    intervalId = setInterval(() => {
      // 仅在 connected 时发送心跳
      if (useConnectionStore.getState().status !== 'connected') {
        pendingPings = 0;
        return;
      }
      socket.emit('client:ping');
      pendingPings += 1;
      if (pendingPings >= 3) {
        // 连续 3 次无响应
        useConnectionStore.getState().recordPingTimeout();
        pendingPings = 0;
      }
    }, intervalMs);

    return () => {
      if (intervalId) clearInterval(intervalId);
      socket.off('client:pong', onPong);
    };
  }, [intervalMs]);
}

/**
 * 给 socket 安装基础连接监听：connect → markConnected，error → recordConnectError，
 * disconnect → 仅在 connected 时更新为 disconnected（保留 socket 缓存以便 socket.io 自带重连）。
 * 暴露 _ 前缀用于测试。
 */
export function _setupSocketConnection(socket: Socket): void {
  // 如果 socket 已经连接，立即更新状态
  if (socket.connected) {
    useConnectionStore.getState().markConnected();
  }

  socket.on('connect', () => {
    useConnectionStore.getState().markConnected();
  });
  socket.on('connect_error', (err: Error) => {
    useConnectionStore.getState().recordConnectError(err?.message ?? 'connect_error');
  });
  socket.on('disconnect', (reason: string) => {
    const cur = useConnectionStore.getState();
    if (cur.status === 'connected') {
      useConnectionStore.setState({ status: 'disconnected', lastError: reason });
    }
  });
}
