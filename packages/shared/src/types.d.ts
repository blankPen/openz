export interface Session {
    id: string;
    engine: 'claude' | string;
    cwd: string;
    model?: string;
    status: 'idle' | 'running' | 'interrupted' | 'done' | 'disconnected';
    createdAt: number;
}
export type AgentEvent = {
    type: 'session_init';
    sessionId: string;
    data: any;
} | {
    type: 'message_start';
    sessionId: string;
    data: {
        messageId: string;
    };
} | {
    type: 'text_delta';
    sessionId: string;
    data: {
        text: string;
    };
} | {
    type: 'thinking_start';
    sessionId: string;
    data: any;
} | {
    type: 'thinking_delta';
    sessionId: string;
    data: {
        text: string;
    };
} | {
    type: 'tool_use_start';
    sessionId: string;
    data: any;
} | {
    type: 'tool_use_input_delta';
    sessionId: string;
    data: any;
} | {
    type: 'assistant_complete';
    sessionId: string;
    data: any;
} | {
    type: 'tool_result';
    sessionId: string;
    data: any;
} | {
    type: 'turn_done';
    sessionId: string;
    data: any;
} | {
    type: 'raw_stream_event';
    sessionId: string;
    data: any;
} | {
    type: 'error';
    sessionId: string;
    data: {
        error: string;
    };
};
export interface CreateSessionRequest {
    id?: string;
    engine?: string;
    cwd?: string;
    model?: string;
}
export interface SendMessageRequest {
    sessionId: string;
    message: string;
}
export interface SessionRequest {
    sessionId: string;
}
export interface SessionCreatedResponse {
    session: Session;
}
export interface SessionListResponse {
    sessions: Session[];
}
export interface SessionErrorResponse {
    sessionId: string;
    error: string;
}
export interface SessionEventResponse {
    sessionId: string;
    event: AgentEvent;
}
export declare function generateSessionId(): string;
