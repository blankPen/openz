import { useRef, useState, useCallback, type FormEvent } from 'react';
import { socket } from '../socket';
import { useSessionEvents } from '../hooks/useSocket';
import type { AgentEvent } from '../types';
import { AgentMessage, ThinkingMessage, ToolUse, UserMessage } from './Message';

interface MessageItem {
  id: string;
  type: 'user' | 'agent' | 'thinking' | 'tool_use' | 'tool_result';
  text?: string;
  toolName?: string;
  toolArgs?: string;
  toolResult?: string;
  isError?: boolean;
  pending?: boolean;
  messageId?: string;
}

interface ChatViewProps {
  sessionId: string;
  onBack: () => void;
}

export function ChatView({ sessionId, onBack }: ChatViewProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingToolId = useRef<string | null>(null);
  const currentMessageId = useRef<string | null>(null);
  const agentTextRef = useRef<Record<string, string>>({});
  const thinkingTextRef = useRef<Record<string, string>>({});

  const handleEvent = useCallback((event: AgentEvent) => {
    switch (event.type) {
      case 'message_start': {
        currentMessageId.current = event.data.messageId;
        const id = `agent-${event.data.messageId}`;
        agentTextRef.current[event.data.messageId] = '';
        setMessages(prev => [
          ...prev,
          { id, type: 'agent', text: '', messageId: event.data.messageId },
        ]);
        break;
      }
      case 'text_delta': {
        if (currentMessageId.current) {
          agentTextRef.current[currentMessageId.current] =
            (agentTextRef.current[currentMessageId.current] || '') + event.data.text;
          setMessages(prev => prev.map(m =>
            m.messageId === currentMessageId.current
              ? { ...m, text: agentTextRef.current[currentMessageId.current] }
              : m,
          ));
        }
        break;
      }
      case 'thinking_delta': {
        if (currentMessageId.current) {
          const msgId = currentMessageId.current;
          if (!msgId) break;
          thinkingTextRef.current[msgId] =
            (thinkingTextRef.current[msgId] || '') + event.data.text;
          setMessages(prev => {
            const existing = prev.find(m => m.type === 'thinking' && m.messageId === msgId);
            if (existing) {
              return prev.map(m =>
                m === existing ? { ...m, text: thinkingTextRef.current[msgId] } : m,
              );
            }
            return [
              ...prev,
              {
                id: `thinking-${msgId}`,
                type: 'thinking',
                text: thinkingTextRef.current[msgId],
                messageId: msgId,
              },
            ];
          });
        }
        break;
      }
      case 'tool_use_start': {
        const toolId = event.data.tool_use_id || `tool-${Date.now()}`;
        pendingToolId.current = toolId;
        setMessages(prev => [
          ...prev,
          {
            id: `tool-${toolId}`,
            type: 'tool_use',
            toolName: event.data.name,
            toolArgs: JSON.stringify(event.data.input || {}),
            pending: true,
          },
        ]);
        break;
      }
      case 'tool_use_input_delta': {
        const toolId = event.data.tool_use_id || pendingToolId.current;
        if (!toolId) break;
        setMessages(prev => prev.map(m => {
          if (m.id === `tool-${toolId}`) {
            const newArgs = (m.toolArgs || '{}') + event.data.input_json_delta;
            return { ...m, toolArgs: newArgs };
          }
          return m;
        }));
        break;
      }
      case 'tool_result': {
        const toolId = event.data.toolUseId || pendingToolId.current;
        if (!toolId) break;
        setMessages(prev => prev.map(m => {
          if (m.id === `tool-${toolId}`) {
            return {
              ...m,
              toolResult: typeof event.data.output === 'string'
                ? event.data.output
                : JSON.stringify(event.data.output),
              isError: event.data.isError,
              pending: false,
            };
          }
          return m;
        }));
        pendingToolId.current = null;
        break;
      }
      case 'assistant_complete':
      case 'turn_done': {
        setSending(false);
        currentMessageId.current = null;
        thinkingTextRef.current = {};
        break;
      }
      case 'error': {
        setMessages(prev => [
          ...prev,
          { id: `error-${Date.now()}`, type: 'user', text: `Error: ${event.data.error}` },
        ]);
        setSending(false);
        break;
      }
    }
  }, []);

  useSessionEvents(sessionId, handleEvent, scrollRef);

  const send = async (text: string) => {
    if (!text.trim() || sending) return;
    setSending(true);

    // Add user message immediately
    const userId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userId, type: 'user', text }]);
    setInput('');

    // Reset agent accumulation state
    currentMessageId.current = null;
    agentTextRef.current = {};
    thinkingTextRef.current = {};

    // Clear current agent/thinking messages so they start fresh
    setMessages(prev => prev.filter(
      m => m.type !== 'agent' && m.type !== 'thinking',
    ));

    return new Promise<void>((resolve) => {
      socket.emit('session:send', { sessionId, message: text }, (res: { error?: string }) => {
        if (res.error) {
          setMessages(prev => [
            ...prev,
            { id: `error-${Date.now()}`, type: 'user', text: `Error: ${res.error}` },
          ]);
          setSending(false);
        }
        resolve();
      });
    });
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    send(input);
  };

  return (
    <div className="chat-view">
      <div className="chat-header">
        <button className="back-btn" onClick={onBack}>← Back</button>
        <span className="chat-header__title">Session {sessionId.slice(0, 8)}…</span>
      </div>

      <div className="messages" ref={scrollRef}>
        {messages.map(m => {
          switch (m.type) {
            case 'user':
              return <UserMessage key={m.id} text={m.text || ''} />;
            case 'agent':
              return (
                <AgentMessage
                  key={m.id}
                  text={m.text || ''}
                  thinking={thinkingTextRef.current[m.messageId || '']}
                  streaming={sending}
                />
              );
            case 'thinking':
              return <ThinkingMessage key={m.id} text={m.text || ''} />;
            case 'tool_use':
              return (
                <ToolUse
                  key={m.id}
                  toolName={m.toolName || 'Unknown'}
                  toolArgs={m.toolArgs || '{}'}
                  toolResult={m.toolResult}
                  isError={m.isError}
                  pending={m.pending}
                />
              );
            default:
              return null;
          }
        })}
      </div>

      <form className="input-area" onSubmit={handleSubmit}>
        <textarea
          className="input-area__textarea"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Send a message to Claude…"
          rows={1}
          disabled={sending}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
        />
        <button className="input-area__btn" type="submit" disabled={sending || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}
