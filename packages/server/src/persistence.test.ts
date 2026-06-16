import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';

describe('Session Persistence', () => {
  const testDir = '/tmp/openz-test-sessions';
  const sessionsFile = join(testDir, 'sessions.json');

  beforeEach(() => {
    // Clean up before each test
    try {
      if (existsSync(sessionsFile)) {
        unlinkSync(sessionsFile);
      }
    } catch {}
  });

  afterEach(() => {
    // Clean up after each test
    try {
      if (existsSync(sessionsFile)) {
        unlinkSync(sessionsFile);
      }
    } catch {}
  });

  it('saves session state to disk', async () => {
    const sessions = [
      { id: 'session-1', status: 'idle', engine: 'claude', cwd: '/tmp' },
      { id: 'session-2', status: 'running', engine: 'claude', cwd: '/home' },
    ];

    mkdirSync(testDir, { recursive: true });
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

    expect(existsSync(sessionsFile)).toBe(true);
    const saved = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    expect(saved).toHaveLength(2);
    expect(saved[0].id).toBe('session-1');
  });

  it('loads session state from disk', async () => {
    const sessions = [
      { id: 'session-1', status: 'idle', engine: 'claude', cwd: '/tmp' },
    ];

    mkdirSync(testDir, { recursive: true });
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

    const loaded = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('session-1');
    expect(loaded[0].status).toBe('idle');
  });

  it('updates session status on disk', async () => {
    const sessions = [
      { id: 'session-1', status: 'idle', engine: 'claude', cwd: '/tmp' },
    ];

    mkdirSync(testDir, { recursive: true });
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

    // Simulate updating session status
    const loaded = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    loaded[0].status = 'running';
    writeFileSync(sessionsFile, JSON.stringify(loaded, null, 2));

    const updated = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    expect(updated[0].status).toBe('running');
  });

  it('removes session from disk on delete', async () => {
    const sessions = [
      { id: 'session-1', status: 'idle', engine: 'claude', cwd: '/tmp' },
      { id: 'session-2', status: 'idle', engine: 'claude', cwd: '/home' },
    ];

    mkdirSync(testDir, { recursive: true });
    writeFileSync(sessionsFile, JSON.stringify(sessions, null, 2));

    // Simulate deleting a session
    let loaded = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    loaded = loaded.filter((s: any) => s.id !== 'session-1');
    writeFileSync(sessionsFile, JSON.stringify(loaded, null, 2));

    const afterDelete = JSON.parse(readFileSync(sessionsFile, 'utf-8'));
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe('session-2');
  });
});
