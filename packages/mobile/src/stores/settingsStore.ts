import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  setThemeMode: (mode) => set({ themeMode: mode }),
}));
