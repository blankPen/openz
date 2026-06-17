import { useSettingsStore } from '../src/stores/settingsStore';

describe('settingsStore(最小实现)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ themeMode: 'system' });
  });

  test('默认 themeMode 是 system', () => {
    expect(useSettingsStore.getState().themeMode).toBe('system');
  });

  test('setThemeMode 更新状态', () => {
    useSettingsStore.getState().setThemeMode('dark');
    expect(useSettingsStore.getState().themeMode).toBe('dark');
  });
});
