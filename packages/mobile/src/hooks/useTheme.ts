import { createContext, useContext } from 'react';
import type { Tokens } from '../theme/tokens';
import type { Palette } from '../theme/light';
import type { ThemeMode } from '../stores/settingsStore';

export type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  palette: Palette;
  tokens: Tokens;
  setMode: (m: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
