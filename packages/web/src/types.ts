export interface Session {
  id: string;
  engine: string;
  cwd: string;
  model?: string;
  status: 'idle' | 'running' | 'interrupted' | 'done' | 'disconnected';
  createdAt: number;
}

export type AgentEvent =
  | { type: 'session_init'; sessionId: string; data: unknown }
  | { type: 'message_start'; sessionId: string; data: { messageId: string } }
  | { type: 'text_delta'; sessionId: string; data: { text: string } }
  | { type: 'thinking_start'; sessionId: string; data: unknown }
  | { type: 'thinking_delta'; sessionId: string; data: { text: string } }
  | { type: 'tool_use_start'; sessionId: string; data: { tool_use_id: string; name: string; input: Record<string, unknown> } }
  | { type: 'tool_use_input_delta'; sessionId: string; data: { tool_use_id: string; input_json_delta: string } }
  | { type: 'assistant_complete'; sessionId: string; data: unknown }
  | { type: 'tool_result'; sessionId: string; data: { toolUseId: string; output: string; isError?: boolean } }
  | { type: 'turn_done'; sessionId: string; data: unknown }
  | { type: 'raw_stream_event'; sessionId: string; data: unknown }
  | { type: 'error'; sessionId: string; data: { error: string } };

export function generateSessionId(): string {
  return crypto.randomUUID();
}
