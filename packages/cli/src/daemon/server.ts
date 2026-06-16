import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import { io, Socket as ClientSocket } from 'socket.io-client';
import { SessionManager } from './session.js';
import { ClaudeAgent } from '../agents/claude.js';
import type {
  CreateSessionRequest,
  SendMessageRequest,
  SessionRequest,
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
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}

async function startDaemonRelayMode(daemonId: string, serverUrl: string) {
  const agent = new ClaudeAgent();
  const sessionManager = new SessionManager(agent);

  // Connect to the remote server
  const socket: ClientSocket = io(serverUrl, {
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });

  // Save daemon state
  const state: DaemonState = {
    pid: process.pid,
    port: 0, // Not listening locally in relay mode
    version: '0.1.0',
    startedAt: Date.now(),
  };
  saveDaemonState(state);

  socket.on('connect', () => {
    log(`Connected to Openz Server: ${serverUrl}`);
    console.log(`Openz daemon connected to server: ${serverUrl}`);

    // Register with the server
    socket.emit('daemon:register', { daemonId });
  });

  socket.on('daemon:registered', (data: { daemonId: string }) => {
    log(`Registered with server as: ${data.daemonId}`);
    console.log(`Daemon registered with server: ${data.daemonId}`);
  });

  // Respond to server heartbeat pings
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
          // Forward event to server
          socket.emit('daemon:session_event', { sessionId: session.id, event });
        },
      });

      sessionManager.setOnEvent(session.id, (event: AgentEvent) => {
        socket.emit('daemon:session_event', { sessionId: session.id, event });
      });

      // Notify server of new session
      socket.emit('daemon:session_created', { daemonId, sessionId: session.id });

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

  // Keep process alive
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    socket.disconnect();
    process.exit(0);
  });
}
