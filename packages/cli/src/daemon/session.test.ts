import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SessionManager } from './session.js';
import type { Agent, AgentSession } from '../agents/mod.js';

// Mock fs module
vi.mock('fs', () => ({
  existsSync: vi.fn().mockReturnValue(false),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn().mockReturnValue('[]'),
  writeFileSync: vi.fn(),
}));

describe('SessionManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a session with generated id', async () => {
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: vi.fn(),
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    const session = await manager.createSession({ cwd: '/tmp' });

    expect(session.id).toBeDefined();
    expect(session.engine).toBe('claude');
    expect(session.cwd).toBe('/tmp');
    expect(session.status).toBe('idle');
  });

  it('returns all sessions', async () => {
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: vi.fn(),
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    await manager.createSession({ cwd: '/tmp' });
    await manager.createSession({ cwd: '/home' });

    const sessions = manager.getAllSessions();
    expect(sessions).toHaveLength(2);
  });

  it('deletes a session', async () => {
    const stopMock = vi.fn();
    const mockAgent: Agent = {
      name: 'test',
      createSession: vi.fn().mockResolvedValue({
        id: 'test-id',
        status: 'idle',
        interrupt: vi.fn(),
        stop: stopMock,
      } as AgentSession),
      sendMessage: vi.fn(),
    };

    const manager = new SessionManager(mockAgent);
    const session = await manager.createSession({ cwd: '/tmp' });
    manager.deleteSession(session.id);

    expect(manager.getAllSessions()).toHaveLength(0);
    expect(stopMock).toHaveBeenCalled();
  });
});
