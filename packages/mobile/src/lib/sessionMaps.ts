/** 共享的 session ↔ conversation 映射表（模块级别单例） */

export const sessionToConvMap = new Map<string, string>();
export const convToSessionMap = new Map<string, string>();

export function clearSessionMaps() {
  sessionToConvMap.clear();
  convToSessionMap.clear();
}
