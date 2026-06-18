// 端到端验证：mobile 端通过 HTTP REST + SSE 与 daemon 通信的完整链路
//
// 假设 daemon 已在 localhost:19999 direct 模式运行（无 TTS）。
// 测试覆盖 mobile useSessions / useSessionStream / settingsStore 实际会调用的端点。

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';

const BASE = 'http://localhost:19999';

interface Session {
  id: string;
  engine: string;
  cwd: string;
  status: string;
  createdAt: number;
}

let createdSessionId: string;

beforeAll(async () => {
  // 健康检查
  const r = await fetch(`${BASE}/sessions`);
  if (!r.ok) throw new Error(`daemon not reachable: ${r.status}`);
});

afterAll(async () => {
  // 清理：删掉创建的 session
  if (createdSessionId) {
    await fetch(`${BASE}/sessions/${createdSessionId}`, { method: 'DELETE' });
  }
});

describe('Mobile ↔ Daemon 端到端', () => {
  it('GET /sessions 返回会话列表（初始空）', async () => {
    const r = await fetch(`${BASE}/sessions`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as { sessions: Session[] };
    expect(Array.isArray(data.sessions)).toBe(true);
  });

  it('POST /sessions 创建会话（mobile useCreateSession 链路）', async () => {
    const r = await fetch(`${BASE}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ engine: 'claude', cwd: '/tmp', model: 'claude-sonnet' }),
    });
    expect(r.status).toBe(201);
    const session = (await r.json()) as Session;
    expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(session.engine).toBe('claude');
    expect(session.status).toBe('idle');
    createdSessionId = session.id;
  });

  it('GET /sessions 现在能看到刚创建的会话', async () => {
    const r = await fetch(`${BASE}/sessions`);
    const data = (await r.json()) as { sessions: Session[] };
    const found = data.sessions.find((s) => s.id === createdSessionId);
    expect(found).toBeDefined();
  });

  it('GET /sessions/:id/events?after=0 拉取空事件列表', async () => {
    const r = await fetch(`${BASE}/sessions/${createdSessionId}/events?after=0`);
    expect(r.status).toBe(200);
    const data = (await r.json()) as { events: unknown[] };
    expect(Array.isArray(data.events)).toBe(true);
  });

  it('POST /sessions/:id/send 错误消息体返回 400', async () => {
    const r = await fetch(`${BASE}/sessions/${createdSessionId}/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '   ' }),
    });
    expect(r.status).toBe(400);
  });

  it('POST /sessions/:id/send 未知 session 返回 404', async () => {
    const r = await fetch(`${BASE}/sessions/nonexistent-id-xyz/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hi' }),
    });
    expect(r.status).toBe(404);
  });

  it('POST /sessions/:id/interrupt 状态转为 interrupted', async () => {
    const r = await fetch(`${BASE}/sessions/${createdSessionId}/interrupt`, { method: 'POST' });
    expect(r.status).toBe(200);
    const list = await fetch(`${BASE}/sessions`);
    const data = (await list.json()) as { sessions: Session[] };
    const found = data.sessions.find((s) => s.id === createdSessionId);
    expect(found?.status).toBe('interrupted');
  });

  it('DELETE /sessions/:id 成功后列表少一个', async () => {
    const r = await fetch(`${BASE}/sessions/${createdSessionId}`, { method: 'DELETE' });
    expect(r.status).toBe(200);
    const list = await fetch(`${BASE}/sessions`);
    const data = (await list.json()) as { sessions: Session[] };
    expect(data.sessions.find((s) => s.id === createdSessionId)).toBeUndefined();
    createdSessionId = ''; // 防止 afterAll 再删
  });

  it('GET /unknown 返回 404（路由守卫）', async () => {
    const r = await fetch(`${BASE}/unknown-path`);
    expect(r.status).toBe(404);
  });
});
