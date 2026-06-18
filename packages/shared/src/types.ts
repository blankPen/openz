import { randomUUID } from 'crypto';

// ============================================================
// Session
// ============================================================

export interface Session {
  id: string;
  engine: 'claude' | string;
  cwd: string;
  model?: string;
  status: 'idle' | 'running' | 'interrupted' | 'done' | 'disconnected';
  createdAt: number;
}

// ============================================================
// AgentEvent —— 规范化的事件溯源模型
//
// 每个事件具备:
//   eventId  — UUID v4，全局唯一，去重用
//   seq      — 会话内单调递增（从 0 起），检测丢事件
//   timestamp — Unix ms，事件产生时刻
//   data     — 每种 type 携带自身的强类型数据
// ============================================================

export interface AgentEventBase {
  eventId: string;
  sessionId: string;
  seq: number;
  timestamp: number;
}

// 各事件 data 类型
export interface SessionInitData {}
export interface MessageStartData { messageId: string }
export interface TextDeltaData { text: string }
export interface ThinkingStartData {}
export interface ThinkingDeltaData { text: string }
export interface ToolUseStartData { tool_use_id: string; name: string; input: Record<string, unknown> }
export interface ToolUseInputDeltaData { tool_use_id: string; input_json_delta: string }
export interface AssistantCompleteData { message: unknown }
export interface ToolResultData { tool_use_id: string; content: string }
export interface TurnDoneData {}
export interface RawStreamEventData { event: unknown }
export interface ErrorData { error: string }

export type AgentEvent = AgentEventBase & (
  | { type: 'session_init';         data: SessionInitData }
  | { type: 'message_start';        data: MessageStartData }
  | { type: 'text_delta';           data: TextDeltaData }
  | { type: 'thinking_start';       data: ThinkingStartData }
  | { type: 'thinking_delta';       data: ThinkingDeltaData }
  | { type: 'tool_use_start';       data: ToolUseStartData }
  | { type: 'tool_use_input_delta'; data: ToolUseInputDeltaData }
  | { type: 'assistant_complete';   data: AssistantCompleteData }
  | { type: 'tool_result';          data: ToolResultData }
  | { type: 'turn_done';            data: TurnDoneData }
  | { type: 'raw_stream_event';     data: RawStreamEventData }
  | { type: 'error';                data: ErrorData }
);

// ============================================================
// HTTP REST 请求 / 响应类型
// ============================================================

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

/** GET /sessions/:id/events 查询参数 */
export interface SessionHistoryQuery {
  after?: number; // 只拉 after 之后的 event（不含 after）
}

export interface SessionHistoryResponse {
  sessionId: string;
  events: AgentEvent[];
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

/** Socket.IO relay 内部使用：把 event 和 sessionId 打包转发 */
export interface SessionEventResponse {
  sessionId: string;
  event: AgentEvent;
}

// ============================================================
// 工具函数
// ============================================================

export function generateSessionId(): string {
  return randomUUID();
}
