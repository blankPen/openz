import { create } from 'zustand';

export type SheetKey = 'chat' | 'model' | 'settings' | 'about';

type SheetMeta = {
  title: string;
};

const SHEET_META: Record<SheetKey, SheetMeta> = {
  chat: { title: '聊天设置' },
  model: { title: '切换模型' },
  settings: { title: '设置' },
  about: { title: '关于' },
};

type Persisted = {
  activeSheet: SheetKey | null;
};

const DEFAULTS: Persisted = {
  activeSheet: null,
};

type SheetState = Persisted & {
  openSheet: (key: SheetKey) => void;
  closeSheet: () => void;
  getSheetMeta: (key: SheetKey) => SheetMeta;
};

export const useSheetStore = create<SheetState>((set) => ({
  ...DEFAULTS,
  openSheet: (key) => {
    set({ activeSheet: key });
  },
  closeSheet: () => {
    set({ activeSheet: null });
  },
  getSheetMeta: (key) => SHEET_META[key],
}));
