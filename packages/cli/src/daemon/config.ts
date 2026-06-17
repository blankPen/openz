import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

/**
 * 全局配置：daemon 端读取，所有可配项集中放在 ~/.config/openz/setting.json。
 * 遵循 XDG Base Directory：$XDG_CONFIG_HOME 缺省为 ~/.config。
 *
 * 配置不存在或字段缺失时使用缺省值；解析失败时打 warning 并回退到缺省值。
 */
export interface OpenzConfig {
  /** 中继 server 的 WebSocket URL（relay 模式下连这个） */
  serverUrl: string;
  /** 语音合成相关 */
  tts: {
    appkey: string;
    resourceId: string;
    voiceType: string;
    sampleRate: number;
    encoding: string;
  };
  /** daemon 自身（直连模式 fallback 用） */
  daemon: {
    port: number;
  };
}

export const DEFAULT_CONFIG: OpenzConfig = {
  serverUrl: 'ws://localhost:19998',
  tts: {
    appkey: '',
    resourceId: 'seed-tts-2.0',
    voiceType: 'saturn_zh_female_aojiaonvyou_tob',
    sampleRate: 24000,
    encoding: 'pcm',
  },
  daemon: {
    port: 19999,
  },
};

function getConfigPath(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), '.config');
  return join(base, 'openz', 'setting.json');
}

/**
 * 加载全局配置：先尝试 setting.json，再与 DEFAULT_CONFIG 浅合并。
 * 文件不存在时静默回退到缺省值；解析失败时打 warning。
 */
export function loadConfig(): OpenzConfig {
  const path = getConfigPath();
  if (!existsSync(path)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf-8'));
    return mergeConfig(DEFAULT_CONFIG, raw);
  } catch (err) {
    console.warn(`[openz/config] failed to parse ${path}:`, err);
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * 浅/深合并：用 patch 覆盖 base 的同名字段；不修改任何入参。
 */
function mergeConfig(base: OpenzConfig, patch: any): OpenzConfig {
  return {
    serverUrl: typeof patch?.serverUrl === 'string' ? patch.serverUrl : base.serverUrl,
    tts: {
      appkey: typeof patch?.tts?.appkey === 'string' ? patch.tts.appkey : base.tts.appkey,
      resourceId: typeof patch?.tts?.resourceId === 'string' ? patch.tts.resourceId : base.tts.resourceId,
      voiceType: typeof patch?.tts?.voiceType === 'string' ? patch.tts.voiceType : base.tts.voiceType,
      sampleRate: typeof patch?.tts?.sampleRate === 'number' ? patch.tts.sampleRate : base.tts.sampleRate,
      encoding: typeof patch?.tts?.encoding === 'string' ? patch.tts.encoding : base.tts.encoding,
    },
    daemon: {
      port: typeof patch?.daemon?.port === 'number' ? patch.daemon.port : base.daemon.port,
    },
  };
}
