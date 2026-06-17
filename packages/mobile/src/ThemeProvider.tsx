import { useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { ThemeContext, type ThemeContextValue } from './hooks/useTheme';
import { tokens } from './theme/tokens';
import { lightPalette } from './theme/light';
import { darkPalette } from './theme/dark';
import { useSettingsStore, type ThemeMode } from './stores/settingsStore';

type Props = {
  children: ReactNode;
  initialMode?: ThemeMode; // 测试与 SSR 用,生产从 settingsStore 读
};

export function ThemeProvider({ children, initialMode }: Props) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const storedMode = useSettingsStore((s) => s.themeMode);
  const setMode = useSettingsStore((s) => s.setThemeMode);

  const mode = initialMode ?? storedMode;
  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemScheme === 'dark';
  }, [mode, systemScheme]);

  const value: ThemeContextValue = useMemo(
    () => ({
      mode,
      isDark,
      palette: isDark ? darkPalette : lightPalette,
      tokens,
      setMode,
    }),
    [mode, isDark, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
