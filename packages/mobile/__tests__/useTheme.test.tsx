import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../src/ThemeProvider';
import { useTheme } from '../src/hooks/useTheme';
import { useSettingsStore } from '../src/stores/settingsStore';

function ModeProbe() {
  const { mode, isDark, setMode } = useTheme();
  return (
    <Text testID="probe" onPress={() => setMode('dark')}>
      {`${mode}-${isDark}`}
    </Text>
  );
}

describe('useTheme + ThemeProvider 联动 settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ themeMode: 'light' });
  });

  test('setMode 写入 settingsStore 后,组件重渲染切换 isDark', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('light-false');
    act(() => {
      getByTestId('probe').props.onPress();
    });
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(getByTestId('probe').props.children).toBe('dark-true');
  });
});
