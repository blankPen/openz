import type { Session, AgentEvent } from '@openz/shared';
import { generateSessionId } from '@openz/shared';
import type { Agent, AgentSession } from '../agents/mod.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from 'fs';
import { join } from 'path';

const HOME = process.env.HOME || '/tmp';
const SESSIONS_FILE = join(HOME, '.openz', 'sessions.json');
const EVENTS_DIR = join(HOME, '.openz', 'sessions');

export class SessionManager {
  private sessions = new Map<string, {
    session: Session;
    agentSession: AgentSession;
    onEvent?: (event: AgentEvent) => void;
  }>();

  constructor(private agent: Agent) {
    this.loadSessions();
  }

  // ==========================================================
  // 持久化：会话元数据
  // ==========================================================

  private loadSessions() {
    try {
      if (existsSync(SESSIONS_FILE)) {
        const data = readFileSync(SESSIONS_FILE, 'utf-8');
        const arr: Session[] = JSON.parse(data);
        arr.forEach(s => {
          s.status = 'disconnected';
          this.sessions.set(s.id, {
            session: s,
            agentSession: null as any,
          });
        });
        console.log(`[SessionManager] Loaded ${arr.length} sessions from disk`);
      }
    } catch (e) {
      console.error('[SessionManager] Failed to load sessions:', e);
    }
  }

  private saveSessions() {
    try {
      if (!existsSync(join(HOME, '.openz'))) mkdirSync(join(HOME, '.openz'), { recursive: true });
      const arr = Array.from(this.sessions.values())
        .filter(e => e.session.status !== 'running')
        .map(e => e.session);
      writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2));
    } catch (e) {
      console.error('[SessionManager] Failed to save sessions:', e);
    }
  }

  // ==========================================================
  // 持久化：事件 JSONL
  // ==========================================================

  /**
   * 追加一条事件到会话的 events.jsonl 文件。
   * 由 onEvent wrapper 自动调用，外部无需关心。
   */
  private appendEvent(event: AgentEvent) {
    try {
      const dir = join(EVENTS_DIR, event.sessionId);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, 'events.jsonl'), JSON.stringify(event) + '\n');
    } catch (e) {
      console.error(`[SessionManager] Failed to persist event seq=${event.seq}:`, e);
    }
  }

  /**
   * 读取会话的全部事件，支持增量（afterSeq）。
   * @param sessionId 会话 ID
   * @param afterSeq  仅返回 seq > afterSeq 的事件
   */
  getEvents(sessionId: string, afterSeq?: number): AgentEvent[] {
    const file = join(EVENTS_DIR, sessionId, 'events.jsonl');
    if (!existsSync(file)) return [];
    try {
      const raw = readFileSync(file, 'utf-8').trim();
      if (!raw) return [];
      const events = raw.split('\n').map(l => JSON.parse(l) as AgentEvent);
      if (afterSeq !== undefined) return events.filter(e => e.seq > afterSeq);
      return events;
    } catch (e) {
      console.error(`[SessionManager] Failed to read events for ${sessionId}:`, e);
      return [];
    }
  }

  /**
   * 删除会话的事件目录。
   */
  private cleanupEventFiles(sessionId: string) {
    const dir = join(EVENTS_DIR, sessionId);
    try {
      if (existsSync(dir)) {
        rmSync(dir, { recursive: true, force: true });
      }
    } catch (e) {
      console.error(`[SessionManager] Failed to clean up events for ${sessionId}:`, e);
    }
  }

  // ==========================================================
  // 会话生命周期
  // ==========================================================

  async createSession(options: {
    id?: string;
    engine?: string;
    cwd?: string;
    model?: string;
    onEvent?: (event: AgentEvent) => void;
  }): Promise<Session> {
    const id = options.id || generateSessionId();
    const cwd = options.cwd || process.cwd();

    // 包装 onEvent：先持久化，再转发给调用方
    const userOnEvent = options.onEvent;
    const wrappedOnEvent = (event: AgentEvent) => {
      this.appendEvent(event);
      userOnEvent?.(event);
    };

    // Check if session already exists (restored from disk)
    const existing = this.sessions.get(id);
    if (existing && existing.agentSession) {
      existing.onEvent = wrappedOnEvent;
      existing.session.status = 'idle';
      this.saveSessions();
      return existing.session;
    }

    const session: Session = {
      id,
      engine: options.engine || 'claude',
      cwd,
      model: options.model,
      status: 'idle',
      createdAt: Date.now(),
    };

    const agentSession = await this.agent.createSession({
      id,
      cwd,
      model: options.model,
      onEvent: wrappedOnEvent,
    });

    this.sessions.set(id, { session, agentSession, onEvent: wrappedOnEvent });
    this.saveSessions();
    return session;
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id)?.session;
  }

  getAllSessions(): Session[] {
    return Array.from(this.sessions.values()).map(v => v.session);
  }

  updateSessionStatus(id: string, status: Session['status']) {
    const entry = this.sessions.get(id);
    if (entry) {
      entry.session.status = status;
      this.saveSessions();
    }
  }

  deleteSession(id: string) {
    const entry = this.sessions.get(id);
    if (entry) {
      if (entry.agentSession) {
        entry.agentSession.stop();
      }
      this.sessions.delete(id);
      this.saveSessions();
      this.cleanupEventFiles(id);
    }
  }

  // ==========================================================
  // 消息发送
  // ==========================================================

  /**
   * 设置会话的事件回调（由 daemon server 调用）。
   * 自动包装持久化逻辑。
   */
  setOnEvent(sessionId: string, onEvent: (event: AgentEvent) => void) {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.onEvent = (event: AgentEvent) => {
        this.appendEvent(event);
        onEvent(event);
      };
    }
  }

  async sendMessage(sessionId: string, message: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) throw new Error(`Session ${sessionId} not found`);

    // Recreate agent session if needed (e.g., after daemon restart)
    if (!entry.agentSession) {
      // entry.onEvent 已经由 createSession 或 setOnEvent 包装过
      const onEvent = entry.onEvent || ((event: AgentEvent) => { this.appendEvent(event); });
      entry.agentSession = await this.agent.createSession({
        id: sessionId,
        cwd: entry.session.cwd,
        model: entry.session.model,
        onEvent,
      });
      entry.session.status = 'idle';
    }

    // 确保 agent session 的 onEvent 指向最新包装后的回调
    if (entry.agentSession) {
      entry.agentSession.onEvent = entry.onEvent || ((event: AgentEvent) => { this.appendEvent(event); });
    }

    await this.agent.sendMessage(sessionId, message);
  }

  interruptSession(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry && entry.agentSession) {
      entry.agentSession.interrupt();
    }
  }

  stopSession(sessionId: string) {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      if (entry.agentSession) {
        entry.agentSession.stop();
      }
      entry.session.status = 'done';
      this.saveSessions();
    }
  }
}
