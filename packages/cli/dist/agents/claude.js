import { query } from '@anthropic-ai/claude-agent-sdk';
export class ClaudeAgent {
    name = 'claude';
    sessions = new Map();
    async createSession(options) {
        const session = {
            id: options.id,
            status: 'idle',
            query: null,
            cwd: options.cwd,
            model: options.model,
            conversationHistory: [],
            onEvent: options.onEvent,
            interrupt: () => {
                // Will be set when query is running
            },
            stop: () => {
                // Will be set when query is running
            },
        };
        this.sessions.set(options.id, session);
        return session;
    }
    emit(sessionId, event, extra) {
        const ts = new Date().toISOString().split('T')[1].slice(0, -1);
        console.log(`[${ts}] [ClaudeAgent] emit: ${event.type}${extra ? ` (${extra})` : ''}`);
        const session = this.sessions.get(sessionId);
        if (session?.onEvent) {
            session.onEvent(event);
        }
    }
    handleStreamEvent(session, sessionId, msg) {
        const event = msg.event; // Use any to bypass strict type checking
        const eventType = event.type;
        console.log(`[ClaudeAgent] stream_event: type=${eventType}`);
        // Forward ALL events to frontend as-is with their raw data
        this.emit(sessionId, {
            type: 'raw_stream_event',
            sessionId,
            data: event,
        });
        // Handle known events
        switch (eventType) {
            case 'content_block_delta': {
                const delta = event.delta;
                if (delta?.type === 'thinking_delta' && delta?.thinking) {
                    this.emit(sessionId, {
                        type: 'thinking_delta',
                        sessionId,
                        data: { text: delta.thinking },
                    });
                }
                else if (delta?.type === 'text_delta' && delta?.text) {
                    this.emit(sessionId, {
                        type: 'text_delta',
                        sessionId,
                        data: { text: delta.text },
                    });
                }
                else if (delta?.type === 'input_json_delta' && delta?.input) {
                    this.emit(sessionId, {
                        type: 'tool_use_input_delta',
                        sessionId,
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
                        sessionId,
                        data: {
                            tool_use_id: toolUseId,
                            name: contentBlock.name,
                            input: {},
                        },
                    });
                }
                else if (contentBlock?.type === 'thinking') {
                    this.emit(sessionId, {
                        type: 'thinking_start',
                        sessionId,
                        data: {},
                    });
                }
                break;
            }
            case 'content_block_stop':
                // Could emit content_block_complete event if needed
                break;
            case 'message_stop':
                // Message complete
                break;
            case 'ping':
                // Ignore ping events
                break;
            default:
                break;
        }
    }
    async sendMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (!session)
            throw new Error(`Session ${sessionId} not found`);
        session.status = 'running';
        const startTime = Date.now();
        console.log(`[ClaudeAgent] sendMessage start: "${message.slice(0, 50)}..."`);
        // Emit message_start immediately so frontend can show placeholder
        this.emit(sessionId, { type: 'message_start', sessionId, data: { messageId: `msg-${Date.now()}` } });
        // Emit session start event
        this.emit(sessionId, { type: 'session_init', sessionId, data: {} });
        try {
            console.log(`[ClaudeAgent] creating query...`);
            const queryStart = Date.now();
            // Note: SDK's query() takes a string prompt for single-turn
            // For multi-turn support, we'd need to use the AsyncIterable approach
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
                // Track conversation for potential multi-turn
                session.conversationHistory.push(msg);
                switch (msg.type) {
                    case 'assistant':
                        console.log(`[ClaudeAgent] msg[${msgCount}] assistant: ${JSON.stringify(msg.message.content?.[0])?.slice(0, 100)}`);
                        if (msg.message.content?.[0]?.type === 'text') {
                            this.emit(sessionId, {
                                type: 'text_delta',
                                sessionId,
                                data: { text: msg.message.content[0].text },
                            });
                        }
                        else if (msg.message.content?.[0]?.type === 'tool_use') {
                            // Handle tool_use content blocks in assistant messages
                            const toolBlock = msg.message.content[0];
                            const toolUseId = toolBlock.id || `tool-${Date.now()}`;
                            session.pendingToolUseId = toolUseId;
                            this.emit(sessionId, {
                                type: 'tool_use_start',
                                sessionId,
                                data: {
                                    tool_use_id: toolUseId,
                                    name: toolBlock.name,
                                    input: toolBlock.input || {},
                                },
                            });
                            // Emit input as delta
                            if (toolBlock.input) {
                                this.emit(sessionId, {
                                    type: 'tool_use_input_delta',
                                    sessionId,
                                    data: {
                                        tool_use_id: toolUseId,
                                        input_json_delta: JSON.stringify(toolBlock.input),
                                    },
                                });
                            }
                        }
                        break;
                    case 'stream_event':
                        this.handleStreamEvent(session, sessionId, msg);
                        break;
                    case 'result':
                        console.log(`[ClaudeAgent] msg[${msgCount}] result: ${JSON.stringify(msg).slice(0, 200)}`);
                        // Check for error subtypes
                        if ('subtype' in msg && msg.subtype?.startsWith('error_')) {
                            this.emit(sessionId, {
                                type: 'error',
                                sessionId,
                                data: { error: msg.subtype },
                            });
                            session.status = 'done';
                            return;
                        }
                        // Normal completion
                        this.emit(sessionId, {
                            type: 'assistant_complete',
                            sessionId,
                            data: msg,
                        });
                        session.status = 'done';
                        console.log(`[ClaudeAgent] completed in ${Date.now() - startTime}ms`);
                        return;
                    case 'system':
                        console.log(`[ClaudeAgent] msg[${msgCount}] system: ${msg.subtype || 'unknown'}`);
                        if (msg.subtype === 'init') {
                            this.emit(sessionId, {
                                type: 'session_init',
                                sessionId,
                                data: msg,
                            });
                        }
                        break;
                    default:
                        console.log(`[ClaudeAgent] msg[${msgCount}] unknown type: ${msg.type}`);
                }
                console.log(`[ClaudeAgent] msg processed in ${Date.now() - iterStart}ms`);
            }
            session.status = 'done';
        }
        catch (err) {
            console.log(`[ClaudeAgent] error after ${Date.now() - startTime}ms: ${err.message}`);
            this.emit(sessionId, {
                type: 'error',
                sessionId,
                data: { error: err.message || 'Unknown error' },
            });
            session.status = 'done';
            throw err;
        }
    }
}
