import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer, type IncomingMessage, type ServerResponse } from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_PORT = 19998;
const HEARTBEAT_INTERVAL = 30000;
const HEARTBEAT_TIMEOUT = 90000;
const SESSIONS_DIR = `${process.env.HOME}/.openz`;
const SESSIONS_FILE = join(SESSIONS_DIR, 'sessions.json');

// ============================================================
// 类型
// ============================================================

interface SessionState {
  id: string;
  daemonId: string;
  status: string;
  engine: string;
  cwd: string;
  createdAt: number;
  lastActivity: number;
}

interface DaemonInfo {
  socket: Socket;
  capabilities: string[];
  sessions: Set<string>;
  lastHeartbeat: number;
  sessionIndex: number;
}

// ============================================================
// 全局状态
// ============================================================

const daemons = new Map<string, DaemonInfo>();
const sessionDaemonMap = new Map<string, string>();
const clientSessions = new Map<string, Set<string>>();
const socketMeta = new Map<string, { lastHeartbeat: number; type: 'daemon' | 'client' }>();

// ============================================================
// 工具
// ============================================================

function log(...args: any[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

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

function matchHttpRoute(method: string, path: string): { route: string; sessionId?: string } | null {
  if (method === 'GET' && path === '/sessions') return { route: 'list' };
  if (method === 'POST' && path === '/sessions') return { route: 'create' };

  const deleteMatch = method === 'DELETE' && path.match(/^\/sessions\/([^/]+)$/);
  if (deleteMatch) return { route: 'delete', sessionId: deleteMatch[1] };

  const eventsMatch = method === 'GET' && path.match(/^\/sessions\/([^/]+)\/events$/);
  if (eventsMatch) return { route: 'events', sessionId: eventsMatch[1] };

  const sendMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/send$/);
  if (sendMatch) return { route: 'send', sessionId: sendMatch[1] };

  const interruptMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/interrupt$/);
  if (interruptMatch) return { route: 'interrupt', sessionId: interruptMatch[1] };

  const stopMatch = method === 'POST' && path.match(/^\/sessions\/([^/]+)\/stop$/);
  if (stopMatch) return { route: 'stop', sessionId: stopMatch[1] };

  return null;
}

// ============================================================
// 持久化
// ============================================================

function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) mkdirSync(SESSIONS_DIR, { recursive: true });
}

function loadSessions(): SessionState[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      return JSON.parse(readFileSync(SESSIONS_FILE, 'utf-8'));
    }
  } catch (e) { log('Failed to load sessions:', e); }
  return [];
}

function saveSessions(sessions: SessionState[]) {
  try {
    ensureSessionsDir();
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) { log('Failed to save sessions:', e); }
}

function updateSessionOnDisk(sessionId: string, updates: Partial<SessionState>) {
  const sessions = loadSessions();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx !== -1) {
    sessions[idx] = { ...sessions[idx], ...updates, lastActivity: Date.now() };
    saveSessions(sessions);
  }
}

function addSessionToDisk(s: SessionState) {
  const sessions = loadSessions();
  sessions.push(s);
  saveSessions(sessions);
}

function removeSessionFromDisk(sessionId: string) {
  saveSessions(loadSessions().filter(s => s.id !== sessionId));
}

// ============================================================
// Daemon 选择
// ============================================================

function getAvailableDaemon(): [string, DaemonInfo] | null {
  const entries = Array.from(daemons.entries()).filter(([, d]) =>
    Date.now() - d.lastHeartbeat < HEARTBEAT_TIMEOUT,
  );
  if (entries.length === 0) return null;
  let best = entries[0];
  for (const e of entries) {
    if (e[1].sessions.size < best[1].sessions.size) best = e;
  }
  return best;
}

function resolveOrRegisterDaemonId(sessionId: string, fromSocket: Socket): string | null {
  const known = sessionDaemonMap.get(sessionId);
  if (known) return known;
  for (const [daemonId, daemon] of daemons.entries()) {
    if (daemon.socket.id === fromSocket.id) {
      sessionDaemonMap.set(sessionId, daemonId);
      daemon.sessions.add(sessionId);
      log(`Lazy-registered session ${sessionId} to daemon ${daemonId}`);
      return daemonId;
    }
  }
  return null;
}

function collectSubscribedClientIds(sessionId: string): string[] {
  const ids: string[] = [];
  for (const [clientId, sessions] of clientSessions.entries()) {
    if (sessions.has(sessionId)) ids.push(clientId);
  }
  return ids;
}

function cleanupDaemonSessions(io: SocketIOServer, daemonId: string) {
  const daemon = daemons.get(daemonId);
  if (daemon) {
    for (const sessionId of daemon.sessions) {
      sessionDaemonMap.delete(sessionId);
      updateSessionOnDisk(sessionId, { status: 'disconnected' });
      io.emit('session:event', {
        sessionId,
        event: {
          type: 'error',
          sessionId,
          data: { error: 'Daemon disconnected' },
        },
      });
    }
  }
  daemons.delete(daemonId);
  log(`Daemon ${daemonId} cleaned up`);
}

// ============================================================
// 服务启动
// ============================================================

export async function startServer(port = DEFAULT_PORT) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, { cors: { origin: '*' } });

  log(`Openz Server starting on port ${port}`);

  const persistedSessions = loadSessions();
  log(`Loaded ${persistedSessions.length} persisted sessions`);

  // ---- Heartbeat ----
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [daemonId, daemon] of daemons.entries()) {
      if (now - daemon.lastHeartbeat > HEARTBEAT_TIMEOUT) {
        log(`Daemon ${daemonId} heartbeat timeout, disconnecting`);
        cleanupDaemonSessions(io, daemonId);
        daemon.socket.disconnect();
      } else {
        daemon.socket.emit('daemon:ping', { timestamp: now });
      }
    }
  }, HEARTBEAT_INTERVAL);

  // ---- HTTP REST + SSE 路由 ----
  httpServer.on('request', async (req, res) => {
    if (req.url?.startsWith('/socket.io')) return;

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
      await handleHttpRoute(route, url, req, res, io);
    } catch (err: any) {
      log('[HTTP] error:', err.message);
      sendError(res, 500, err.message || 'Internal error');
    }
  });

  // ---- Socket.IO relay ----
  io.on('connection', (socket: Socket) => {
    log(`Connection: ${socket.id}`);
    socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'daemon' });

    // Daemon register
    socket.on('daemon:register', (data: { daemonId: string; capabilities?: string[] }) => {
      log(`Daemon registered: ${data.daemonId}`);
      daemons.set(data.daemonId, {
        socket, capabilities: data.capabilities || [],
        sessions: new Set(), lastHeartbeat: Date.now(), sessionIndex: 0,
      });
      socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'daemon' });
      socket.emit('daemon:registered', { daemonId: data.daemonId });

      const sessions = loadSessions();
      for (const s of sessions) {
        if (s.daemonId === data.daemonId && s.status !== 'disconnected') {
          daemons.get(data.daemonId)?.sessions.add(s.id);
          sessionDaemonMap.set(s.id, data.daemonId);
        }
      }
      log(`Daemon ${data.daemonId} registered, total daemons: ${daemons.size}`);
    });

    // Heartbeat
    socket.on('daemon:pong', () => {
      const entry = Array.from(daemons.entries()).find(([, d]) => d.socket.id === socket.id);
      if (entry) entry[1].lastHeartbeat = Date.now();
    });

    // Session created by daemon
    socket.on('daemon:session_created', (data: { daemonId: string; sessionId: string; session?: any }) => {
      const daemon = daemons.get(data.daemonId);
      if (daemon) {
        daemon.sessions.add(data.sessionId);
        sessionDaemonMap.set(data.sessionId, data.daemonId);
        if (data.session) {
          addSessionToDisk({
            id: data.sessionId, daemonId: data.daemonId,
            status: data.session.status || 'idle',
            engine: data.session.engine || 'claude',
            cwd: data.session.cwd || '',
            createdAt: data.session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
        }
      }
    });

    // Daemon reports loaded sessions
    socket.on('daemon:sessions', (data: { daemonId: string; sessions: Array<{ sessionId: string; session?: any }> }) => {
      const daemon = daemons.get(data.daemonId);
      if (!daemon) return;
      for (const { sessionId, session } of data.sessions) {
        if (sessionDaemonMap.has(sessionId)) continue;
        sessionDaemonMap.set(sessionId, data.daemonId);
        daemon.sessions.add(sessionId);
        if (session) {
          addSessionToDisk({
            id: sessionId, daemonId: data.daemonId,
            status: session.status || 'idle',
            engine: session.engine || 'claude',
            cwd: session.cwd || '',
            createdAt: session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
        }
      }
    });

    // Daemon session event → relay to Socket.IO clients
    socket.on('daemon:session_event', (data: { sessionId: string; event: any }) => {
      if (resolveOrRegisterDaemonId(data.sessionId, socket)) {
        io.emit('session:event', { sessionId: data.sessionId, event: data.event });
        if (data.event.type === 'session_init' || data.event.type === 'message_start') {
          updateSessionOnDisk(data.sessionId, { status: 'running' });
        }
      }
    });

    // TTS audio relay
    socket.on('daemon:tts_audio', (meta: { sessionId: string }, buffer: Buffer) => {
      if (!resolveOrRegisterDaemonId(meta.sessionId, socket)) return;
      for (const clientId of collectSubscribedClientIds(meta.sessionId)) {
        io.to(clientId).emit('tts:audio', { sessionId: meta.sessionId }, buffer);
      }
    });

    // TTS event relay
    socket.on('daemon:tts_event', (data: { sessionId: string; type: string; [k: string]: any }) => {
      if (!resolveOrRegisterDaemonId(data.sessionId, socket)) return;
      for (const clientId of collectSubscribedClientIds(data.sessionId)) {
        io.to(clientId).emit('tts:event', data);
      }
    });

    // Client heartbeat
    socket.on('client:ping', () => {
      const meta = socketMeta.get(socket.id);
      if (meta) meta.lastHeartbeat = Date.now();
      socket.emit('client:pong');
    });

    // ---- Socket.IO 会话操作 (向后兼容 web 端) ----

    socket.on('session:create', (data: any, ack) => {
      log(`Client requesting session:create`, data);
      socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'client' });
      const daemon = getAvailableDaemon();
      if (!daemon) { ack?.({ error: 'No daemon available' }); return; }
      const [daemonId, daemonInfo] = daemon;

      daemonInfo.socket.emit('session:create', data, (response: any) => {
        if (response.session) {
          daemonInfo.sessions.add(response.session.id);
          sessionDaemonMap.set(response.session.id, daemonId);
          addSessionToDisk({
            id: response.session.id, daemonId,
            status: response.session.status || 'idle',
            engine: response.session.engine || 'claude',
            cwd: response.session.cwd || '',
            createdAt: response.session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
          const set = clientSessions.get(socket.id) || new Set<string>();
          set.add(response.session.id);
          clientSessions.set(socket.id, set);
        }
        ack?.(response);
      });
    });

    socket.on('session:send', (data: { sessionId: string; message: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { ack?.({ error: `Session ${data.sessionId} not found` }); return; }
      daemon.socket.emit('session:send', data, (response: any) => ack?.(response));
    });

    socket.on('session:interrupt', (data: { sessionId: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (daemon) {
        daemon.socket.emit('session:interrupt', data, (response: any) => {
          updateSessionOnDisk(data.sessionId, { status: 'interrupted' });
          ack?.(response);
        });
      } else { ack?.({ error: 'Session not found' }); }
    });

    socket.on('session:stop', (data: { sessionId: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (daemon) {
        daemon.socket.emit('session:stop', data, (response: any) => {
          updateSessionOnDisk(data.sessionId, { status: 'done' });
          ack?.(response);
        });
      } else { ack?.({ error: 'Session not found' }); }
    });

    socket.on('session:list', (_, ack) => {
      const entries = Array.from(daemons.entries());
      if (entries.length === 0) {
        ack?.({ sessions: loadSessions() });
        return;
      }
      const all: any[] = [];
      let done = 0;
      entries.forEach(([daemonId, daemon]) => {
        daemon.socket.emit('session:list', {}, (response: any) => {
          if (response.sessions) {
            all.push(...response.sessions.map((s: any) => ({ ...s, daemonId })));
          }
          if (++done === entries.length) ack?.({ sessions: all });
        });
      });
    });

    socket.on('session:delete', (data: { sessionId: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (daemon) {
        daemon.socket.emit('session:delete', data, (response: any) => {
          if (response.ok) {
            daemon.sessions.delete(data.sessionId);
            sessionDaemonMap.delete(data.sessionId);
            removeSessionFromDisk(data.sessionId);
          }
          ack?.(response);
        });
      } else {
        removeSessionFromDisk(data.sessionId);
        ack?.({ error: 'Session not found' });
      }
    });

    // TTS via Socket.IO
    socket.on('tts:start', (data: { sessionId: string; message: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { ack?.({ error: `Session ${data.sessionId} not found` }); return; }
      const set = clientSessions.get(socket.id) || new Set<string>();
      set.add(data.sessionId);
      clientSessions.set(socket.id, set);
      daemon.socket.emit('daemon:tts_start', data, (response: any) => ack?.(response));
    });

    // Disconnect
    socket.on('disconnect', () => {
      const meta = socketMeta.get(socket.id);
      if (meta?.type === 'daemon') {
        for (const [daemonId, daemon] of daemons.entries()) {
          if (daemon.socket.id === socket.id) {
            cleanupDaemonSessions(io, daemonId);
            break;
          }
        }
      }
      clientSessions.delete(socket.id);
      socketMeta.delete(socket.id);
    });
  });

  // ---- 启动 ----
  httpServer.listen(port, () => {
    log(`Openz Server listening on http://localhost:${port}`);
  });

  process.on('SIGINT', () => {
    log('Shutting down...');
    clearInterval(heartbeatInterval);
    io.close();
    httpServer.close();
    process.exit(0);
  });
}

// ============================================================
// HTTP 路由处理（协议转换：HTTP ↔ Socket.IO relay）
// ============================================================

async function handleHttpRoute(
  route: { route: string; sessionId?: string },
  url: URL,
  req: IncomingMessage,
  res: ServerResponse,
  _io: SocketIOServer,
) {
  const { route: routeName, sessionId } = route;

  switch (routeName) {
    // GET /sessions
    case 'list': {
      const entries = Array.from(daemons.entries());
      if (entries.length === 0) {
        jsonResponse(res, 200, { sessions: loadSessions() });
        return;
      }
      const results = await Promise.all(entries.map(([daemonId, daemon]) =>
        new Promise<any[]>((resolve) => {
          daemon.socket.emit('session:list', {}, (response: any) => {
            resolve((response.sessions || []).map((s: any) => ({ ...s, daemonId })));
          });
        }),
      ));
      jsonResponse(res, 200, { sessions: results.flat() });
      return;
    }

    // POST /sessions
    case 'create': {
      const daemon = getAvailableDaemon();
      if (!daemon) { sendError(res, 503, 'No daemon available'); return; }
      const [daemonId, daemonInfo] = daemon;
      const body = JSON.parse(await readBody(req));

      daemonInfo.socket.emit('session:create', body, (response: any) => {
        if (response.error) { sendError(res, 400, response.error); return; }
        if (response.session) {
          daemonInfo.sessions.add(response.session.id);
          sessionDaemonMap.set(response.session.id, daemonId);
          addSessionToDisk({
            id: response.session.id, daemonId,
            status: response.session.status || 'idle',
            engine: response.session.engine || 'claude',
            cwd: response.session.cwd || '',
            createdAt: response.session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
        }
        jsonResponse(res, 201, response.session || response);
      });
      return;
    }

    // DELETE /sessions/:id
    case 'delete': {
      const daemonId = sessionDaemonMap.get(sessionId!);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) {
        removeSessionFromDisk(sessionId!);
        sendError(res, 404, 'Session not found');
        return;
      }
      daemon.socket.emit('session:delete', { sessionId: sessionId! }, (response: any) => {
        if (response?.ok) {
          daemon.sessions.delete(sessionId!);
          sessionDaemonMap.delete(sessionId!);
          removeSessionFromDisk(sessionId!);
        }
        jsonResponse(res, 200, response || { ok: true });
      });
      return;
    }

    // GET /sessions/:id/events?after=<seq>
    case 'events': {
      const daemonId = sessionDaemonMap.get(sessionId!);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { sendError(res, 404, 'Session not found'); return; }

      const afterParam = url.searchParams.get('after');
      daemon.socket.emit('session:history',
        { sessionId: sessionId!, after: afterParam ? Number(afterParam) : undefined },
        (response: any) => {
          jsonResponse(res, 200, response || { sessionId: sessionId!, events: [] });
        },
      );
      return;
    }

    // POST /sessions/:id/send → SSE 流
    case 'send': {
      const body = JSON.parse(await readBody(req));
      const message: string = body.message;
      if (!message?.trim()) { sendError(res, 400, 'message is required'); return; }

      const daemonId = sessionDaemonMap.get(sessionId!);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { sendError(res, 404, `Session ${sessionId} not found`); return; }

      // SSE 响应头
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });

      let ended = false;
      const end = () => { if (!ended) { ended = true; res.end(); } };
      req.on('close', () => { end(); });

      // 监听 daemon 返回的 session_event，转成 SSE
      const eventHandler = (data: { sessionId: string; event: any }) => {
        if (data.sessionId !== sessionId || ended) return;
        res.write(`event: ${data.event.type}\ndata: ${JSON.stringify(data.event)}\n\n`);
        if (data.event.type === 'turn_done' || data.event.type === 'error') {
          cleanup();
        }
      };

      const cleanup = () => {
        daemon.socket.off('daemon:session_event', eventHandler);
        end();
      };
      req.on('close', cleanup);

      daemon.socket.on('daemon:session_event', eventHandler);

      // 转发 send 请求到 daemon
      daemon.socket.emit('session:send', { sessionId: sessionId!, message: message.trim() }, (ack: any) => {
        if (ack?.error) {
          res.write(`event: error\ndata: ${JSON.stringify({ error: ack.error })}\n\n`);
          cleanup();
        }
      });
      return;
    }

    // POST /sessions/:id/interrupt
    case 'interrupt': {
      const daemonId = sessionDaemonMap.get(sessionId!);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { sendError(res, 404, 'Session not found'); return; }
      daemon.socket.emit('session:interrupt', { sessionId: sessionId! }, (response: any) => {
        updateSessionOnDisk(sessionId!, { status: 'interrupted' });
        jsonResponse(res, 200, response || { ok: true });
      });
      return;
    }

    // POST /sessions/:id/stop
    case 'stop': {
      const daemonId = sessionDaemonMap.get(sessionId!);
      const daemon = daemonId ? daemons.get(daemonId) : null;
      if (!daemon) { sendError(res, 404, 'Session not found'); return; }
      daemon.socket.emit('session:stop', { sessionId: sessionId! }, (response: any) => {
        updateSessionOnDisk(sessionId!, { status: 'done' });
        jsonResponse(res, 200, response || { ok: true });
      });
      return;
    }

    default:
      sendError(res, 404, 'Not found');
  }
}
