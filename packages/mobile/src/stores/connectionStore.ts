// connectionStore —— 连接状态 store（占位/接口约定）
//
// 本文件由 Agent A 完整实现。当前仅为契约占位，确保 Phase B 的 useSocket
// 可以编译通过；Agent A 会替换为本实现。
//
// 约定字段：
//   status: 'connected' | 'connecting' | 'disconnected'
//   failCount: number
//   lastError: string | null
// 约定方法：
//   markConnected(): void
//   recordConnectError(err: string): void
//   recordPingTimeout(): void

import { create } from 'zustand';

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected';

type ConnectionState = {
  status: ConnectionStatus;
  failCount: number;
  lastError: string | null;
  markConnected: () => void;
  recordConnectError: (err: string) => void;
  recordPingTimeout: () => void;
};

export const useConnectionStore = create<ConnectionState>((set) => ({
  status: 'disconnected',
  failCount: 0,
  lastError: null,
  markConnected: () => set({ status: 'connected', failCount: 0, lastError: null }),
  recordConnectError: (err) =>
    set((s) => ({ status: 'disconnected', failCount: s.failCount + 1, lastError: err })),
  recordPingTimeout: () =>
    set((s) => ({ failCount: s.failCount + 1, lastError: 'ping timeout' })),
}));
