import type { Session, AgentEvent } from '@uran/shared';
import type { Agent } from '../agents/mod.js';
export declare class SessionManager {
    private agent;
    private sessions;
    constructor(agent: Agent);
    private loadSessions;
    private saveSessions;
    createSession(options: {
        id?: string;
        engine?: string;
        cwd?: string;
        model?: string;
        onEvent?: (event: AgentEvent) => void;
    }): Promise<Session>;
    getSession(id: string): Session | undefined;
    getAllSessions(): Session[];
    updateSessionStatus(id: string, status: Session['status']): void;
    deleteSession(id: string): void;
    sendMessage(sessionId: string, message: string): Promise<void>;
    interruptSession(sessionId: string): void;
    stopSession(sessionId: string): void;
    setOnEvent(sessionId: string, onEvent: (event: AgentEvent) => void): void;
}
