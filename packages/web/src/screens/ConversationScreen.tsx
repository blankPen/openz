import { useState, useRef, useEffect, useCallback } from 'react';
import { socket } from '../socket';
import { useSessionEvents } from '../hooks/useSocket';
import type { AgentEvent } from '../types';
import { log } from '../lib/logger';

interface ConversationScreenProps {
  sessionTitle: string;
  onOpenModelSwitch: () => void;
  onOpenAttachment: () => void;
}

export function ConversationScreen({ onOpenModelSwitch, onOpenAttachment }: ConversationScreenProps) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [thinkingText, setThinkingText] = useState('');
  const [thinkingSteps, setThinkingSteps] = useState<string[]>([]);
  const [thinkingExpanded, setThinkingExpanded] = useState(false);
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const flowRef = useRef<HTMLDivElement>(null);

  // Accumulation refs
  const agentTextRef = useRef<Record<string, string>>({});
  const currentMessageIdRef = useRef<string | null>(null);
  const sendingRef = useRef(false);
  const thinkingTextRef = useRef('');

  // Auto-scroll
  useEffect(() => {
    if (flowRef.current) {
      flowRef.current.scrollTop = flowRef.current.scrollHeight;
    }
  }, [messages, isThinking, thinkingText]);

  // Elapsed seconds ticker while thinking
  useEffect(() => {
    if (!isThinking || !thinkingStartTime) return;
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - thinkingStartTime) / 1000));
    }, 1000);
    return () => clearInterval(interval);
  }, [isThinking, thinkingStartTime]);

  // Create session on mount
  useEffect(() => {
    log.socket('创建新会话...');
    socket.emit('session:create', { cwd: '/tmp' }, (res: { session?: { id: string }; error?: string }) => {
      if (res.session) {
        log.socket('会话已创建 id=%s', res.session.id);
        setSessionId(res.session.id);
      } else if (res.error) {
        log.socket('会话创建失败 error=%s', res.error);
      }
    });
  }, []);

  const handleEvent = useCallback((event: AgentEvent) => {
    log.sse('收到事件 type=%s seq=%s sessionId=%s', event.type, event.seq, event.sessionId);

    switch (event.type) {
      case 'message_start': {
        const msgId = event.data.messageId as string;
        currentMessageIdRef.current = msgId;
        agentTextRef.current[msgId] = '';
        break;
      }
      case 'text_delta': {
        const msgId = currentMessageIdRef.current;
        if (!msgId) break;
        const deltaText = (event.data.text as string) ?? '';
        agentTextRef.current[msgId] = (agentTextRef.current[msgId] || '') + deltaText;
        log.sse('text_delta len=%d total=%d text=%s', deltaText.length, agentTextRef.current[msgId].length, deltaText);
        setMessages(prev => prev.map(m =>
          m.messageId === msgId ? { ...m, text: agentTextRef.current[msgId] } : m,
        ));
        break;
      }
      case 'thinking_start': {
        setIsThinking(true);
        setThinkingText('');
        setThinkingSteps([]);
        thinkingTextRef.current = '';
        setThinkingExpanded(false);
        setThinkingStartTime(Date.now());
        setElapsedSeconds(0);
        break;
      }
      case 'thinking_delta': {
        const text = event.data.text as string;
        thinkingTextRef.current += text;
        setThinkingText(thinkingTextRef.current);
        // Parse steps from thinking text: numbered lines like "1. xxx" or "- xxx"
        const steps = parseThinkingSteps(thinkingTextRef.current);
        setThinkingSteps(steps);
        break;
      }
      case 'tool_use_start': {
        const toolId = event.data.tool_use_id as string;
        setMessages(prev => [...prev, {
          id: `tool-${toolId}`,
          type: 'tool_use',
          toolName: event.data.name as string,
          toolArgs: JSON.stringify(event.data.input || {}),
          pending: true,
          messageId: toolId,
        }]);
        break;
      }
      case 'tool_use_input_delta': {
        const toolId = event.data.tool_use_id as string;
        if (!toolId) break;
        setMessages(prev => prev.map(m => {
          if (m.id === `tool-${toolId}`) {
            return { ...m, toolArgs: (m.toolArgs || '{}') + (event.data.input_json_delta as string) };
          }
          return m;
        }));
        break;
      }
      case 'tool_result': {
        const toolId = event.data.toolUseId as string;
        if (!toolId) break;
        const output = event.data.output;
        setMessages(prev => prev.map(m => {
          if (m.id === `tool-${toolId}`) {
            return {
              ...m,
              toolResult: typeof output === 'string' ? output : JSON.stringify(output),
              isError: event.data.isError as boolean | undefined,
              pending: false,
            };
          }
          return m;
        }));
        break;
      }
      case 'assistant_complete':
      case 'turn_done': {
        log.sse('会话完成 type=%s', event.type);
        setSending(false);
        sendingRef.current = false;
        currentMessageIdRef.current = null;
        agentTextRef.current = {};
        thinkingTextRef.current = '';
        setIsThinking(false);
        setThinkingStartTime(null);
        break;
      }
      case 'error': {
        const errMsg = event.data.error as string;
        setMessages(prev => [...prev, {
          id: `error-${Date.now()}`,
          type: 'error',
          text: `Error: ${errMsg}`,
        }]);
        setSending(false);
        sendingRef.current = false;
        break;
      }
    }
  }, []);

  useSessionEvents(sessionId, handleEvent, flowRef as React.RefObject<HTMLDivElement | null>);

  const send = useCallback((text: string) => {
    if (!text.trim() || sendingRef.current || !sessionId) return;
    log.session('发送消息 sessionId=%s text=%s', sessionId, text.slice(0, 50));
    sendingRef.current = true;
    setSending(true);

    const userId = `user-${Date.now()}`;
    setMessages(prev => [...prev, { id: userId, type: 'user', text }]);
    setInputValue('');

    currentMessageIdRef.current = null;
    agentTextRef.current = {};
    thinkingTextRef.current = '';
    setIsThinking(false);
    setThinkingStartTime(null);
    setThinkingText('');
    setThinkingSteps([]);
    setMessages(prev => prev.filter(m => m.type !== 'agent'));

    socket.emit('session:send', { sessionId, message: text }, (res: { error?: string }) => {
      if (res.error) {
        log.session('发送失败 error=%s', res.error);
        setMessages(prev => [...prev, { id: `error-${Date.now()}`, type: 'error', text: `Error: ${res.error}` }]);
        setSending(false);
        sendingRef.current = false;
      } else {
        log.session('发送成功，等待服务端响应...');
      }
    });
  }, [sessionId]);

  const handleSend = () => send(inputValue);
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(inputValue); }
  };

  return (
    <main className="main">
      <header className="topbar">
        <div className="title-wrap">
          <span className="title">AI Agent 产品分析报告</span>
          <span className="title-meta">· 今天</span>
        </div>
        <div className="topbar-right">
          <button className="model-pill" onClick={onOpenModelSwitch}>
            <svg className="bolt" viewBox="0 0 24 24" fill="currentColor">
              <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
            </svg>
            <span className="name">OpenZ</span>
            <span className="meta">K2.6 思考</span>
            <svg className="chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="4,2 8,6 4,10"/>
            </svg>
          </button>
          <button className="icon-btn" aria-label="语音播报" style={{ marginLeft: 8 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/>
              <path d="M15.54 8.46a5 5 0 010 7.07"/>
              <path d="M19.07 4.93a10 10 0 010 14.14"/>
            </svg>
          </button>
          <button className="icon-btn" aria-label="分享">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
          </button>
        </div>
      </header>

      <div className="flow" ref={flowRef}>
        <div className="flow-inner">
          {messages.map(msg => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {/* Thinking bubble — matches design spec */}
          {isThinking && (
            <div className="row row-ai">
              <div className="ai-head">
                <div className="ai-avatar">Z</div>
                <span className="ai-name">OpenZ</span>
                <span className="ai-mode">思考</span>
              </div>
              <div
                className="thinking"
                role="button"
                tabIndex={0}
                aria-expanded={thinkingExpanded}
                onClick={() => setThinkingExpanded(v => !v)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setThinkingExpanded(v => !v); }}
              >
                <span className="thinking-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z"/>
                  </svg>
                </span>
                <span className="thinking-text">
                  已思考 <b>{elapsedSeconds} 秒</b> · 规划 {thinkingSteps.length} 个章节
                </span>
                <svg className="thinking-chev" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <polyline points="2,4 6,8 10,4"/>
                </svg>
              </div>
              {thinkingSteps.length > 0 && thinkingExpanded && (
                <div className="thinking-detail">
                  {thinkingSteps.map((step, i) => (
                    <div key={i} className="thinking-step">
                      <span className="thinking-step-num">{i + 1}</span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Streaming indicator — matches design spec */}
          {sending && !isThinking && (
            <div className="row row-ai">
              <div className="status-line">
                <span className="spinner"></span>
                OpenZ 正在回复…
              </div>
            </div>
          )}

          {/* Empty state */}
          {messages.length === 0 && !isThinking && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 0', gap: 12 }}>
              <svg width="56" height="56" viewBox="0 0 72 72">
                <defs>
                  <linearGradient id="av_conv" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#4A8BFF"/>
                    <stop offset="1" stopColor="#1A66FF"/>
                  </linearGradient>
                </defs>
                <circle cx="36" cy="36" r="36" fill="url(#av_conv)"/>
                <path d="M 24 22 L 48 22 L 24 50 L 48 50" stroke="white" strokeWidth="3.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p style={{ color: 'var(--fg-3)', fontSize: 15 }}>开始对话吧</p>
            </div>
          )}
        </div>
      </div>

      <div className="input-zone">
        <div className="input-box">
          <textarea className="textfield" rows={2} placeholder="接着问 OpenZ…" value={inputValue} onChange={e => setInputValue(e.target.value)} onKeyDown={handleKeyDown}/>
          <div className="input-actions">
            <div className="input-left">
              <button className="input-btn" aria-label="附件" onClick={onOpenAttachment}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
              </button>
              <button className="input-btn" aria-label="语音输入">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                  <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                  <line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>
                </svg>
              </button>
            </div>
            <div className="input-right">
              <button className="input-btn send" aria-label="发送" onClick={handleSend}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="19" x2="12" y2="5"/><polyline points="6,11 12,5 18,11"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
        <div className="watermark">内容由 AI 生成，请核查重要信息</div>
      </div>
    </main>
  );
}

// ── Types ──────────────────────────────────────────────────
type Msg = {
  id: string; type: 'user' | 'agent' | 'tool_use' | 'error';
  text?: string; toolName?: string; toolArgs?: string;
  toolResult?: string; isError?: boolean; pending?: boolean; messageId?: string;
};

// ── Step parser ────────────────────────────────────────────
function parseThinkingSteps(text: string): string[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);
  const steps: string[] = [];
  for (const line of lines) {
    // Match numbered steps: "1. xxx", "1、xxx", "Step 1: xxx"
    const numbered = line.match(/^(?:\d+[.)、：:]\s*)(.+)/);
    if (numbered) { steps.push(numbered[1]); continue; }
    // Match bullet points: "- xxx", "• xxx", "* xxx"
    const bulleted = line.match(/^[-•*]\s+(.+)/);
    if (bulleted) { steps.push(bulleted[1]); continue; }
    // If it looks like a distinct clause and we already have steps, add as new step
    if (steps.length > 0 && line.length > 10) { steps.push(line); }
  }
  return steps;
}

// ── Message Bubbles ────────────────────────────────────────
function MessageBubble({ message }: { message: Msg }) {
  if (message.type === 'user') {
    return (
      <div className="row row-user">
        <div className="bubble-user">{message.text}</div>
      </div>
    );
  }
  if (message.type === 'error') {
    return (
      <div className="row row-ai">
        <div className="bubble-ai" style={{ background: '#FFF0F0', color: '#CC0000', border: '1px solid #FFCCCC' }}>
          {message.text}
        </div>
      </div>
    );
  }
  if (message.type === 'tool_use') {
    return (
      <div className="row row-ai">
        <div className="tool-card">
          <div className="tool-head">
            <div className="tool-icon-box" style={{ background: '#EAF1FF', color: '#1A66FF' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <div className="tool-info">
              <div className="tool-name">{message.toolName}</div>
              <div className="tool-sub">工具调用 {message.pending ? '· 进行中…' : '· 已完成'}</div>
            </div>
          </div>
          {!message.pending && message.toolResult && (
            <div className="tool-body">
              <div style={{ fontSize: 13, color: 'var(--fg-2)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {message.toolResult.slice(0, 600)}{message.toolResult.length > 600 ? '…' : ''}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
  // Agent bubble
  return (
    <div className="row row-ai">
      <div className="ai-head">
        <div className="ai-avatar">Z</div>
        <span className="ai-name">OpenZ</span>
        <span className="ai-mode">思考</span>
      </div>
      <div className="bubble-ai" dangerouslySetInnerHTML={{ __html: formatMarkdown(message.text || '') }} />
      <div className="ai-actions">
        <button className="ai-action" aria-label="复制">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
          复制
        </button>
        <button className="ai-action liked" aria-label="点赞">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
          </svg>
          8
        </button>
        <button className="ai-action" aria-label="点踩">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3zm7-13h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
          </svg>
        </button>
        <button className="ai-action" aria-label="重新生成">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M23 4v6h-6"/><path d="M20.49 15A9 9 0 1118 5.3L23 10"/>
          </svg>
          重新生成
        </button>
        <button className="ai-action" aria-label="分享">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          分享
        </button>
      </div>
    </div>
  );
}

function formatMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br/>');
}
