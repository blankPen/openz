import { type Query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';
import type { Agent, AgentSession } from './mod.js';
import type { AgentEvent } from '@uran/shared';
interface ClaudeSession extends AgentSession {
    query: Query | null;
    cwd: string;
    model?: string;
    conversationHistory: SDKMessage[];
    onEvent?: (event: AgentEvent) => void;
    pendingToolUseId?: string;
}
export declare class ClaudeAgent implements Agent {
    name: string;
    private sessions;
    createSession(options: {
        id: string;
        cwd: string;
        model?: string;
        onEvent: (event: AgentEvent) => void;
    }): Promise<ClaudeSession>;
    private emit;
    private handleStreamEvent;
    sendMessage(sessionId: string, message: string): Promise<void>;
}
export {};
