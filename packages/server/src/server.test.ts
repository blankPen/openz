import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';

describe('Server Relay', () => {
  let server: SocketIOServer;
  let httpServer: ReturnType<typeof createServer>;
  let port: number;

  beforeEach(() => {
    port = 19000 + Math.floor(Math.random() * 1000);
  });

  afterEach(() => {
    if (server) {
      server.close();
    }
    if (httpServer) {
      httpServer.close();
    }
  });

  it('starts and accepts connections', async () => {
    httpServer = createServer();
    server = new SocketIOServer(httpServer, { cors: { origin: '*' } });

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        const client = io(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        server.on('connection', (socket) => {
          expect(socket.id).toBeDefined();
          client.disconnect();
          resolve();
        });
      });
    });
  });

  it('daemon can register', async () => {
    httpServer = createServer();
    server = new SocketIOServer(httpServer, { cors: { origin: '*' } });

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        const client = io(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        server.on('connection', (socket) => {
          socket.on('daemon:register', (data: { daemonId: string }) => {
            expect(data.daemonId).toBe('test-daemon');
            socket.emit('daemon:registered', { daemonId: data.daemonId });
          });
        });

        client.on('connect', () => {
          client.emit('daemon:register', { daemonId: 'test-daemon' });
        });

        client.on('daemon:registered', (data: { daemonId: string }) => {
          expect(data.daemonId).toBe('test-daemon');
          client.disconnect();
          resolve();
        });
      });
    });
  });

  it('routes session:create to daemon', async () => {
    httpServer = createServer();
    server = new SocketIOServer(httpServer, { cors: { origin: '*' } });

    await new Promise<void>((resolve) => {
      httpServer.listen(port, () => {
        const client = io(`http://localhost:${port}`, {
          transports: ['websocket'],
          forceNew: true,
        });

        const registeredDaemons = new Set<any>();

        server.on('connection', (socket) => {
          socket.on('daemon:register', (data: { daemonId: string }) => {
            registeredDaemons.add(socket);
            socket.emit('daemon:registered', { daemonId: data.daemonId });
          });

          socket.on('session:create', (data: any, ack: any) => {
            if (registeredDaemons.has(socket)) {
              ack?.({ session: { id: 'session-123', status: 'idle' } });
            }
          });
        });

        client.on('connect', () => {
          client.emit('daemon:register', { daemonId: 'daemon-1' });
        });

        client.on('daemon:registered', () => {
          client.emit('session:create', { cwd: '/tmp' }, (response: any) => {
            expect(response.session).toBeDefined();
            expect(response.session.id).toBe('session-123');
            client.disconnect();
            resolve();
          });
        });
      });
    });
  });
});
