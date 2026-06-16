import { MarkdownRenderer } from './MarkdownRenderer';

interface UserMessageProps {
  text: string;
}

export function UserMessage({ text }: UserMessageProps) {
  return (
    <div className="message message--user">
      <div className="message__role">You</div>
      <div className="message__content">{text}</div>
    </div>
  );
}

interface ThinkingMessageProps {
  text: string;
}

export function ThinkingMessage({ text }: ThinkingMessageProps) {
  return (
    <div className="message message--thinking">
      {text}
    </div>
  );
}

interface AgentMessageProps {
  text: string;
  thinking?: string;
  streaming?: boolean;
}

export function AgentMessage({ text, thinking, streaming }: AgentMessageProps) {
  return (
    <div className="message message--agent">
      <div className="message__role">
        <span className="assistant-avatar">A</span>
        Claude
      </div>
      {thinking && thinking.length > 0 && (
        <div className="message__thinking">
          <div className="message__thinking-label">
            {streaming ? 'Thinking…' : 'Thought process'}
          </div>
          <MarkdownRenderer
            content={thinking}
            isAnimating={streaming}
            className="message__thinking-body"
          />
        </div>
      )}
      {text.length > 0 && (
        <MarkdownRenderer
          content={text}
          isAnimating={streaming}
          className="message__markdown"
        />
      )}
    </div>
  );
}

interface ToolUseProps {
  toolName: string;
  toolArgs: string;
  toolResult?: string;
  isError?: boolean;
  pending?: boolean;
}

export function ToolUse({ toolName, toolArgs, toolResult, isError, pending }: ToolUseProps) {
  let argsJson: Record<string, unknown> = {};
  try { argsJson = JSON.parse(toolArgs); } catch { /* use raw */ }

  return (
    <div className={`tool-call${isError ? ' tool-call--error' : ''}`}>
      <div className="tool-call__header">
        <span className="tool-call__name">{toolName}</span>
        <span className="tool-call__status">
          {isError ? '✗ error' : pending ? '…' : '✓'}
        </span>
        <span className="tool-call__summary">{summarizeArgs(argsJson)}</span>
      </div>
      <div className="tool-call__body">
        <div className="tool-call__section-label">Input</div>
        <pre className="tool-call__pre">{JSON.stringify(argsJson, null, 2)}</pre>
        {toolResult !== undefined && (
          <>
            <div className="tool-call__section-label">Output</div>
            <pre className="tool-call__pre">{toolResult}</pre>
          </>
        )}
      </div>
    </div>
  );
}

function summarizeArgs(args: Record<string, unknown>): string {
  for (const k of ['command', 'file_path', 'path', 'pattern', 'url', 'query']) {
    if (typeof args[k] === 'string') return String(args[k]);
  }
  const str = JSON.stringify(args);
  return str.length > 80 ? str.slice(0, 80) + '…' : str;
}
