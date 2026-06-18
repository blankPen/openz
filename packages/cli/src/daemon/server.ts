import 'dotenv/config';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { io, type Socket as ClientSocket } from 'socket.io-client';
import { SessionManager } from './session.js';
import { ClaudeAgent } from '../agents/claude.js';
import { bidirectionTtsStream, DEFAULT_SAMPLE_RATE } from '@openz/speech/server';
import type {
  CreateSessionRequest,
  SendMessageRequest,
  SessionRequest,
  SessionCreatedResponse,
  SessionListResponse,
  SessionEventResponse,
  SessionHistoryResponse,
  AgentEvent,
} from '@openz/shared';
import { DEFAULT_PORT, getDaemonStatePath, type DaemonState } from './types.js';
import { loadConfig } from './config.js';
import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
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

// ============================================================
// HTTP 工具
// ============================================================

/** 从 IncomingMessage 读取 body */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function jsonResponse(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function sendError(res: ServerResponse, status: number, error: string) {
  jsonResponse(res, status, { error });
}

/** 路由匹配：返回 { route, sessionId? } 或 null */
function matchHttpRoute(method: string, path: string): { route: string; sessionId?: string } | null {
  // GET  /sessions
  if (method === 'GET' && path === '/sessions') return { route: 'list' };
  // POST /sessions
  if (method === 'POST' && path === '/sessions') return { route: 'create' };

  // DELETE /sessions/:id
  const deleteMatch = method === 'DELETE' && path.match(/^\/sessions\/([^/]+)$/);
  if (deleteMatch) return { route: 'delete', sessionId: deleteMatch[1] };

  // GET /sessions/:id/events?after=<seq>
  const eventsMatch = method === 'GET' && path.match(/^\/sessions\/([^/]+)\/events$/);
  if (eventsMatch) return { route: 'events', sessionId: eventsMatch[1] };

  // POST /sessions/:id/send → SSE
  const sendMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/send$/);
  if (sendMatch) return { route: 'send', sessionId: sendMatch[1] };

  // POST /sessions/:id/interrupt
  const interruptMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/interrupt$/);
  if (interruptMatch) return { route: 'interrupt', sessionId: interruptMatch[1] };

  // POST /sessions/:id/stop
  const stopMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/stop$/);
  if (stopMatch) return { route: 'stop', sessionId: stopMatch[1] };

  return null;
}

// ============================================================
// TTS sink 抽象
// ============================================================

export interface TtsSink {
  sendAudio(frame: Buffer | Uint8Array): boolean;
  sendEvent(event: Record<string, any>): boolean;
  isOpen(): boolean;
}

// ============================================================
// Daemon 启动
// ============================================================

export async function startDaemon(port = DEFAULT_PORT, serverUrl?: string) {
  const daemonId = `daemon-${randomUUID().slice(0, 8)}`;

  if (serverUrl) {
    return startDaemonRelayMode(daemonId, serverUrl);
  }

  return startDaemonDirectMode(port, daemonId);
}

// ============================================================
// Direct 模式 —— daemon 同时提供 HTTP REST + SSE + Socket.IO
// ============================================================

async function startDaemonDirectMode(port: number, _daemonId: string) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  const agent = new ClaudeAgent();
  const sessionManager = new SessionManager(agent);

  const state: DaemonState = {
    pid: process.pid,
    port,
    version: '0.1.0',
    startedAt: Date.now(),
  };
  saveDaemonState(state);

  // -------- HTTP REST + SSE 路由 --------
  httpServer.on('request', async (req, res) => {
    // 不拦截 socket.io 的内部请求
    if (req.url?.startsWith('/socket.io')) return;

    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const url = new URL(req.url || '/', `http://localhost:${port}`);
    const route = matchHttpRoute(req.method || 'GET', url.pathname);

    if (!route) {
      sendError(res, 404, 'Not found');
      return;
    }

    try {
      await handleHttpRoute(route, url, req, res, sessionManager);
    } catch (err: any) {
      log('[HTTP] error:', err.message);
      sendError(res, 500, err.message || 'Internal error');
    }
  });

  // -------- Socket.IO 事件（向后兼容 + TTS）--------
  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // -- 会话管理 (保持与 web 端兼容) --

    socket.on('session:create', async (req: CreateSessionRequest, ack) => {
      log('session:create', req);
      try {
        const session = await sessionManager.createSession({
          id: req.id,
          engine: req.engine,
          cwd: req.cwd,
          model: req.model,
          onEvent: (event: AgentEvent) => {
            socket.emit('session:event', { sessionId: session.id, event } satisfies SessionEventResponse);
          },
        });

        sessionManager.setOnEvent(session.id, (event: AgentEvent) => {
          socket.emit('session:event', { sessionId: session.id, event } satisfies SessionEventResponse);
        });

        ack?.({ session } satisfies SessionCreatedResponse);
        socket.emit('session:created', { session } satisfies SessionCreatedResponse);
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    socket.on('session:send', async (req: SendMessageRequest, ack) => {
      log('session:send', req);
      try {
        if (!sessionManager.getSession(req.sessionId)) {
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
          socket.emit('session:event', { sessionId: req.sessionId, event } satisfies SessionEventResponse);
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
      ack?.({ sessions: sessionManager.getAllSessions() } satisfies SessionListResponse);
    });

    socket.on('session:delete', (req: SessionRequest, ack) => {
      sessionManager.deleteSession(req.sessionId);
      ack?.({ ok: true });
    });

    // -- TTS 语音合成 --
    socket.on('tts:start', (req: { sessionId: string; message: string }, ack?: (r: any) => void) => {
      log('tts:start', req);
      try {
        if (!sessionManager.getSession(req.sessionId)) {
          ack?.({ error: `Session ${req.sessionId} not found` });
          return;
        }

        const sessionId = req.sessionId;
        const sink: TtsSink = {
          isOpen: () => socket.connected,
          sendAudio: (frame) => {
            if (!socket.connected) return false;
            socket.emit('tts:audio', { sessionId }, frame as Buffer);
            return true;
          },
          sendEvent: (event) => {
            if (!socket.connected) return false;
            socket.emit('tts:event', { sessionId, ...event });
            return true;
          },
        };

        runTtsStream(sessionId, req.message, sessionManager, sink);
        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`Openz daemon listening on http://localhost:${port}`);
    console.log('(voice reply requires relay mode; restart with --server <url>)');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}

// ============================================================
// HTTP 路由处理（direct 模式）
// ============================================================

async function handleHttpRoute(
  route: { route: string; sessionId?: string },
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
  sessionManager: SessionManager,
) {
  const { route: routeName, sessionId } = route;

  switch (routeName) {
    // GET /sessions
    case 'list': {
      const sessions = sessionManager.getAllSessions();
      jsonResponse(res, 200, { sessions } satisfies SessionListResponse);
      return;
    }

    // POST /sessions
    case 'create': {
      const body = JSON.parse(await readBody(req));
      const session = await sessionManager.createSession({
        id: body.id,
        engine: body.engine,
        cwd: body.cwd,
        model: body.model,
      });
      jsonResponse(res, 201, session);
      return;
    }

    // DELETE /sessions/:id
    case 'delete': {
      sessionManager.deleteSession(sessionId!);
      jsonResponse(res, 200, { ok: true });
      return;
    }

    // GET /sessions/:id/events?after=<seq>
    case 'events': {
      const after = url.searchParams.get('after');
      const events = sessionManager.getEvents(sessionId!, after ? Number(after) : undefined);
      jsonResponse(res, 200, { sessionId: sessionId!, events } satisfies SessionHistoryResponse);
      return;
    }

    // POST /sessions/:id/send → SSE 流
    case 'send': {
      const body = JSON.parse(await readBody(req));
      const message: string = body.message;
      if (!message || !message.trim()) {
        sendError(res, 400, 'message is required');
        return;
      }

      if (!sessionManager.getSession(sessionId!)) {
        sendError(res, 404, `Session ${sessionId} not found`);
        return;
      }

      // SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      let ended = false;
      const end = () => {
        if (!ended) { ended = true; res.end(); }
      };

      // 监听断开
      req.on('close', () => { end(); });

      // 设置事件回调：事件 → SSE
      sessionManager.setOnEvent(sessionId!, (event: AgentEvent) => {
        if (ended) return;
        res.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
        if (event.type === 'turn_done' || event.type === 'error') {
          end();
        }
      });

      sessionManager.updateSessionStatus(sessionId!, 'running');

      try {
        await sessionManager.sendMessage(sessionId!, message.trim());
        // 兜底：sendMessage 已返回但 turn_done 可能未 emit（边界情况）
        end();
      } catch (err: any) {
        if (!ended) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
        }
        end();
      }
      return;
    }

    // POST /sessions/:id/interrupt
    case 'interrupt': {
      if (!sessionManager.getSession(sessionId!)) {
        sendError(res, 404, `Session ${sessionId} not found`);
        return;
      }
      sessionManager.interruptSession(sessionId!);
      sessionManager.updateSessionStatus(sessionId!, 'interrupted');
      jsonResponse(res, 200, { ok: true });
      return;
    }

    // POST /sessions/:id/stop
    case 'stop': {
      if (!sessionManager.getSession(sessionId!)) {
        sendError(res, 404, `Session ${sessionId} not found`);
        return;
      }
      sessionManager.stopSession(sessionId!);
      sessionManager.updateSessionStatus(sessionId!, 'done');
      jsonResponse(res, 200, { ok: true });
      return;
    }

    default:
      sendError(res, 404, 'Not found');
  }
}

// ============================================================
// TTS 流（与 relay 模式共用）
// ============================================================

function runTtsStream(
  sessionId: string,
  message: string,
  sessionManager: SessionManager,
  sink: TtsSink,
  onEvent?: (event: AgentEvent) => void,
): void {
  const textQueue: string[] = [];
  let resolveNextChunk: ((chunk: string) => void) | null = null;
  let ttsDone = false;

  async function* textStream(): AsyncGenerator<string> {
    while (!ttsDone || textQueue.length > 0) {
      if (textQueue.length > 0) {
        yield textQueue.shift()!;
        continue;
      }
      const resolved = await new Promise<string>((resolve) => {
        resolveNextChunk = resolve;
      });
      if (resolved) {
        yield resolved;
      }
    }
  }

  const handleEvent = (event: AgentEvent) => {
    onEvent?.(event);

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
      if (resolveNextChunk) {
        resolveNextChunk('');
        resolveNextChunk = null;
      }
    }
  };

  sessionManager.setOnEvent(sessionId, handleEvent);
  sessionManager.updateSessionStatus(sessionId, 'running');

  const startedAt = Date.now();

  (async () => {
    try {
      const config = loadConfig();
      const stream = bidirectionTtsStream({
        appkey: config.tts.appkey,
        resourceId: config.tts.resourceId,
        voiceType: config.tts.voiceType,
        texts: textStream(),
        encoding: (config.tts.encoding as any) || 'pcm',
        sampleRate: config.tts.sampleRate || DEFAULT_SAMPLE_RATE,
        onFirstFrame: (at) => {
          log(`[TTS] first frame +${at}ms for session ${sessionId}`);
          if (sink.isOpen()) sink.sendEvent({ type: 'first_frame', at });
        },
        onChunk: (idx, text) => {
          log(`[TTS] chunk #${idx}: "${text.slice(0, 20)}..."`);
          if (sink.isOpen()) {
            sink.sendEvent({ type: 'chunk', index: idx, text, at: Date.now() - startedAt });
          }
        },
      });

      let frameCount = 0;
      let totalBytes = 0;
      stream.on('data', (frame: Buffer) => {
        if (!sink.isOpen()) return;
        frameCount++;
        totalBytes += frame.length;
        if (frameCount <= 3 || frameCount % 50 === 0) {
          log(`[TTS] audio frame #${frameCount} ${frame.length}B (total ${totalBytes}B)`);
        }
        sink.sendAudio(frame);
      });

      await new Promise<void>((resolve, reject) => {
        stream.on('end', () => {
          log(`[TTS] stream end, ${frameCount} frames, ${totalBytes} bytes total`);
          resolve();
        });
        stream.on('error', (err) => {
          log('[TTS] stream error:', err);
          reject(err);
        });
      });

      if (sink.isOpen()) {
        sink.sendEvent({ type: 'end', totalBytes });
      }
    } catch (err) {
      log('[TTS] stream error:', err);
      if (sink.isOpen()) {
        sink.sendEvent({ type: 'error', error: String(err) });
      }
    }
  })();

  sessionManager.sendMessage(sessionId, message).catch((err) => {
    log('[TTS] sendMessage error:', err);
  });
}

// ============================================================
// Relay 模式 —— daemon 作为 Socket.IO client 连到 server
// ============================================================

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

    const loaded = sessionManager.getAllSessions();
    if (loaded.length > 0) {
      socket.emit('daemon:sessions', {
        daemonId,
        sessions: loaded.map((s) => ({ sessionId: s.id, session: s })),
      });
      log(`Reported ${loaded.length} loaded sessions to server`);
    }
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

      ack?.({ session } satisfies SessionCreatedResponse);
      socket.emit('session:created', { session } satisfies SessionCreatedResponse);
    } catch (err: any) {
      ack?.({ error: err.message });
    }
  });

  socket.on('session:send', async (req: SendMessageRequest, ack) => {
    log('session:send (relay)', req);
    try {
      if (!sessionManager.getSession(req.sessionId)) {
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

  // session:history —— server 转发客户端的增量/全量事件拉取
  socket.on('session:history', (req: { sessionId: string; after?: number }, ack) => {
    const events = sessionManager.getEvents(req.sessionId, req.after);
    ack?.({ sessionId: req.sessionId, events });
  });

  socket.on('daemon:tts_start', (req: { sessionId: string; message: string }, ack?: (r: any) => void) => {
    log('daemon:tts_start (relay)', req);
    try {
      if (!sessionManager.getSession(req.sessionId)) {
        ack?.({ error: `Session ${req.sessionId} not found` });
        return;
      }

      const sessionId = req.sessionId;
      const sink: TtsSink = {
        isOpen: () => socket.connected,
        sendAudio: (frame) => {
          if (!socket.connected) return false;
          socket.emit('daemon:tts_audio', { sessionId }, frame as Buffer);
          return true;
        },
        sendEvent: (event) => {
          if (!socket.connected) return false;
          socket.emit('daemon:tts_event', { sessionId, ...event });
          return true;
        },
      };

      const forwardEvent = (event: AgentEvent) => {
        if (!socket.connected) return;
        socket.emit('daemon:session_event', { sessionId, event });
      };

      runTtsStream(sessionId, req.message, sessionManager, sink, forwardEvent);
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
    ack?.({ sessions: sessionManager.getAllSessions() } satisfies SessionListResponse);
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
