// Socket.IO 单例工厂
//
// 职责：
//   - 按 serverUrl 缓存 Socket 实例，相同地址复用
//   - 默认配置：自动重连 + WebSocket 单传输
//   - 未传 serverUrl 时自动从 settingsStore 读取
//   - 暴露 disconnectAll() 用于 AppState 后台时清理
//
// 备注：连接状态/错误日志在 useSessions / useSessionStream / useTtsClient 中记录，
// 这里只打一行 connection 创建日志，避免与 _setupSocketConnection 的 connect handler 冲突。

import { io, Socket, ManagerOptions, SocketOptions } from 'socket.io-client';
import { useSettingsStore } from '../stores/settingsStore';

const log = (...args: unknown[]) => console.log('[mobile/socket]', ...args);

/** Socket.IO 默认配置（移动端推荐 WebSocket 单传输） */
export const DEFAULT_SOCKET_OPTIONS: Partial<ManagerOptions & SocketOptions> = {
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  transports: ['websocket'],
};

const socketCache = new Map<string, Socket>();

/**
 * 获取（或创建）一个到指定 serverUrl 的 Socket 实例。
 * - 同一 serverUrl 多次调用返回同一实例
 * - 若未提供 serverUrl，自动从 settingsStore 读取
 * - 自定义 options 会与 DEFAULT_SOCKET_OPTIONS 浅合并
 */
export function getSocket(serverUrl?: string, options?: Partial<SocketOptions>): Socket {
  const url = serverUrl ?? useSettingsStore.getState().serverUrl;
  const cached = socketCache.get(url);
  if (cached) return cached;

  const merged: Partial<SocketOptions> = {
    ...DEFAULT_SOCKET_OPTIONS,
    ...(options ?? {}),
  };
  log('creating socket to', url, 'with options', merged);
  const socket = io(url, merged);
  socketCache.set(url, socket);
  return socket;
}

/** 断开并清空所有缓存的 Socket 实例。常用于 AppState 后台切换。 */
export function disconnectAll(): void {
  log('disconnectAll, count=', socketCache.size);
  for (const socket of socketCache.values()) {
    try {
      socket.removeAllListeners();
      socket.disconnect();
    } catch {
      /* 忽略断开异常 */
    }
  }
  socketCache.clear();
}
