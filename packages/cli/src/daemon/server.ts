import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
import { SessionManager } from './session.js';
import { ClaudeAgent } from '../agents/claude.js';
import { TTSManager } from './volcengine/ttsManager.js';
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
} from '@uran/shared';
import { DEFAULT_PORT, getDaemonStatePath, type DaemonState } from './types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';

const LOG_FILE = `${process.env.HOME}/.uran/daemon.log`;

function log(...args: any[]) {
  const msg = `[${new Date().toISOString()}] ${args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' ')}`;
  console.log(msg);
  try {
    mkdirSync(`${process.env.HOME}/.uran`, { recursive: true });
    appendFileSync(LOG_FILE, msg + '\n');
  } catch (e) {
    // ignore
  }
}

function saveDaemonState(state: DaemonState) {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const dir = `${home}/.uran`;
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getDaemonStatePath(), JSON.stringify(state, null, 2));
}

export async function startDaemon(port = DEFAULT_PORT) {
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
            // Forward event to all clients viewing this session
            const response: SessionEventResponse = { sessionId: session.id, event };
            socket.emit('session:event', response);
          },
        });

        // Also listen for session-level events from the agent
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

        // Update status to running
        sessionManager.updateSessionStatus(req.sessionId, 'running');

        // Forward events to client
        sessionManager.setOnEvent(req.sessionId, (event: AgentEvent) => {
          // Log agent response text for debugging
          if (event.type === 'text_delta') {
            log(`[Agent] ${event.data.text}`);
          } else {
            log('event emitted:', event.type);
          }
          const response: SessionEventResponse = { sessionId: req.sessionId, event };
          socket.emit('session:event', response);
        });

        // Send message
        await sessionManager.sendMessage(req.sessionId, req.message);
        ack?.({ ok: true });
      } catch (err: any) {
        ack?.({ error: err.message });
      }
    });

    socket.on('session:voice_reply', async (req: SendVoiceReplyRequest, ack) => {
      log('session:voice_reply', req);
      try {
        const entry = sessionManager.getSession(req.sessionId);
        if (!entry) {
          ack?.({ error: `Session ${req.sessionId} not found` });
          return;
        }

        const ttsManager = new TTSManager({
          appkey: process.env.VOLCENGINE_API_KEY || '',
          resourceId: 'seed-tts-2.0',
          voiceType: 'saturn_zh_female_aojiaonvyou_tob',
          onAudio: (frame: Buffer) => {
            socket.emit('session:voice_audio', {
              sessionId: req.sessionId,
              data: frame.toString('base64'),
            });
          },
          onComplete: () => {
            socket.emit('session:voice_audio', { sessionId: req.sessionId, data: null });
          },
          onError: (err) => {
            log('[TTS] error:', err);
            socket.emit('session:voice_error', { sessionId: req.sessionId, error: err });
          },
        });

        // Connect to TTS (async)
        await ttsManager.connect();

        // Pipe AI text_delta events into TTS
        const handleEvent = (event: AgentEvent) => {
          if (event.type === 'text_delta') {
            ttsManager.feedText(event.data.text);
          }
          const response: SessionEventResponse = { sessionId: req.sessionId, event };
          socket.emit('session:event', response);
        };

        sessionManager.setOnEvent(req.sessionId, handleEvent);
        sessionManager.updateSessionStatus(req.sessionId, 'running');

        // Start AI processing
        sessionManager.sendMessage(req.sessionId, req.message).then(async () => {
          // Wait for AI to finish, then close TTS
          try {
            await ttsManager.finish();
          } catch (err) {
            log('[TTS] finish error:', err);
          }
        });

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
    console.log(`Uran daemon listening on http://localhost:${port}`);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}
