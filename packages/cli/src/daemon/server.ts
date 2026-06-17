import 'dotenv/config';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { SessionManager } from './session.js';
import { ClaudeAgent } from '../agents/claude.js';
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE } from '@openz/speech/server';
import type {
  CreateSessionRequest,
  SendMessageRequest,
  SessionRequest,
  SendVoiceReplyRequest,
  SessionCreatedResponse,
  SessionListResponse,
  SessionErrorResponse,
  SessionEventResponse,
  AgentEvent,
} from '@openz/shared';
import { DEFAULT_PORT, getDaemonStatePath, type DaemonState } from './types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { randomUUID } from 'crypto';

const LOG_FILE = `${process.env.HOME}/.openz/daemon.log`;
const DAEMON_STATE_DIR = `${process.env.HOME}/.openz`;

function log(...args: any[]) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  console.log(msg);
  try {
    mkdirSync(DAEMON_STATE_DIR, { recursive: true });
    appendFileSync(LOG_FILE, msg + '\n');
  } catch (e) {
    // ignore
  }
}

function saveDaemonState(state: DaemonState) {
  if (!existsSync(DAEMON_STATE_DIR)) mkdirSync(DAEMON_STATE_DIR, { recursive: true });
  writeFileSync(getDaemonStatePath(), JSON.stringify(state, null, 2));
}

// Active voice reply WebSocket connections, keyed by sessionId
const voiceWsClients = new Map<string, WebSocket>();

export async function startDaemon(port = DEFAULT_PORT, serverUrl?: string) {
  const daemonId = `daemon-${randomUUID().slice(0, 8)}`;

  // If serverUrl is provided, run in relay mode (connect to remote server)
  if (serverUrl) {
    return startDaemonRelayMode(daemonId, serverUrl);
  }

  // Otherwise, run in direct mode (listen for connections)
  return startDaemonDirectMode(port, daemonId);
}

async function startDaemonDirectMode(port: number, daemonId: string) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  // WebSocket server for TTS PCM streaming (used by @openz/speech/client)
  const wss = new WebSocketServer({ noServer: true });

  // Handle WebSocket upgrade requests (TTS streaming)
  wss.on('connection', (ws: WebSocket, sessionId: string) => {
    log(`[WS] TTS client connected for session ${sessionId}`);
    voiceWsClients.set(sessionId, ws);

    ws.on('close', () => {
      log(`[WS] TTS client disconnected for session ${sessionId}`);
      voiceWsClients.delete(sessionId);
    });

    ws.on('error', (err) => {
      log(`[WS] TTS client error for session ${sessionId}:`, err.message);
      voiceWsClients.delete(sessionId);
    });
  });

  // Attach WebSocket server to HTTP server upgrade handling
  httpServer.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    if (url.pathname === '/api/tts/ws') {
      const sessionId = url.searchParams.get('sessionId') || '';
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, sessionId);
      });
    } else {
      socket.destroy();
    }
  });

  const agent = new ClaudeAgent();
  const sessionManager = new SessionManager(agent);

  // 保存 daemon 状态
  const state: DaemonState = {
    pid: process.pid,
    port,
    version: '0.1.0',
    startedAt: Date.now(),
  };
  saveDaemonState(state);

  // Socket.IO 事件处理
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on('session:create', async (req: CreateSessionRequest, ack) => {
      log('session:create', req);
      try {
        const session = await sessionManager.createSession({
          id: req.id,
          engine: req.engine,
          cwd: req.cwd,
          model: req.model,
          onEvent: (event: AgentEvent) => {
            const response: SessionEventResponse = { sessionId: session.id, event };
            socket.emit('session:event', response);
          },
        });

        sessionManager.setOnEvent(session.id, (event: AgentEvent) => {
          const response: SessionEventResponse = { sessionId: session.id, event };
          socket.emit('session:event', response);
        });

        const response: SessionCreatedResponse = { session };
        ack?.(response);
        socket.emit('session:created', response);
      } catch (err: any) {
        const response: SessionErrorResponse = { sessionId: req.id || '', error: err.message };
        ack?.({ error: err.message });
      }
    });

    socket.on('session:send', async (req: SendMessageRequest, ack) => {
      log('session:send', req);
      try {
        const entry = sessionManager.getSession(req.sessionId);
        if (!entry) {
          ack?.({ error: `Session ${req.sessionId} not found` });
          return;
        }

        sessionManager.updateSessionStatus(req.sessionId, 'running');

        sessionManager.setOnEvent(req.sessionId, (event: AgentEvent) => {
          if (event.type === 'text_delta') {
            log(`[Agent] ${event.data.text}`);
          } else {
            log('event emitted:', event.type);
          }
          const response: SessionEventResponse = { sessionId: req.sessionId, event };
          socket.emit('session:event', response);
        });

        await sessionManager.sendMessage(req.sessionId, req.message);
        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    // session:voice_reply — 使用 @openz/speech/server bidirectionTtsStream
    socket.on('session:voice_reply', async (req: SendVoiceReplyRequest, ack) => {
      log('session:voice_reply', req);
      try {
        const entry = sessionManager.getSession(req.sessionId);
        if (!entry) {
          ack?.({ error: `Session ${req.sessionId} not found` });
          return;
        }

        const sessionId = req.sessionId;
        const ws = voiceWsClients.get(sessionId);

        if (!ws || ws.readyState !== WebSocket.OPEN) {
          ack?.({ error: `No TTS WebSocket connection for session ${sessionId}` });
          return;
        }

        const wsClient = ws;

        const textQueue: string[] = [];
        let resolveNextChunk: ((chunk: string) => void) | null = null;
        let ttsDone = false;

        async function* textStream(): AsyncGenerator<string> {
          while (!ttsDone || textQueue.length > 0) {
            if (textQueue.length > 0) {
              yield textQueue.shift()!;
            } else {
              await new Promise<string>((resolve) => {
                resolveNextChunk = resolve;
              });
              if (textQueue.length > 0) {
                yield textQueue.shift()!;
              }
            }
          }
        }

        const handleEvent = (event: AgentEvent) => {
          if (event.type === 'text_delta') {
            const text = event.data.text;
            const sentences = text.match(/[^.。!！?？\n]+[.。!！?？\n]*/g);
            if (sentences) {
              for (const sentence of sentences) {
                const trimmed = sentence.trim();
                if (!trimmed) continue;
                if (resolveNextChunk) {
                  resolveNextChunk(trimmed);
                  resolveNextChunk = null;
                } else {
                  textQueue.push(trimmed);
                }
              }
            }
          }

          if (event.type === 'turn_done' || event.type === 'assistant_complete') {
            ttsDone = true;
            const remaining = textQueue.shift();
            if (remaining && resolveNextChunk) {
              resolveNextChunk(remaining);
              resolveNextChunk = null;
            }
          }

          const response: SessionEventResponse = { sessionId, event };
          socket.emit('session:event', response);
        };

        sessionManager.setOnEvent(sessionId, handleEvent);
        sessionManager.updateSessionStatus(sessionId, 'running');

        const startedAt = Date.now();

        async function runTtsStream() {
          try {
            const stream = bidirectionTtsStream({
              appkey: process.env.VOLCENGINE_API_KEY || '',
              resourceId: 'seed-tts-2.0',
              voiceType: 'saturn_zh_female_aojiaonvyou_tob',
              texts: textStream(),
              encoding: 'pcm',
              sampleRate: DEFAULT_SAMPLE_RATE,
              onAudioFrame: (frame) => {
                if (wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(frame);
                }
              },
              onFirstFrame: (at) => {
                log(`[TTS] first frame +${at}ms for session ${sessionId}`);
                if (wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(JSON.stringify({ type: 'first_frame', at }));
                }
              },
              onChunk: (idx, text) => {
                log(`[TTS] chunk #${idx}: "${text.slice(0, 20)}..."`);
                if (wsClient.readyState === WebSocket.OPEN) {
                  wsClient.send(JSON.stringify({ type: 'chunk', index: idx, text, at: Date.now() - startedAt }));
                }
              },
            });

            await new Promise<void>((resolve, reject) => {
              stream.on('end', resolve);
              stream.on('error', reject);
            });

            if (wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({ type: 'end', totalBytes: 0 }));
              wsClient.close();
            }
          } catch (err) {
            log('[TTS] stream error:', err);
            if (wsClient.readyState === WebSocket.OPEN) {
              wsClient.send(JSON.stringify({ type: 'error', error: String(err) }));
              wsClient.close();
            }
          }
        }

        sessionManager.sendMessage(sessionId, req.message).catch((err) => {
          log('[TTS] sendMessage error:', err);
        });

        runTtsStream();

        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    socket.on('session:interrupt', (req: SessionRequest, ack) => {
      sessionManager.interruptSession(req.sessionId);
      sessionManager.updateSessionStatus(req.sessionId, 'interrupted');
      ack?.({ ok: true });
    });

    socket.on('session:stop', (req: SessionRequest, ack) => {
      sessionManager.stopSession(req.sessionId);
      sessionManager.updateSessionStatus(req.sessionId, 'done');
      ack?.({ ok: true });
    });

    socket.on('session:list', (_, ack) => {
      const sessions = sessionManager.getAllSessions();
      const response: SessionListResponse = { sessions };
      ack?.(response);
    });

    socket.on('session:delete', (req: SessionRequest, ack) => {
      sessionManager.deleteSession(req.sessionId);
      ack?.({ ok: true });
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`Openz daemon listening on http://localhost:${port}`);
    console.log(`TTS WebSocket endpoint: ws://localhost:${port}/api/tts/ws?sessionId=<sessionId>`);
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    wss.close();
    httpServer.close();
    process.exit(0);
  });
}

// Relay mode - connect to remote server instead of listening
async function startDaemonRelayMode(daemonId: string, serverUrl: string) {
  const agent = new ClaudeAgent();
  const sessionManager = new SessionManager(agent);

  const socket: ClientSocket = io(serverUrl, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  const state: DaemonState = {
    pid: process.pid,
    port: 0,
    version: '0.1.0',
    startedAt: Date.now(),
  };
  saveDaemonState(state);

  socket.on('connect', () => {
    log(`Connected to Openz Server: ${serverUrl}`);
    console.log(`Openz daemon connected to server: ${serverUrl}`);
    socket.emit('daemon:register', { daemonId });
  });

  socket.on('daemon:registered', (data: { daemonId: string }) => {
    log(`Registered with server as: ${data.daemonId}`);
    console.log(`Daemon registered with server: ${data.daemonId}`);
  });

  socket.on('daemon:ping', (data: { timestamp: number }) => {
    socket.emit('daemon:pong', { timestamp: data.timestamp });
  });

  socket.on('session:create', async (req: CreateSessionRequest, ack) => {
    log('session:create (relay)', req);
    try {
      const session = await sessionManager.createSession({
        id: req.id,
        engine: req.engine,
        cwd: req.cwd,
        model: req.model,
        onEvent: (event: AgentEvent) => {
          socket.emit('daemon:session_event', { sessionId: session.id, event });
        },
      });

      sessionManager.setOnEvent(session.id, (event: AgentEvent) => {
        socket.emit('daemon:session_event', { sessionId: session.id, event });
      });

      socket.emit('daemon:session_created', { daemonId, sessionId: session.id, session });

      const response: SessionCreatedResponse = { session };
      ack?.(response);
      socket.emit('session:created', response);
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('session:send', async (req: SendMessageRequest, ack) => {
    log('session:send (relay)', req);
    try {
      const entry = sessionManager.getSession(req.sessionId);
      if (!entry) {
        ack?.({ error: `Session ${req.sessionId} not found` });
        return;
      }

      sessionManager.updateSessionStatus(req.sessionId, 'running');

      sessionManager.setOnEvent(req.sessionId, (event: AgentEvent) => {
        socket.emit('daemon:session_event', { sessionId: req.sessionId, event });
      });

      await sessionManager.sendMessage(req.sessionId, req.message);
      ack?.({ ok: true });
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('session:interrupt', (req: SessionRequest, ack) => {
    sessionManager.interruptSession(req.sessionId);
    sessionManager.updateSessionStatus(req.sessionId, 'interrupted');
    ack?.({ ok: true });
  });

  socket.on('session:stop', (req: SessionRequest, ack) => {
    sessionManager.stopSession(req.sessionId);
    sessionManager.updateSessionStatus(req.sessionId, 'done');
    ack?.({ ok: true });
  });

  socket.on('session:list', (_, ack) => {
    const sessions = sessionManager.getAllSessions();
    const response: SessionListResponse = { sessions };
    ack?.(response);
  });

  socket.on('session:delete', (req: SessionRequest, ack) => {
    sessionManager.deleteSession(req.sessionId);
    ack?.({ ok: true });
  });

  socket.on('disconnect', () => {
    console.log(`Disconnected from server: ${serverUrl}`);
  });

  socket.on('connect_error', (err) => {
    console.error(`Failed to connect to server: ${err.message}`);
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    socket.disconnect();
    process.exit(0);
  });
}
