import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';

const DEFAULT_PORT = 19998;
const HEARTBEAT_INTERVAL = 30000; // 30 seconds
const HEARTBEAT_TIMEOUT = 90000; // 90 seconds - daemon considered dead after 3 missed heartbeats

// Connected daemons registry
interface DaemonInfo {
  socket: Socket;
  capabilities: string[];
  sessions: Set<string>;
  lastHeartbeat: number;
  // Round-robin index for this daemon's sessions
  sessionIndex: number;
}
const daemons = new Map<string, DaemonInfo>();

// Session to daemon mapping
const sessionDaemonMap = new Map<string, string>();

// Client to session mapping
const clientSessions = new Map<string, Set<string>>();

// Track socket metadata
const socketMeta = new Map<string, { lastHeartbeat: number; type: 'daemon' | 'client' }>();

// Round-robin counter for daemon selection
let roundRobinIndex = 0;

function log(...args: any[]) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

function getAvailableDaemon(): [string, DaemonInfo] | null {
  const daemonEntries = Array.from(daemons.entries()).filter(([, d]) => {
    // Only select daemons with active heartbeat
    return Date.now() - d.lastHeartbeat < HEARTBEAT_TIMEOUT;
  });

  if (daemonEntries.length === 0) {
    return null;
  }

  // Round-robin: pick daemon with least sessions, or round-robin if equal
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

function cleanupDaemonSessions(io: SocketIOServer, daemonId: string) {
  const daemon = daemons.get(daemonId);
  if (daemon) {
    for (const sessionId of daemon.sessions) {
      sessionDaemonMap.delete(sessionId);
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

export async function startServer(port = DEFAULT_PORT) {
  const httpServer = createServer();
  const io = new SocketIOServer(httpServer, {
    cors: { origin: '*' },
  });

  log(`Openz Server starting on port ${port}`);

  // Heartbeat check loop
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();

    // Check daemons
    for (const [daemonId, daemon] of daemons.entries()) {
      const timeSinceLastHeartbeat = now - daemon.lastHeartbeat;
      if (timeSinceLastHeartbeat > HEARTBEAT_TIMEOUT) {
        log(`Daemon ${daemonId} heartbeat timeout (${timeSinceLastHeartbeat}ms), disconnecting`);
        cleanupDaemonSessions(io, daemonId);
        daemon.socket.disconnect();
      } else {
        // Send ping to daemon
        daemon.socket.emit('daemon:ping', { timestamp: now });
      }
    }
  }, HEARTBEAT_INTERVAL);

  // Handle connections
  io.on('connection', (socket: Socket) => {
    log(`Connection: ${socket.id}`);
    socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'daemon' });

    // Daemon registers with the server
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

      // Send acknowledgment to daemon
      socket.emit('daemon:registered', { daemonId: data.daemonId });
      log(`Daemon ${data.daemonId} registered, total daemons: ${daemons.size}`);
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
    socket.on('daemon:session_created', (data: { daemonId: string; sessionId: string }) => {
      const daemon = daemons.get(data.daemonId);
      if (daemon) {
        daemon.sessions.add(data.sessionId);
        sessionDaemonMap.set(data.sessionId, data.daemonId);
        log(`Session ${data.sessionId} registered to daemon ${data.daemonId}`);
      }
    });

    // Daemon sends session event to relay to client
    socket.on('daemon:session_event', (data: { sessionId: string; event: any }) => {
      const daemonId = sessionDaemonMap.get(data.sessionId);
      if (daemonId) {
        // Broadcast to all clients connected to this session
        io.emit('session:event', {
          sessionId: data.sessionId,
          event: data.event,
        });
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

    // Client creates a session (relay to daemon)
    socket.on('session:create', (data: any, ack) => {
      log(`Client requesting session:create`, data);
      socketMeta.set(socket.id, { lastHeartbeat: Date.now(), type: 'client' });

      // Get available daemon using least-loaded selection
      const daemon = getAvailableDaemon();
      if (!daemon) {
        ack?.({ error: 'No daemon available' });
        return;
      }

      const [daemonId, daemonInfo] = daemon;
      daemonInfo.socket.emit('session:create', data, (response: any) => {
        if (response.session) {
          // Register session mapping
          daemonInfo.sessions.add(response.session.id);
          sessionDaemonMap.set(response.session.id, daemonId);

          // Track client's sessions
          const clientSockets = clientSessions.get(socket.id) || new Set();
          clientSockets.add(response.session.id);
          clientSessions.set(socket.id, clientSockets);
        }
        ack?.(response);
      });
    });

    // Client sends message to session (relay to daemon)
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
          ack?.(response);
        });
      } else {
        ack?.({ error: 'Session not found' });
      }
    });

    // Client lists sessions
    socket.on('session:list', (_, ack) => {
      const daemonEntries = Array.from(daemons.entries());
      const allSessions: any[] = [];

      // Collect sessions from all daemons
      let completed = 0;
      if (daemonEntries.length === 0) {
        ack?.({ sessions: [] });
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
          }
          ack?.(response);
        });
      } else {
        ack?.({ error: 'Session not found' });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      log(`Disconnected: ${socket.id}`);
      const meta = socketMeta.get(socket.id);

      if (meta?.type === 'daemon') {
        // Find and clean up the daemon
        for (const [daemonId, daemon] of daemons.entries()) {
          if (daemon.socket.id === socket.id) {
            cleanupDaemonSessions(io, daemonId);
            break;
          }
        }
      }

      // Clean up client's sessions
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
