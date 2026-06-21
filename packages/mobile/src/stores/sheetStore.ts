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
  // drawer
  drawerVisible: boolean;
  setDrawerVisible: (v: boolean) => void;
  // model sheet
  modelSheetVisible: boolean;
  openModelSheet: () => void;
  closeModelSheet: () => void;
  // attachment sheet
  attachmentSheetVisible: boolean;
  openAttachmentSheet: () => void;
  closeAttachmentSheet: () => void;
  // settings sheet
  settingsVisible: boolean;
  openSettings: () => void;
  closeSettings: () => void;
  // generic
  openSheet: (key: SheetKey) => void;
  closeSheet: () => void;
  getSheetMeta: (key: SheetKey) => SheetMeta;
};

export const useSheetStore = create<SheetState>((set) => ({
  ...DEFAULTS,
  drawerVisible: false,
  setDrawerVisible: (drawerVisible) => set({ drawerVisible }),
  modelSheetVisible: false,
  openModelSheet: () => set({ modelSheetVisible: true }),
  closeModelSheet: () => set({ modelSheetVisible: false }),
  attachmentSheetVisible: false,
  openAttachmentSheet: () => set({ attachmentSheetVisible: true }),
  closeAttachmentSheet: () => set({ attachmentSheetVisible: false }),
  settingsVisible: false,
  openSettings: () => set({ settingsVisible: true }),
  closeSettings: () => set({ settingsVisible: false }),
  openSheet: (key) => {
    set({ activeSheet: key });
  },
  closeSheet: () => {
    set({ activeSheet: null });
  },
  getSheetMeta: (key) => SHEET_META[key],
}));
