import type { Session, AgentEvent } from '@openz/shared';
import { generateSessionId } from '@openz/shared';
import type { Agent, AgentSession } from '../agents/mod.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const SESSIONS_FILE = join(process.env.HOME || '/tmp', '.openz', 'sessions.json');

export class SessionManager {
  private sessions = new Map<string, {
    session: Session;
    agentSession: AgentSession;
    onEvent?: (event: AgentEvent) => void;
  }>();

  constructor(private agent: Agent) {
    this.loadSessions();
  }

  private loadSessions() {
    try {
      if (existsSync(SESSIONS_FILE)) {
        const data = readFileSync(SESSIONS_FILE, 'utf-8');
        const arr: Session[] = JSON.parse(data);
        // Note: agentSession cannot be restored, so sessions are loaded as metadata only
        // They will be recreated when actually used
        arr.forEach(s => {
          // Mark as disconnected since we can't restore the actual agent session
          s.status = 'disconnected';
          this.sessions.set(s.id, {
            session: s,
            agentSession: null as any, // Will be recreated on use
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
      const dir = join(process.env.HOME || '/tmp', '.openz');
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      const arr = Array.from(this.sessions.values())
        .filter(e => e.session.status !== 'running') // Don't save running sessions
        .map(e => e.session);
      writeFileSync(SESSIONS_FILE, JSON.stringify(arr, null, 2));
    } catch (e) {
      console.error('[SessionManager] Failed to save sessions:', e);
    }
  }

  async createSession(options: {
    id?: string;
    engine?: string;
    cwd?: string;
    model?: string;
    onEvent?: (event: AgentEvent) => void;
  }): Promise<Session> {
    const id = options.id || generateSessionId();
    const cwd = options.cwd || process.cwd();

    // Check if session already exists (restored from disk)
    const existing = this.sessions.get(id);
    if (existing && existing.agentSession) {
      // Reuse existing session
      existing.onEvent = options.onEvent;
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
      onEvent: options.onEvent || (() => {}),
    });

    this.sessions.set(id, { session, agentSession, onEvent: options.onEvent });
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
    }
  }

  async sendMessage(sessionId: string, message: string) {
    const entry = this.sessions.get(sessionId);
    if (!entry) throw new Error(`Session ${sessionId} not found`);

    // Recreate agent session if needed (e.g., after daemon restart)
    if (!entry.agentSession) {
      entry.agentSession = await this.agent.createSession({
        id: sessionId,
        cwd: entry.session.cwd,
        model: entry.session.model,
        onEvent: entry.onEvent || (() => {}),
      });
      entry.session.status = 'idle';
    }

    // Update agent session's onEvent to use the current handler
    // This ensures events flow through the correct handler set by session:send
    if (entry.agentSession) {
      entry.agentSession.onEvent = entry.onEvent || (() => {});
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

  setOnEvent(sessionId: string, onEvent: (event: AgentEvent) => void) {
    const entry = this.sessions.get(sessionId);
    if (entry) {
      entry.onEvent = onEvent;
    }
  }
}
