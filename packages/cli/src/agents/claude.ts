import { query, type Query, type SDKMessage, type SDKPartialAssistantMessage } from '@anthropic-ai/claude-agent-sdk';
import { randomUUID } from 'crypto';
import type { Agent, AgentSession } from './mod.js';
import type { AgentEvent } from '@openz/shared';

interface ClaudeSession extends AgentSession {
  query: Query | null;
  cwd: string;
  model?: string;
  conversationHistory: SDKMessage[];
  onEvent?: (event: AgentEvent) => void;
  pendingToolUseId?: string;
}

export class ClaudeAgent implements Agent {
  name = 'claude';
  private sessions = new Map<string, ClaudeSession>();
  private seqCounters = new Map<string, number>();

  // ---- seq 管理 ----

  private nextSeq(sessionId: string): number {
    const current = this.seqCounters.get(sessionId) ?? -1;
    const next = current + 1;
    this.seqCounters.set(sessionId, next);
    return next;
  }

  // ---- 事件发射 ----

  /**
   * 发射一条 AgentEvent。
   * 自动补全 eventId (UUID)、seq (自增)、timestamp。
   * @param sessionId 会话 ID
   * @param partial   事件 type + data（sessionId/eventId/seq/timestamp 由本方法自动填充）
   */
  private emit(
    sessionId: string,
    partial: { type: AgentEvent['type']; data: unknown },
    extra?: string,
  ) {
    const eventId = randomUUID();
    const seq = this.nextSeq(sessionId);
    const timestamp = Date.now();

    const event: AgentEvent = {
      eventId,
      sessionId,
      seq,
      timestamp,
      ...partial,
    } as AgentEvent;

    const ts = new Date().toISOString().split('T')[1].slice(0, -1);
    console.log(`[${ts}] [ClaudeAgent] emit: ${event.type} (seq=${seq})${extra ? ` (${extra})` : ''}`);

    const session = this.sessions.get(sessionId);
    if (session?.onEvent) {
      session.onEvent(event);
    }
  }

  // ---- 生命周期 ----

  async createSession(options: {
    id: string;
    cwd: string;
    model?: string;
    onEvent: (event: AgentEvent) => void;
  }): Promise<ClaudeSession> {
    const session: ClaudeSession = {
      id: options.id,
      status: 'idle',
      query: null,
      cwd: options.cwd,
      model: options.model,
      conversationHistory: [],
      onEvent: options.onEvent,
      interrupt: () => {},
      stop: () => {},
    };

    this.sessions.set(options.id, session);
    return session;
  }

  // ---- 流式事件处理 ----

  private handleStreamEvent(session: ClaudeSession, sessionId: string, msg: SDKPartialAssistantMessage) {
    const event = msg.event as any;
    const eventType = event.type as string;
    console.log(`[ClaudeAgent] stream_event: type=${eventType}`);

    // 透传原始事件（调试用）
    this.emit(sessionId, {
      type: 'raw_stream_event',
      data: { event },
    });

    switch (eventType) {
      case 'content_block_delta': {
        const delta = event.delta;
        if (delta?.type === 'thinking_delta' && delta?.thinking) {
          this.emit(sessionId, {
            type: 'thinking_delta',
            data: { text: delta.thinking },
          });
        } else if (delta?.type === 'text_delta' && delta?.text) {
          this.emit(sessionId, {
            type: 'text_delta',
            data: { text: delta.text },
          });
        } else if (delta?.type === 'input_json_delta' && delta?.input) {
          this.emit(sessionId, {
            type: 'tool_use_input_delta',
            data: {
              tool_use_id: session.pendingToolUseId,
              input_json_delta: delta.input,
            },
          });
        }
        break;
      }

      case 'content_block_start': {
        const contentBlock = event.content_block;
        if (contentBlock?.type === 'tool_use') {
          const toolUseId = contentBlock.id || `tool-${Date.now()}`;
          session.pendingToolUseId = toolUseId;
          this.emit(sessionId, {
            type: 'tool_use_start',
            data: {
              tool_use_id: toolUseId,
              name: contentBlock.name,
              input: {},
            },
          });
        } else if (contentBlock?.type === 'thinking') {
          this.emit(sessionId, {
            type: 'thinking_start',
            data: {},
          });
        }
        break;
      }

      case 'content_block_stop':
      case 'message_stop':
      case 'ping':
        break;

      default:
        break;
    }
  }

  // ---- 发送消息 ----

  async sendMessage(sessionId: string, message: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session ${sessionId} not found`);

    session.status = 'running';
    const startTime = Date.now();

    console.log(`[ClaudeAgent] sendMessage start: "${message.slice(0, 50)}..."`);

    // message_start —— 前端用于占位
    this.emit(sessionId, {
      type: 'message_start',
      data: { messageId: `msg-${Date.now()}` },
    });

    // session_init —— 标记会话活跃
    this.emit(sessionId, {
      type: 'session_init',
      data: {},
    });

    try {
      console.log(`[ClaudeAgent] creating query...`);
      const queryStart = Date.now();

      const q = query({
        prompt: message,
        options: {
          cwd: session.cwd,
          model: session.model,
          permissionMode: 'bypassPermissions',
          includePartialMessages: true,
        },
      });

      console.log(`[ClaudeAgent] query created in ${Date.now() - queryStart}ms, starting iteration`);
      session.query = q;
      session.interrupt = () => q.interrupt();
      session.stop = () => q.close();

      let msgCount = 0;
      for await (const msg of q) {
        const iterStart = Date.now();
        msgCount++;
        session.conversationHistory.push(msg);

        switch (msg.type) {
          case 'assistant':
            console.log(`[ClaudeAgent] msg[${msgCount}] assistant: ${JSON.stringify(msg.message.content?.[0])?.slice(0, 100)}`);
            if (msg.message.content?.[0]?.type === 'tool_use') {
              const toolBlock = msg.message.content[0];
              const toolUseId = toolBlock.id || `tool-${Date.now()}`;
              session.pendingToolUseId = toolUseId;
              this.emit(sessionId, {
                type: 'tool_use_start',
                data: {
                  tool_use_id: toolUseId,
                  name: toolBlock.name,
                  input: toolBlock.input || {},
                },
              });
              if (toolBlock.input) {
                this.emit(sessionId, {
                  type: 'tool_use_input_delta',
                  data: {
                    tool_use_id: toolUseId,
                    input_json_delta: JSON.stringify(toolBlock.input),
                  },
                });
              }
            }
            break;

          case 'stream_event':
            this.handleStreamEvent(session, sessionId, msg as SDKPartialAssistantMessage);
            break;

          case 'result':
            console.log(`[ClaudeAgent] msg[${msgCount}] result: ${JSON.stringify(msg).slice(0, 200)}`);
            if ('subtype' in msg && (msg as any).subtype?.startsWith('error_')) {
              this.emit(sessionId, {
                type: 'error',
                data: { error: (msg as any).subtype },
              });
              session.status = 'done';
              return;
            }
            // 完成
            this.emit(sessionId, {
              type: 'assistant_complete',
              data: { message: msg },
            });
            // 通知本轮结束
            this.emit(sessionId, {
              type: 'turn_done',
              data: {},
            });
            session.status = 'done';
            console.log(`[ClaudeAgent] completed in ${Date.now() - startTime}ms`);
            return;

          case 'system':
            console.log(`[ClaudeAgent] msg[${msgCount}] system: ${(msg as any).subtype || 'unknown'}`);
            if ((msg as any).subtype === 'init') {
              this.emit(sessionId, {
                type: 'session_init',
                data: { message: msg },
              });
            }
            break;

          default:
            console.log(`[ClaudeAgent] msg[${msgCount}] unknown type: ${msg.type}`);
        }
        console.log(`[ClaudeAgent] msg processed in ${Date.now() - iterStart}ms`);
      }

      // 循环正常结束（无 result 消息时的兜底）
      session.status = 'done';
      this.emit(sessionId, {
        type: 'turn_done',
        data: {},
      });
    } catch (err) {
      console.log(`[ClaudeAgent] error after ${Date.now() - startTime}ms: ${(err as Error).message}`);
      this.emit(sessionId, {
        type: 'error',
        data: { error: (err as Error).message || 'Unknown error' },
      });
      session.status = 'done';
      throw err;
    }
  }
}
