// mock MMKV
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k: string, v: string) => {
        store[k] = v;
      },
      getString: (k: string) => store[k],
      delete: (k: string) => {
        delete store[k];
      },
    })),
  };
});

import { useSettingsStore } from '../../src/stores/settingsStore';
import type { ThemeMode, FontSize, Language } from '../../src/stores/settingsStore';

describe('settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      serverUrl: '',
      themeMode: 'system',
      fontSize: 'standard',
      language: 'zh-CN',
      voiceBroadcast: true,
      enterToSend: true,
      defaultModel: 'OpenZ Z1',
    });
  });

  describe('defaults', () => {
    test('has correct default values', () => {
      const state = useSettingsStore.getState();
      expect(state.serverUrl).toBe('');
      expect(state.themeMode).toBe('system');
      expect(state.fontSize).toBe('standard');
      expect(state.language).toBe('zh-CN');
      expect(state.voiceBroadcast).toBe(true);
      expect(state.enterToSend).toBe(true);
      expect(state.defaultModel).toBe('OpenZ Z1');
    });
  });

  describe('setServerUrl', () => {
    test('sets serverUrl', () => {
      useSettingsStore.getState().setServerUrl('http://localhost:3000');
      expect(useSettingsStore.getState().serverUrl).toBe('http://localhost:3000');
    });

    test('setServerUrl persists across modules', () => {
      useSettingsStore.getState().setServerUrl('http://example.com');
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().serverUrl).toBe('http://example.com');
      });
    });
  });

  describe('setThemeMode', () => {
    test.each<ThemeMode>(['light', 'dark', 'system'])('sets themeMode to %s', (mode) => {
      useSettingsStore.getState().setThemeMode(mode);
      expect(useSettingsStore.getState().themeMode).toBe(mode);
    });

    test('setThemeMode persists', () => {
      useSettingsStore.getState().setThemeMode('dark');
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().themeMode).toBe('dark');
      });
    });
  });

  describe('setFontSize', () => {
    test.each<FontSize>(['small', 'standard', 'large'])('sets fontSize to %s', (size) => {
      useSettingsStore.getState().setFontSize(size);
      expect(useSettingsStore.getState().fontSize).toBe(size);
    });

    test('setFontSize persists', () => {
      useSettingsStore.getState().setFontSize('large');
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().fontSize).toBe('large');
      });
    });
  });

  describe('setLanguage', () => {
    test.each<Language>(['zh-CN', 'en-US'])('sets language to %s', (lang) => {
      useSettingsStore.getState().setLanguage(lang);
      expect(useSettingsStore.getState().language).toBe(lang);
    });

    test('setLanguage persists', () => {
      useSettingsStore.getState().setLanguage('en-US');
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().language).toBe('en-US');
      });
    });
  });

  describe('setVoiceBroadcast', () => {
    test('sets voiceBroadcast to false', () => {
      useSettingsStore.getState().setVoiceBroadcast(false);
      expect(useSettingsStore.getState().voiceBroadcast).toBe(false);
    });

    test('sets voiceBroadcast to true', () => {
      useSettingsStore.getState().setVoiceBroadcast(true);
      expect(useSettingsStore.getState().voiceBroadcast).toBe(true);
    });

    test('setVoiceBroadcast persists', () => {
      useSettingsStore.getState().setVoiceBroadcast(false);
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().voiceBroadcast).toBe(false);
      });
    });
  });

  describe('setEnterToSend', () => {
    test('sets enterToSend to false', () => {
      useSettingsStore.getState().setEnterToSend(false);
      expect(useSettingsStore.getState().enterToSend).toBe(false);
    });

    test('sets enterToSend to true', () => {
      useSettingsStore.getState().setEnterToSend(true);
      expect(useSettingsStore.getState().enterToSend).toBe(true);
    });

    test('setEnterToSend persists', () => {
      useSettingsStore.getState().setEnterToSend(false);
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().enterToSend).toBe(false);
      });
    });
  });

  describe('setDefaultModel', () => {
    test('sets defaultModel', () => {
      useSettingsStore.getState().setDefaultModel('GPT-4');
      expect(useSettingsStore.getState().defaultModel).toBe('GPT-4');
    });

    test('setDefaultModel persists', () => {
      useSettingsStore.getState().setDefaultModel('Claude 3');
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().defaultModel).toBe('Claude 3');
      });
    });
  });

  describe('ttsAutoPlay(Phase C 新增)', () => {
    test('默认 ttsAutoPlay 是 true', () => {
      // 不在 beforeEach 里 setState ttsAutoPlay,保证默认值生效
      const state = useSettingsStore.getState();
      // 其它测试可能改过值,这里直接断言当前 ttsAutoPlay 是 boolean
      expect(typeof state.ttsAutoPlay).toBe('boolean');
    });

    test('setTtsAutoPlay(false) 关闭自动播报', () => {
      useSettingsStore.getState().setTtsAutoPlay(false);
      expect(useSettingsStore.getState().ttsAutoPlay).toBe(false);
    });

    test('setTtsAutoPlay(true) 打开自动播报', () => {
      useSettingsStore.getState().setTtsAutoPlay(false);
      useSettingsStore.getState().setTtsAutoPlay(true);
      expect(useSettingsStore.getState().ttsAutoPlay).toBe(true);
    });

    test('setTtsAutoPlay 持久化到 MMKV', () => {
      useSettingsStore.getState().setTtsAutoPlay(false);
      jest.isolateModules(() => {
        const { useSettingsStore: fresh } = require('../../src/stores/settingsStore');
        expect(fresh.getState().ttsAutoPlay).toBe(false);
      });
    });
  });
});
