import 'dotenv/config';
import { Server as HTTPServer } from 'http';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
import WebSocket, { WebSocketServer } from 'ws';
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

// Active voice reply WebSocket connections, keyed by sessionId
const voiceWsClients = new Map<string, WebSocket>();

export async function startDaemon(port = DEFAULT_PORT) {
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

    // session:voice_reply — 使用 @openz/speech/server bidirectionTtsStream
    // 音频通过 WebSocket 直发，text_delta 通过 Socket.IO 事件继续上报
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

        // ws is guaranteed non-null here; capture in const for closure safety
        const wsClient = ws;

        // --- 流式并发: AI text_delta 事件实时推入 TTS ---
        const textQueue: string[] = [];
        let resolveNextChunk: ((chunk: string) => void) | null = null;
        let ttsDone = false;

        // 异步生成器: bidirectionTtsStream 的 texts 参数
        // 每次 yield 都会等待 resolveNextChunk 被调用，即等待下一个 text_delta 句子
        async function* textStream(): AsyncGenerator<string> {
          while (!ttsDone || textQueue.length > 0) {
            if (textQueue.length > 0) {
              yield textQueue.shift()!;
            } else {
              // 等待下一个 text_delta 句子到来
              await new Promise<string>((resolve) => {
                resolveNextChunk = resolve;
              });
              if (textQueue.length > 0) {
                yield textQueue.shift()!;
              }
            }
          }
        }

        // 把 text_delta 句子推入队列
        const handleEvent = (event: AgentEvent) => {
          if (event.type === 'text_delta') {
            // 按句子标点切分，实时推入 TTS
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
            // 剩余文本
            const remaining = textQueue.shift();
            if (remaining && resolveNextChunk) {
              resolveNextChunk(remaining);
              resolveNextChunk = null;
            }
          }

          // 继续转发 text_delta 事件给 Socket.IO 客户端
          const response: SessionEventResponse = { sessionId, event };
          socket.emit('session:event', response);
        };

        sessionManager.setOnEvent(sessionId, handleEvent);
        sessionManager.updateSessionStatus(sessionId, 'running');

        const startedAt = Date.now();

        // 使用 bidirectionTtsStream 流式合成
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

            // Drain the stream
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

        // 启动 AI 处理（非阻塞）
        sessionManager.sendMessage(sessionId, req.message).catch((err) => {
          log('[TTS] sendMessage error:', err);
        });

        // 启动 TTS 流（并行）
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
    console.log(`Uran daemon listening on http://localhost:${port}`);
    console.log(`TTS WebSocket endpoint: ws://localhost:${port}/api/tts/ws?sessionId=<sessionId>`);
  });

  // 优雅退出
  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    wss.close();
    httpServer.close();
    process.exit(0);
  });
}
