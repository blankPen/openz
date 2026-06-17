// 阶段 1 只放阶段 1/2 需要的占位文案;阶段 2 实现时再补充
export const STRINGS = {
  appName: 'OpenZ',
  chat: {
    placeholder: '尽管问,带图也行',
    placeholderActive: '接着问 OpenZ…',
    send: '发送',
    mic: '语音输入',
    attachment: '附件',
  },
  watermark: '内容由 AI 生成',
  status: {
    connecting: '正在连接…',
    connected: '已连接',
    disconnected: '已断开',
  },
  error: {
    sendFailed: '发送失败,已自动重试',
    networkLost: '网络断开,正在重连…',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t<K extends StringKey>(key: K): typeof STRINGS[K] {
  return STRINGS[key];
}
