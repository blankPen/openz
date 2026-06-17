import { useSheetStore } from '../../src/stores/sheetStore';

describe('sheetStore', () => {
  beforeEach(() => {
    useSheetStore.setState({ activeSheet: null });
  });

  test('默认无活跃 sheet', () => {
    expect(useSheetStore.getState().activeSheet).toBeNull();
  });

  test('openSheet 设置活跃 sheet', () => {
    useSheetStore.getState().openSheet('model');
    expect(useSheetStore.getState().activeSheet).toBe('model');
  });

  test('closeSheet 清除活跃 sheet', () => {
    useSheetStore.getState().openSheet('settings');
    useSheetStore.getState().closeSheet();
    expect(useSheetStore.getState().activeSheet).toBeNull();
  });

  test('getSheetMeta 返回正确的元信息', () => {
    const meta = useSheetStore.getState().getSheetMeta('model');
    expect(meta.title).toBe('切换模型');
  });

  test('openSheet 可覆盖已有活跃 sheet', () => {
    useSheetStore.getState().openSheet('chat');
    useSheetStore.getState().openSheet('about');
    expect(useSheetStore.getState().activeSheet).toBe('about');
  });
});
