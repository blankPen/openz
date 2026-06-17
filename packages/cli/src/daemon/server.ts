import 'dotenv/config';
import { Server as SocketIOServer, type Socket } from 'socket.io';
import { createServer } from 'http';
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
  SessionErrorResponse,
  SessionEventResponse,
  AgentEvent,
} from '@openz/shared';
import { DEFAULT_PORT, getDaemonStatePath, type DaemonState } from './types.js';
import { loadConfig } from './config.js';
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

/**
 * TTS 输出 sink 抽象。
 * 不同模式下把 PCM 帧和控制事件写到不同的下游。
 */
export interface TtsSink {
  /** 发送一帧 PCM 字节；返回 false 表示下游已关闭 */
  sendAudio(frame: Buffer | Uint8Array): boolean;
  /** 发送一条控制事件（first_frame / chunk / end / error） */
  sendEvent(event: Record<string, any>): boolean;
  /** 下游是否仍可写 */
  isOpen(): boolean;
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
    console.log('(voice reply requires relay mode; restart with --server <url>)');
  });

  process.on('SIGINT', () => {
    console.log('\nShutting down...');
    io.close();
    httpServer.close();
    process.exit(0);
  });
}

/**
 * 启动一次 TTS 流：把 agent 文本增量喂给 volcengine bidirectionTtsStream，
 * 把返回的 PCM 帧和控制事件写到 sink。文本端通过 generator 推送给 volcengine。
 *
 * @param onEvent - 可选的事件转发钩子。TTS 流程只把 onEvent 用来喂文本给 volcengine，
 *                  但 web 端还需要看到完整事件流渲染 UI；调用方传一个把事件 emit 到
 *                  server（→ web）的回调进来，否则页面会"听得到声音但看不到文字"。
 */
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
      // queue 空：挂起等待下一个 text_delta 或 turn_done 唤醒。
      // 这里把 Promise resolve 传回来的值（resolveNextChunk 接收的 chunk）
      // 存进 resolved 并 yield 出去——之前的实现里这个值被 await 默默
      // 丢弃，导致每个 text_delta 的首段永远到不了火山，火山收到残缺
      // 文本返回 0 帧。
      const resolved = await new Promise<string>((resolve) => {
        resolveNextChunk = resolve;
      });
      if (resolved) {
        yield resolved;
      }
    }
  }

  const handleEvent = (event: AgentEvent) => {
    // 先把事件转发给调用方（一般是 emit 给 server → web 显示 UI）
    onEvent?.(event);

    // 再做 TTS 特有的处理：text_delta 喂 volcengine，turn_done 收尾
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
      // 之前是 textQueue.shift() 取第一项经 resolveNextChunk 传出去——但
      // 这样会把 queue 里的剩余项也丢掉，且 turn_done 时没有人在等
      // resolveNextChunk（textStream 多半已在走 queue 分支）这条分支根本
      // 不会执行。改成无条件唤醒：resolved='' 是"自然结束"信号，
      // textStream 醒后会继续走 while 循环把 queue 里所有剩余 chunk
      // 排空，然后 ttsDone=true + queue 空 → 退出。
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
      // 关键：bidirectionTtsStream 内部会覆盖 onAudioFrame（改成把帧 push 到
      // 返回的 Readable），所以我们必须从 stream.on('data') 读音频帧。
      // onFirstFrame / onChunk 没被覆盖，照常传 callback 即可。
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

  // 同步发起 agent 调用；textStream 会在 TTS 内部拉取
  sessionManager.sendMessage(sessionId, message).catch((err) => {
    log('[TTS] sendMessage error:', err);
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

    // 上报本地已加载的 session，让 server 建立 session→daemon 映射。
    // 这条必不可少：每次重启 daemon 都会生成新的 daemonId（随机），
    // 不上报的话 server 端从磁盘恢复不出 session，session:send / tts:start 都会 404。
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

  // daemon:tts_start — 服务端转发的语音合成请求
  socket.on('daemon:tts_start', (req: { sessionId: string; message: string }, ack?: (r: any) => void) => {
    log('daemon:tts_start (relay)', req);
    try {
      const entry = sessionManager.getSession(req.sessionId);
      if (!entry) {
        ack?.({ error: `Session ${req.sessionId} not found` });
        return;
      }

      const sessionId = req.sessionId;
      const sink: TtsSink = {
        isOpen: () => socket.connected,
        sendAudio: (frame) => {
          if (!socket.connected) return false;
          // 第一个参数是事件名，第二是二进制 buffer，附带的元数据放在 ack 后的对象里
          // socket.io v4 支持 Buffer 作为 binary frame
          socket.emit('daemon:tts_audio', { sessionId }, frame);
          return true;
        },
        sendEvent: (event) => {
          if (!socket.connected) return false;
          socket.emit('daemon:tts_event', { sessionId, ...event });
          return true;
        },
      };

      // 同时把 agent 的事件转发到 server（→ web），让 UI 也能渲染文字。
      // 没这层的话 runTtsStream 内部的 onEvent 只喂火山，web 端"听得到看不到"。
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
