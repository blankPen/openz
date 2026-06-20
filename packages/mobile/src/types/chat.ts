export type MessageRole = 'user' | 'ai';
export type MessageType = 'text' | 'thinking' | 'tool-call' | 'tool-result';

export interface ThinkingStep {
  step: number;
  content: string;
}

export interface SourceItem {
  index: number;
  title: string;
  url: string;
}

export interface ToolCall {
  name: string;
  description: string;
  sources?: SourceItem[];
}

export interface Attachment {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  uri: string;
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  thinkingSteps?: ThinkingStep[];
  toolCall?: ToolCall;
  timestamp: string; // "HH:mm" format
  isStreaming?: boolean;
  attachments?: Attachment[];
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconBg: string;
  tag?: string;       // e.g. "最新" | "稳定"
  tagColor?: string;
  isPro?: boolean;
}

export interface ModeOption {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconBg: string;
}

export interface PersonaOption {
  id: string;
  name: string;
  description: string;
  avatar: string; // single char
  avatarBg: string;
  avatarColor: string;
}
