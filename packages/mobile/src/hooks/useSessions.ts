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
  const resp = await fetch(`${serverUrl}/sessions`);
  if (!resp.ok) throw new Error(`fetchSessions: ${resp.status}`);
  const data = await resp.json();
  return data.sessions ?? [];
}

/** POST /sessions */
async function createSessionApi(
  serverUrl: string,
  req: CreateSessionRequest,
): Promise<Session> {
  const resp = await fetch(`${serverUrl}/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  if (!resp.ok) throw new Error(`createSession: ${resp.status}`);
  const data = await resp.json();
  return data.session;
}

/** DELETE /sessions/:id */
async function deleteSessionApi(serverUrl: string, sessionId: string): Promise<void> {
  const resp = await fetch(`${serverUrl}/sessions/${sessionId}`, { method: 'DELETE' });
  if (!resp.ok) throw new Error(`deleteSession: ${resp.status}`);
}

/** GET /sessions/:id/events?after=<seq> */
async function fetchSessionHistory(
  serverUrl: string,
  sessionId: string,
  after?: number,
): Promise<unknown[]> {
  const url = `${serverUrl}/sessions/${sessionId}/events${after !== undefined ? `?after=${after}` : ''}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`fetchSessionHistory: ${resp.status}`);
  const data = await resp.json();
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
      qc.invalidateQueries({ queryKey: ['sessions', serverUrl] });
    },
  });
}

/** 删除 session */
export function useDeleteSession() {
  const qc = useQueryClient();
  const serverUrl = useServerUrl();
  return useMutation({
    mutationFn: (sessionId: string) => deleteSessionApi(serverUrl, sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sessions', serverUrl] });
    },
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
