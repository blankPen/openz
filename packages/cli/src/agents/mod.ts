import type { AgentEvent } from '@openz/shared';

export interface AgentSession {
  id: string;
  status: 'idle' | 'running' | 'interrupted' | 'done';
  onEvent?: (event: AgentEvent) => void;
  interrupt(): void;
  stop(): void;
}

export interface Agent {
  name: string;
  createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<AgentSession>;
  sendMessage(sessionId: string, message: string): Promise<void>;
}
