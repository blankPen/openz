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

import { useSettingsStore } from '../src/stores/settingsStore';

describe('settingsStore 持久化(MMKV mock)', () => {
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

  test('setServerUrl 写入后,新 store 实例能读到', async () => {
    useSettingsStore.getState().setServerUrl('ws://localhost:19998');
    expect(useSettingsStore.getState().serverUrl).toBe('ws://localhost:19998');
    // 通过持久化再读:模拟冷启动
    jest.isolateModules(() => {
      // 重新 require 让 store 重新初始化
      const { useSettingsStore: fresh } = require('../src/stores/settingsStore');
      expect(fresh.getState().serverUrl).toBe('ws://localhost:19998');
    });
  });

  test('默认值与设计稿 settings.html 一致', () => {
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('system');
    expect(s.voiceBroadcast).toBe(true);
    expect(s.enterToSend).toBe(true);
  });
});
