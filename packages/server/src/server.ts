import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const DEFAULT_PORT = 19998;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 90000; // 90 seconds - daemon considered dead after 3 missed heartbeats
const SESSIONS_DIR = `${process.env.HOME}/.openz`;
const SESSIONS_FILE = join(SESSIONS_DIR, 'sessions.json');

/**
 * Session state persisted to disk for recovery after server restart.
 */
interface SessionState {
  id: string;
  daemonId: string;
  status: string;
  engine: string;
  cwd: string;
  createdAt: number;
  lastActivity: number;
}

/**
 * Registry entry for a connected daemon.
 */
interface DaemonInfo {
  socket: Socket;
  capabilities: string[];
  sessions: Set<string>;
  lastHeartbeat: number;
  sessionIndex: number;
}

// Connected daemons registry
const daemons = new Map<string, DaemonInfo>();

// Session to daemon mapping
const sessionDaemonMap = new Map<string, string>();

// Client to session mapping
const clientSessions = new Map<string, Set<string>>();

// Track socket metadata
const socketMeta = new Map<string, { lastHeartbeat: number; type: 'daemon' | 'client' }>();

// Round-robin counter for daemon selection (reserved for future use)
// let roundRobinIndex = 0;

/**
 * Logs a message with timestamp to stdout and daemon log file.
 */
function log(...args: any[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// ============ Persistence ============

/**
 * Ensures the sessions directory exists.
 */
function ensureSessionsDir() {
  if (!existsSync(SESSIONS_DIR)) {
    mkdirSync(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * Loads all persisted sessions from disk.
 * @returns Array of SessionState objects, empty array if none exist or on error.
 */
function loadSessions(): SessionState[] {
  try {
    if (existsSync(SESSIONS_FILE)) {
      const data = readFileSync(SESSIONS_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (e) {
    log('Failed to load sessions:', e);
  }
  return [];
}

/**
 * Persists all sessions to disk.
 * @param sessions - Array of SessionState to save.
 */
function saveSessions(sessions: SessionState[]) {
  try {
    ensureSessionsDir();
    writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (e) {
    log('Failed to save sessions:', e);
  }
}

/**
 * Updates a specific session's data on disk.
 * @param sessionId - ID of the session to update.
 * @param updates - Partial fields to update.
 */
function updateSessionOnDisk(sessionId: string, updates: Partial<SessionState>) {
  const sessions = loadSessions();
  const index = sessions.findIndex(s => s.id === sessionId);
  if (index !== -1) {
    sessions[index] = { ...sessions[index], ...updates, lastActivity: Date.now() };
    saveSessions(sessions);
  }
}

/**
 * Adds a new session to the persisted state.
 * @param session - SessionState to add.
 */
function addSessionToDisk(session: SessionState) {
  const sessions = loadSessions();
  sessions.push(session);
  saveSessions(sessions);
}

/**
 * Removes a session from the persisted state.
 * @param sessionId - ID of the session to remove.
 */
function removeSessionFromDisk(sessionId: string) {
  const sessions = loadSessions();
  const filtered = sessions.filter(s => s.id !== sessionId);
  saveSessions(filtered);
}

/**
 * Selects an available daemon using least-sessions-first strategy.
 * Only considers daemons with active heartbeats (within HEARTBEAT_TIMEOUT).
 * @returns Tuple of [daemonId, DaemonInfo] or null if no daemon available.
 */
function getAvailableDaemon(): [string, DaemonInfo] | null {
  const daemonEntries = Array.from(daemons.entries()).filter(([, d]) => {
    return Date.now() - d.lastHeartbeat < HEARTBEAT_TIMEOUT;
  });

  if (daemonEntries.length === 0) {
    return null;
  }

  let selected = daemonEntries[0];
  let minSessions = selected[1].sessions.size;

  for (const entry of daemonEntries) {
    if (entry[1].sessions.size < minSessions) {
      selected = entry;
      minSessions = entry[1].sessions.size;
    }
  }

  return selected;
}

/**
 * Collects the IDs of all client sockets subscribed to a given session.
 * Used to fan out per-session events (e.g. TTS audio / control) to the right clients.
 * @param sessionId - The session ID to look up.
 * @returns Array of client socket IDs subscribed to this session.
 */
function collectSubscribedClientIds(sessionId: string): string[] {
  const ids: string[] = [];
  for (const [clientId, sessions] of clientSessions.entries()) {
    if (sessions.has(sessionId)) ids.push(clientId);
  }
  return ids;
}

/**
 * 查找 session 对应的 daemonId，未注册时按发送方 socket 懒注册。
 *
 * 之所以需要懒注册：daemon 重启后会生成新的 daemonId（随机），
 * 磁盘上记录的旧 daemonId 无法匹配。daemon connect 时会上报已加载的
 * sessions（daemon:sessions），但存在网络竞争：web 端可能先发出
 * session:send / tts:start，server 此时还没收到 daemon:sessions。
 * 一旦 daemon 开始回传 session_event / tts_audio / tts_event，
 * 由此函数兜底把 session 绑到当前发送方 daemon。
 */
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

/**
 * Cleans up all sessions associated with a disconnected daemon.
 * Marks sessions as disconnected and notifies clients.
 * @param io - The Socket.IO server instance.
 * @param daemonId - ID of the disconnected daemon.
 */
function cleanupDaemonSessions(io: SocketIOServer, daemonId: string) {
  const daemon = daemons.get(daemonId);
  if (daemon) {
    for (const sessionId of daemon.sessions) {
      sessionDaemonMap.delete(sessionId);
      // Update disk - mark session as disconnected
      updateSessionOnDisk(sessionId, { status: 'disconnected' });
      // Notify clients that session is gone
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

/**
 * Starts the Openz relay server.
 * Accepts WebSocket connections from both clients and daemons.
 * Routes messages between clients and daemons, manages session persistence.
 *
 * @param port - Port to listen on (default: 19998)
 */
export async function startServer(port = DEFAULT_PORT) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  log(`Openz Server starting on port ${port}`);

  // Load persisted sessions
  const persistedSessions = loadSessions();
  log(`Loaded ${persistedSessions.length} persisted sessions`);

  // Heartbeat check loop - pings daemons and disconnects stale ones
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();

    for (const [daemonId, daemon] of daemons.entries()) {
      const timeSinceLastHeartbeat = now - daemon.lastHeartbeat;
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        log(`Daemon ${daemonId} heartbeat timeout (${timeSinceLastHeartbeat}ms), disconnecting`);
        cleanupDaemonSessions(io, daemonId);
        daemon.socket.disconnect();
      } else {
        daemon.socket.emit('daemon:ping', { timestamp: now });
      }
    }
  }, HEARTBEAT_INTERVAL);

  // Handle incoming connections
  io.on('connection', (socket: Socket) => {
    log(`Connection: ${socket.id}`);
    socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'daemon' });

    // Daemon registration
    socket.on('daemon:register', (data: { daemonId: string; capabilities?: string[] }) => {
      log(`Daemon registered: ${data.daemonId}`);
      daemons.set(data.daemonId, {
        socket,
        capabilities: data.capabilities || [],
        sessions: new Set(),
        lastHeartbeat: Date.now(),
        sessionIndex: 0,
      });
      socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'daemon' });

      socket.emit('daemon:registered', { daemonId: data.daemonId });
      log(`Daemon ${data.daemonId} registered, total daemons: ${daemons.size}`);

      // Restore sessions for this daemon from disk
      const sessions = loadSessions();
      const daemonSessions = sessions.filter(s => s.daemonId === data.daemonId && s.status !== 'disconnected');
      for (const session of daemonSessions) {
        daemons.get(data.daemonId)?.sessions.add(session.id);
        sessionDaemonMap.set(session.id, data.daemonId);
      }
      log(`Restored ${daemonSessions.length} sessions for daemon ${data.daemonId}`);
    });

    // Daemon heartbeat response
    socket.on('daemon:pong', (data: { timestamp: number }) => {
      const daemonEntry = Array.from(daemons.entries()).find(([, d]) => d.socket.id === socket.id);
      if (daemonEntry) {
        daemonEntry[1].lastHeartbeat = Date.now();
        log(`Daemon ${daemonEntry[0]} heartbeat OK (${data.timestamp})`);
      }
    });

    // Daemon announces a new session
    socket.on('daemon:session_created', (data: { daemonId: string; sessionId: string; session?: any }) => {
      const daemon = daemons.get(data.daemonId);
      if (daemon) {
        daemon.sessions.add(data.sessionId);
        sessionDaemonMap.set(data.sessionId, data.daemonId);

        // Persist session to disk
        if (data.session) {
          addSessionToDisk({
            id: data.sessionId,
            daemonId: data.daemonId,
            status: data.session.status || 'idle',
            engine: data.session.engine || 'claude',
            cwd: data.session.cwd || '',
            createdAt: data.session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
        }

        log(`Session ${data.sessionId} registered to daemon ${data.daemonId}`);
      }
    });

    // Daemon 上报本地已加载的 session（connect 时一次性发送）
    socket.on('daemon:sessions', (data: { daemonId: string; sessions: Array<{ sessionId: string; session?: any }> }) => {
      const daemon = daemons.get(data.daemonId);
      if (!daemon) {
        log(`daemon:sessions from unknown daemon ${data.daemonId}, ignored`);
        return;
      }
      let registered = 0;
      for (const { sessionId, session } of data.sessions) {
        if (sessionDaemonMap.has(sessionId)) continue;
        sessionDaemonMap.set(sessionId, data.daemonId);
        daemon.sessions.add(sessionId);
        if (session) {
          addSessionToDisk({
            id: sessionId,
            daemonId: data.daemonId,
            status: session.status || 'idle',
            engine: session.engine || 'claude',
            cwd: session.cwd || '',
            createdAt: session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });
        }
        registered++;
      }
      log(`daemon:sessions: registered ${registered} new sessions for ${data.daemonId}`);
    });

    // Daemon sends session event to relay to client
    socket.on('daemon:session_event', (data: { sessionId: string; event: any }) => {
      const daemonId = resolveOrRegisterDaemonId(data.sessionId, socket);
      if (daemonId) {
        io.emit('session:event', {
          sessionId: data.sessionId,
          event: data.event,
        });

        // Update session status on disk if status changed
        if (data.event.type === 'session_init' || data.event.type === 'message_start') {
          updateSessionOnDisk(data.sessionId, { status: 'running' });
        }
      }
    });

    // Daemon forwards TTS PCM frame (binary) to subscribed web clients
    socket.on('daemon:tts_audio', (meta: { sessionId: string }, buffer: Buffer) => {
      const daemonId = resolveOrRegisterDaemonId(meta.sessionId, socket);
      if (!daemonId) return;
      const subscribed = collectSubscribedClientIds(meta.sessionId);
      if (subscribed.length === 0) return;
      for (const clientId of subscribed) {
        io.to(clientId).emit('tts:audio', { sessionId: meta.sessionId }, buffer);
      }
    });

    // Daemon forwards TTS control event (first_frame / chunk / end / error)
    socket.on('daemon:tts_event', (data: { sessionId: string; type: string; [k: string]: any }) => {
      const daemonId = resolveOrRegisterDaemonId(data.sessionId, socket);
      if (!daemonId) return;
      const subscribed = collectSubscribedClientIds(data.sessionId);
      if (subscribed.length === 0) return;
      for (const clientId of subscribed) {
        io.to(clientId).emit('tts:event', data);
      }
    });

    // Client heartbeat
    socket.on('client:ping', () => {
      const meta = socketMeta.get(socket.id);
      if (meta) {
        meta.lastHeartbeat = Date.now();
      }
      socket.emit('client:pong');
    });

    // Client requests session creation - routed to available daemon
    socket.on('session:create', (data: any, ack) => {
      log(`Client requesting session:create`, data);
      socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'client' });

      const daemon = getAvailableDaemon();
      if (!daemon) {
        ack?.({ error: 'No daemon available' });
        return;
      }

      const [daemonId, daemonInfo] = daemon;
      daemonInfo.socket.emit('session:create', data, (response: any) => {
        if (response.session) {
          daemonInfo.sessions.add(response.session.id);
          sessionDaemonMap.set(response.session.id, daemonId);

          // Persist new session
          addSessionToDisk({
            id: response.session.id,
            daemonId,
            status: response.session.status || 'idle',
            engine: response.session.engine || 'claude',
            cwd: response.session.cwd || '',
            createdAt: response.session.createdAt || Date.now(),
            lastActivity: Date.now(),
          });

          const clientSockets = clientSessions.get(socket.id) || new Set();
          clientSockets.add(response.session.id);
          clientSessions.set(socket.id, clientSockets);
        }
        ack?.(response);
      });
    });

    // Client sends message to session
    socket.on('session:send', (data: { sessionId: string; message: string }, ack) => {
      log(`Client sending to session: ${data.sessionId}`);
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;

      if (!daemon) {
        ack?.({ error: `Session ${data.sessionId} not found or daemon unavailable` });
        return;
      }

      daemon.socket.emit('session:send', data, (response: any) => {
        ack?.(response);
      });
    });

    // Client interrupts session
    socket.on('session:interrupt', (data: { sessionId: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;

      if (daemon) {
        daemon.socket.emit('session:interrupt', data, (response: any) => {
          updateSessionOnDisk(data.sessionId, { status: 'interrupted' });
          ack?.(response);
        });
      } else {
        ack?.({ error: 'Session not found' });
      }
    });

    // Client stops session
    socket.on('session:stop', (data: { sessionId: string }, ack) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;

      if (daemon) {
        daemon.socket.emit('session:stop', data, (response: any) => {
          updateSessionOnDisk(data.sessionId, { status: 'done' });
          ack?.(response);
        });
      } else {
        ack?.({ error: 'Session not found' });
      }
    });

    // Client lists all sessions
    socket.on('session:list', (_, ack) => {
      const daemonEntries = Array.from(daemons.entries());
      const allSessions: any[] = [];

      let completed = 0;
      if (daemonEntries.length === 0) {
        // Return persisted sessions when no daemons connected
        const persisted = loadSessions();
        ack?.({ sessions: persisted });
        return;
      }

      daemonEntries.forEach(([daemonId, daemon]) => {
        daemon.socket.emit('session:list', {}, (response: any) => {
          if (response.sessions) {
            allSessions.push(...response.sessions.map((s: any) => ({
              ...s,
              daemonId,
            })));
          }
          completed++;
          if (completed === daemonEntries.length) {
            ack?.({ sessions: allSessions });
          }
        });
      });
    });

    // Client deletes session
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
        // Session not found, also remove from disk
        removeSessionFromDisk(data.sessionId);
        ack?.({ error: 'Session not found' });
      }
    });

    // Client requests voice reply — forward to daemon owning the session
    socket.on('tts:start', (data: { sessionId: string; message: string }, ack) => {
      log(`Client requesting tts:start for session ${data.sessionId}`);
      const daemonId = sessionDaemonMap.get(data.sessionId);
      const daemon = daemonId ? daemons.get(daemonId) : null;

      if (!daemon) {
        ack?.({ error: `Session ${data.sessionId} not found or daemon unavailable` });
        return;
      }

      // Make sure the requesting client is in the subscription set so it receives
      // the daemon's tts:audio / tts:event fan-out.
      const set = clientSessions.get(socket.id) || new Set<string>();
      set.add(data.sessionId);
      clientSessions.set(socket.id, set);

      daemon.socket.emit('daemon:tts_start', data, (response: any) => {
        ack?.(response);
      });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      log(`Disconnected: ${socket.id}`);
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

  httpServer.listen(port, () => {
    log(`Openz Server listening on http://localhost:${port}`);
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    log('Shutting down...');
    clearInterval(heartbeatInterval);
    io.close();
    httpServer.close();
    process.exit(0);
  });
}
