import { io, type Socket } from 'socket.io-client';
import type { AgentEvent, Session } from './types';

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

export interface SessionCreatedResponse { session: Session }
export interface SessionListResponse { sessions: Session[] }
export interface SessionErrorResponse { error: string }
export interface SessionEventResponse { sessionId: string; event: AgentEvent }
export interface TTSAudioResponse { data: string | null }
export interface TTSErrorResponse { error: string }
export interface TTSCompleteResponse {}
