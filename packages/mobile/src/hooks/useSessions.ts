// useSessions —— React Query 包装 session 列表
//
// 暴露：
//   - useSessions()           ：useQuery，staleTime 30s，queryKey 包含 serverUrl
//   - useCreateSession()      ：useMutation，成功后 invalidate
//   - useDeleteSession()      ：useMutation，成功后 invalidate
//   - useSession(id)          ：按 id 拉取单个 session（可选）
//
// serverUrl 变化时 queryKey 变化，React Query 自动 refetch。

import { useSyncExternalStore } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore } from '../stores/settingsStore';
import type { CreateSessionRequest, Session } from '@openz/shared';

import createDebug from 'debug';
const log = createDebug('openz:http');

const STALE_TIME = 30 * 1000;

/** 解析当前 serverUrl（保证 queryKey 一致；订阅 store 变化以触发重新渲染） */
function useServerUrl(): string {
  // 用 useSyncExternalStore 订阅 settingsStore
  return useSyncExternalStore(
    (cb) => useSettingsStore.subscribe(cb),
    () => useSettingsStore.getState().serverUrl,
    () => '',
  );
}

/** GET /sessions */
async function fetchSessions(serverUrl: string): Promise<Session[]> {
  log('→ GET', `${serverUrl}/sessions`);
  const t0 = Date.now();
  const resp = await fetch(`${serverUrl}/sessions`);
  log('← GET /sessions', resp.status, 'in', Date.now() - t0, 'ms');
  if (!resp.ok) throw new Error(`fetchSessions: ${resp.status}`);
  const data = await resp.json();
  log('  sessions count=', (data.sessions ?? []).length);
  return data.sessions ?? [];
}

/** POST /sessions */
async function createSessionApi(
  serverUrl: string,
  req: CreateSessionRequest,
): Promise<Session> {
  log('→ POST', `${serverUrl}/sessions`, 'body=', JSON.stringify(req));
  const t0 = Date.now();
  const resp = await fetch(`${serverUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  log('← POST /sessions', resp.status, 'in', Date.now() - t0, 'ms');
  if (!resp.ok) throw new Error(`createSession: ${resp.status}`);
  const data = await resp.json();
  const session = data.session ?? data;
  log('  created session id=', session?.id);
  return session;
}

/** DELETE /sessions/:id */
async function deleteSessionApi(serverUrl: string, sessionId: string): Promise<void> {
  log('→ DELETE', `${serverUrl}/sessions/${sessionId}`);
  const t0 = Date.now();
  const resp = await fetch(`${serverUrl}/sessions/${sessionId}`, { method: 'DELETE' });
  log('← DELETE /sessions/:id', resp.status, 'in', Date.now() - t0, 'ms');
  if (!resp.ok) throw new Error(`deleteSession: ${resp.status}`);
}

/** GET /sessions/:id/events?after=<seq> */
async function fetchSessionHistory(
  serverUrl: string,
  sessionId: string,
  after?: number,
): Promise<unknown[]> {
  const url = `${serverUrl}/sessions/${sessionId}/events${after !== undefined ? `?after=${after}` : ''}`;
  log('→ GET', url);
  const t0 = Date.now();
  const resp = await fetch(url);
  log('← GET events', resp.status, 'in', Date.now() - t0, 'ms');
  if (!resp.ok) throw new Error(`fetchSessionHistory: ${resp.status}`);
  const data = await resp.json();
  log('  events count=', (data.events ?? []).length);
  return data.events ?? [];
}

/** 列表查询 */
export function useSessions() {
  const serverUrl = useServerUrl();
  return useQuery({
    queryKey: ['sessions', serverUrl],
    queryFn: () => fetchSessions(serverUrl),
    staleTime: STALE_TIME,
    enabled: Boolean(serverUrl),
  });
}

/** 创建 session */
export function useCreateSession() {
  const qc = useQueryClient();
  const serverUrl = useServerUrl();
  return useMutation({
    mutationFn: (req: CreateSessionRequest) => createSessionApi(serverUrl, req),
    onSuccess: () => {
      log('createSession success, invalidating list');
      qc.invalidateQueries({ queryKey: ['sessions', serverUrl] });
    },
    onError: (err: any) => log('✗ createSession error:', err?.message ?? err),
  });
}

/** 删除 session */
export function useDeleteSession() {
  const qc = useQueryClient();
  const serverUrl = useServerUrl();
  return useMutation({
    mutationFn: (sessionId: string) => deleteSessionApi(serverUrl, sessionId),
    onSuccess: () => {
      log('deleteSession success, invalidating list');
      qc.invalidateQueries({ queryKey: ['sessions', serverUrl] });
    },
    onError: (err: any) => log('✗ deleteSession error:', err?.message ?? err),
  });
}

/** 单个 session 历史（可选，用于断线重连恢复） */
export function useSessionHistory(sessionId: string | null, after?: number) {
  const serverUrl = useServerUrl();
  return useQuery({
    queryKey: ['sessions', serverUrl, sessionId, 'events', after ?? 0],
    queryFn: () => fetchSessionHistory(serverUrl!, sessionId!, after),
    staleTime: STALE_TIME,
    enabled: Boolean(serverUrl && sessionId),
  });
}
