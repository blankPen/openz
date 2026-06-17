import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../src/ThemeProvider';
import { useTheme } from '../src/hooks/useTheme';

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{`${t.isDark}-${t.mode}`}</Text>;
}

describe('ThemeProvider', () => {
  test('默认 mode=system 时,isDark 由系统决定;无 Provider 时 useTheme 抛错', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });

  test('mode=light 强制浅色', () => {
    const { getByTestId } = render(
      <ThemeProvider initialMode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('false-light');
  });

  test('mode=dark 强制深色', () => {
    const { getByTestId } = render(
      <ThemeProvider initialMode="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('true-dark');
  });
});
