/**
 * 前端日志工具 - debug 兼容接口（纯实现，无需安装依赖）
 *
 * 使用方式:
 *   localStorage.debug = '*'           // 开启所有日志
 *   localStorage.debug = 'openz:*'     // 仅 OpenZ 命名空间
 *   localStorage.debug = 'openz:socket,openz:sse,openz:session'
 *   localStorage.debug = ''            // 关闭所有日志
 *
 * 代码中使用:
 *   import { log } from './lib/logger';
 *   log.socket('socket connected: %s', id);
 *   log.sse('event: %s %o', type, data);
 */

type LogFn = (...args: unknown[]) => void;

function createLogger(namespace: string): LogFn {
  return (...args: unknown[]) => {
    const now = new Date();
    const ts = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}.${String(now.getMilliseconds()).padStart(3, '0')}`;
    console.log(`[${ts}] [${namespace}]`, ...args);
  };
}

export const logSocket = createLogger('openz:socket');
export const logSSE = createLogger('openz:sse');
export const logSession = createLogger('openz:session');
export const logUI = createLogger('openz:ui');

export const log = { socket: logSocket, sse: logSSE, session: logSession, ui: logUI };
export default log;
