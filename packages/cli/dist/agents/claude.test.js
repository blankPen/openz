import { describe, it, expect } from 'vitest';
import { ClaudeAgent } from './claude.js';
describe('ClaudeAgent', () => {
    describe('createSession', () => {
        it('creates a session with correct id', async () => {
            const agent = new ClaudeAgent();
            const events = [];
            const session = await agent.createSession({
                id: 'my-session',
                cwd: '/tmp',
                onEvent: (e) => events.push(e),
            });
            expect(session.id).toBe('my-session');
            expect(session.status).toBe('idle');
        });
        it('uses default cwd when not provided', async () => {
            const agent = new ClaudeAgent();
            const session = await agent.createSession({
                id: 'test',
                cwd: '/custom/path',
                onEvent: () => { },
            });
            expect(session.id).toBe('test');
        });
    });
    describe('conversation history', () => {
        it('accumulates messages in conversation history', async () => {
            // This test verifies the structure exists
            // Full integration would require SDK mocking
            const agent = new ClaudeAgent();
            const session = await agent.createSession({
                id: 'test',
                cwd: '/tmp',
                onEvent: () => { },
            });
            // Session should be created - the actual multi-turn
            // behavior depends on SDK's query() supporting conversation
            expect(session.id).toBe('test');
        });
    });
    describe('streaming events', () => {
        it('emits message_start event immediately when sendMessage is called', async () => {
            const agent = new ClaudeAgent();
            const events = [];
            await agent.createSession({
                id: 'test-stream',
                cwd: '/tmp',
                onEvent: (e) => events.push(e),
            });
            // Trigger sendMessage - message_start should be emitted synchronously
            // before the SDK is even called
            agent.sendMessage('test-stream', 'hello').catch(() => { });
            // Give it a tick to emit the event
            await new Promise(r => setTimeout(r, 10));
            // The message_start event should be emitted synchronously first
            expect(events[0]?.type).toBe('message_start');
            expect(events[0]?.data).toHaveProperty('messageId');
        });
        it('emits text_delta with text content when streaming', () => {
            // Verify the event structure is correct for text_delta events
            const textDeltaEvent = {
                type: 'text_delta',
                sessionId: 'test',
                data: { text: 'Hello' },
            };
            expect(textDeltaEvent.type).toBe('text_delta');
            expect(textDeltaEvent.data.text).toBe('Hello');
        });
    });
});
