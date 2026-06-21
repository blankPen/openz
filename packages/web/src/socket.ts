import { io, type Socket } from 'socket.io-client';
import type { AgentEvent, Session } from './types';

// 临时 logger 避免循环依赖
function log(...args: unknown[]) {
  const enabled = localStorage.getItem('debug') ?? '';
  if (!enabled && enabled !== '*') return;
  console.log('[openz:socket]', ...args);
}

const DAEMON_PORT = 19999;

// Get server URL from query parameter or use default
function getServerUrl(): string | undefined {
  const params = new URLSearchParams(window.location.search);
  const serverParam = params.get('server');
  if (serverParam) {
    return serverParam;
  }
  return undefined;
}

// Connect to either server or direct daemon
const serverUrl = getServerUrl();
const socketUrl = serverUrl
  ? serverUrl
  : `//${window.location.hostname}:${DAEMON_PORT}`;

export const socket: Socket = io(socketUrl, {
  transports: ['websocket'],
  ...(serverUrl && {
    // When connecting to server, enable auto-reconnection
    reconnection: true,
    reconnectionAttempts: 5,
  }),
});

socket.on('connect', () => log('socket 已连接 id=%s url=%s', socket.id, socketUrl));
socket.on('disconnect', (reason) => log('socket 断开 reason=%s', reason));
socket.on('connect_error', (err) => log('socket 连接错误 error=%s', err.message));
socket.on('reconnect_attempt', (attempt) => log('socket 重连 attempt=%d', attempt));
socket.on('reconnect', (attempt) => log('socket 重连成功 attempt=%d', attempt));

export interface SessionCreatedResponse { session: Session }
export interface SessionListResponse { sessions: Session[] }
export interface SessionErrorResponse { error: string }
export interface SessionEventResponse { sessionId: string; event: AgentEvent }
export interface TTSAudioResponse { data: string | null }
export interface TTSErrorResponse { error: string }
export interface TTSCompleteResponse {}
