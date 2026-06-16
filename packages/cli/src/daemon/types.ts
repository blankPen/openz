// Daemon 内部类型占位
export interface DaemonState {
  pid: number;
  port: number;
  version: string;
  startedAt: number;
}

export const DEFAULT_PORT = 19999;

export function getDaemonStatePath(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return `${home}/.uran/daemon.state.json`;
}
