export interface DaemonState {
    pid: number;
    port: number;
    version: string;
    startedAt: number;
}
export declare const DEFAULT_PORT = 19999;
export declare function getDaemonStatePath(): string;
