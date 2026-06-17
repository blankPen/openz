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

  describe('drawer', () => {
    test('默认 drawer 不可见', () => {
      expect(useSheetStore.getState().drawerVisible).toBe(false);
    });

    test('setDrawerVisible 可打开 drawer', () => {
      useSheetStore.getState().setDrawerVisible(true);
      expect(useSheetStore.getState().drawerVisible).toBe(true);
    });

    test('setDrawerVisible 可关闭 drawer', () => {
      useSheetStore.getState().setDrawerVisible(true);
      useSheetStore.getState().setDrawerVisible(false);
      expect(useSheetStore.getState().drawerVisible).toBe(false);
    });
  });

  describe('modelSheet', () => {
    test('默认 modelSheet 不可见', () => {
      expect(useSheetStore.getState().modelSheetVisible).toBe(false);
    });

    test('openModelSheet 打开 modelSheet', () => {
      useSheetStore.getState().openModelSheet();
      expect(useSheetStore.getState().modelSheetVisible).toBe(true);
    });

    test('closeModelSheet 关闭 modelSheet', () => {
      useSheetStore.getState().openModelSheet();
      useSheetStore.getState().closeModelSheet();
      expect(useSheetStore.getState().modelSheetVisible).toBe(false);
    });
  });

  describe('attachmentSheet', () => {
    test('默认 attachmentSheet 不可见', () => {
      expect(useSheetStore.getState().attachmentSheetVisible).toBe(false);
    });

    test('openAttachmentSheet 打开 attachmentSheet', () => {
      useSheetStore.getState().openAttachmentSheet();
      expect(useSheetStore.getState().attachmentSheetVisible).toBe(true);
    });

    test('closeAttachmentSheet 关闭 attachmentSheet', () => {
      useSheetStore.getState().openAttachmentSheet();
      useSheetStore.getState().closeAttachmentSheet();
      expect(useSheetStore.getState().attachmentSheetVisible).toBe(false);
    });
  });
});
