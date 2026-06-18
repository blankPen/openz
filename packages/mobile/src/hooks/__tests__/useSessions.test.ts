// 测试 src/hooks/useSessions.ts —— React Query 包装 session 列表

const mockSettingsGetState = jest.fn(() => ({ serverUrl: 'http://localhost:3000' }));
let mockSettingsStateRef: { serverUrl: string } = { serverUrl: 'http://localhost:3000' };
const settingsListeners: Array<() => void> = [];
jest.mock('../../stores/settingsStore', () => ({
  useSettingsStore: {
    getState: () => mockSettingsStateRef,
    subscribe: (cb: () => void) => {
      settingsListeners.push(cb);
      return () => {
        const i = settingsListeners.indexOf(cb);
        if (i >= 0) settingsListeners.splice(i, 1);
      };
    },
    setState: (next: { serverUrl: string }) => {
      mockSettingsStateRef = next;
      settingsListeners.forEach((l) => l());
    },
  },
}));

const originalFetch = (globalThis as any).fetch;
let mockFetchImpl: jest.Mock;
let mockFetchCalls: { url: string; init?: any }[] = [];

beforeAll(() => {
  if (typeof (globalThis as any).ReadableStream === 'undefined') {
    (globalThis as any).ReadableStream = ReadableStream;
  }
});

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor, act } from '@testing-library/react-native';
import React from 'react';

function makeWrapper(qc: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: qc }, children);
  };
}

describe('useSessions', () => {
  let qc: QueryClient;

  beforeEach(() => {
    mockSettingsStateRef = { serverUrl: 'http://localhost:3000' };
    mockFetchCalls = [];
    mockFetchImpl = jest.fn(async (url: string, init?: any) => {
      mockFetchCalls.push({ url, init });
      // 简单的回声 mock
      if (url.endsWith('/sessions') && (!init || init.method === undefined || init.method === 'GET')) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ sessions: [{ id: 's1', engine: 'claude', cwd: '/', status: 'idle', createdAt: 1 }] }),
        } as any;
      }
      if (url.endsWith('/sessions') && init?.method === 'POST') {
        const body = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            session: { id: body.id ?? 'new-id', engine: 'claude', cwd: body.cwd ?? '/', status: 'idle', createdAt: Date.now() },
          }),
        } as any;
      }
      const m = url.match(/\/sessions\/([^/]+)$/);
      if (m && init?.method === 'DELETE') {
        return { ok: true, status: 200, json: async () => ({}) } as any;
      }
      return { ok: false, status: 404, json: async () => ({ error: 'not found' }) } as any;
    });
    (globalThis as any).fetch = mockFetchImpl;
    qc = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
    });
  });
  afterEach(() => {
    (globalThis as any).fetch = originalFetch;
  });

  it('useSessions 返回 Session 列表', async () => {
    const { useSessions } = require('../useSessions');
    const { result } = renderHook(() => useSessions(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([
      expect.objectContaining({ id: 's1', engine: 'claude', status: 'idle' }),
    ]);
    expect(mockFetchCalls.some((c) => c.url.endsWith('/sessions'))).toBe(true);
  });

  it('useCreateSession 成功后 invalidate list', async () => {
    const { useCreateSession, useSessions } = require('../useSessions');
    const { result } = renderHook(
      () => ({ create: useCreateSession(), list: useSessions() }),
      { wrapper: makeWrapper(qc) },
    );
    await waitFor(() => expect(result.current.list.isLoading).toBe(false));
    const callsBefore = mockFetchCalls.length;
    await act(async () => {
      await result.current.create.mutateAsync({ cwd: '/p' });
    });
    await waitFor(() => expect(mockFetchCalls.length).toBeGreaterThan(callsBefore));
    // 应有 POST /sessions 调用
    const posts = mockFetchCalls.filter((c) => c.url.endsWith('/sessions') && c.init?.method === 'POST');
    expect(posts.length).toBeGreaterThanOrEqual(1);
  });

  it('useDeleteSession 成功后 invalidate list', async () => {
    const { useDeleteSession } = require('../useSessions');
    const invalidateSpy = jest.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteSession(), { wrapper: makeWrapper(qc) });
    await act(async () => {
      await result.current.mutateAsync('s1');
    });
    const deletes = mockFetchCalls.filter((c) => c.init?.method === 'DELETE');
    expect(deletes.length).toBeGreaterThanOrEqual(1);
    expect(invalidateSpy).toHaveBeenCalled();
  });

  it('serverUrl 变化触发 refetch（queryKey 变更）', async () => {
    const { useSessions } = require('../useSessions');
    const { useSettingsStore } = require('../../stores/settingsStore');
    const { result } = renderHook(() => useSessions(), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = mockFetchCalls.length;
    // 切换 serverUrl 并通过 mock 通知订阅者
    await act(async () => {
      useSettingsStore.setState({ serverUrl: 'http://other-host:4000' });
    });
    // 等 React Query 触发新 queryKey 的请求
    await waitFor(() => {
      const newCalls = mockFetchCalls.slice(callsBefore);
      expect(newCalls.some((c) => c.url.includes('other-host:4000'))).toBe(true);
    });
  });
});
