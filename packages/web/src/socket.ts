import { io, type Socket } from 'socket.io-client';
import type { AgentEvent, Session } from './types';

const DAEMON_PORT = 19999;
export const socket: Socket = io(`//${window.location.hostname}:${DAEMON_PORT}`, {
  transports: ['websocket'],
});

export interface SessionCreatedResponse { session: Session }
export interface SessionListResponse { sessions: Session[] }
export interface SessionErrorResponse { error: string }
export interface SessionEventResponse { sessionId: string; event: AgentEvent }
export interface TTSAudioResponse { data: string | null }
export interface TTSErrorResponse { error: string }
export interface TTSCompleteResponse {}
