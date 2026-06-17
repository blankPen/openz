import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const STORAGE_KEY = 'openz-mobile-settings-v1';
const storage = new MMKV({ id: 'openz-settings' });

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'standard' | 'large';
export type Language = 'zh-CN' | 'en-US';

type Persisted = {
  serverUrl: string;
  themeMode: ThemeMode;
  fontSize: FontSize;
  language: Language;
  voiceBroadcast: boolean;
  enterToSend: boolean;
  defaultModel: string;
};

const DEFAULTS: Persisted = {
  serverUrl: '',
  themeMode: 'system',
  fontSize: 'standard',
  language: 'zh-CN',
  voiceBroadcast: true,
  enterToSend: true,
  defaultModel: 'OpenZ Z1',
};

function loadInitial(): Persisted {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

type SettingsState = Persisted & {
  setServerUrl: (v: string) => void;
  setThemeMode: (v: ThemeMode) => void;
  setFontSize: (v: FontSize) => void;
  setLanguage: (v: Language) => void;
  setVoiceBroadcast: (v: boolean) => void;
  setEnterToSend: (v: boolean) => void;
  setDefaultModel: (v: string) => void;
};

function persist(state: Persisted) {
  storage.set(
    STORAGE_KEY,
    JSON.stringify({
      serverUrl: state.serverUrl,
      themeMode: state.themeMode,
      fontSize: state.fontSize,
      language: state.language,
      voiceBroadcast: state.voiceBroadcast,
      enterToSend: state.enterToSend,
      defaultModel: state.defaultModel,
    }),
  );
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitial(),
  setServerUrl: (v) => {
    set({ serverUrl: v });
    persist(get());
  },
  setThemeMode: (v) => {
    set({ themeMode: v });
    persist(get());
  },
  setFontSize: (v) => {
    set({ fontSize: v });
    persist(get());
  },
  setLanguage: (v) => {
    set({ language: v });
    persist(get());
  },
  setVoiceBroadcast: (v) => {
    set({ voiceBroadcast: v });
    persist(get());
  },
  setEnterToSend: (v) => {
    set({ enterToSend: v });
    persist(get());
  },
  setDefaultModel: (v) => {
    set({ defaultModel: v });
    persist(get());
  },
}));
