import { useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useSheetStore } from '../stores/sheetStore';
import { DynamicIsland } from '../components/chrome/DynamicIsland';
import { StatusBar } from '../components/chrome/StatusBar';
import { HomeIndicator } from '../components/chrome/HomeIndicator';
import { WelcomeSection } from '../components/home/WelcomeSection';
import { ToolsStrip } from '../components/home/ToolsStrip';
import { InputBar } from '../components/input/InputBar';
import { IconButton } from '../components/topbar/IconButton';
import { Pill } from '../components/common/Pill';
import { BottomSheet } from '../components/sheets/BottomSheet';
import { SheetHeader } from '../components/sheets/SheetHeader';
import { ModelOptionRow } from '../components/sheets/ModelOption';
import { FileCard } from '../components/sheets/FileCard';
import { SettingsDrawer } from '../components/drawer/SettingsDrawer';
import type { ModelOption } from '../types/chat';

const MOCK_MODELS: ModelOption[] = [
  {
    id: 'z1',
    name: 'Z1',
    description: '平衡性能与速度，适合日常对话',
    iconColor: '#1A66FF',
    iconBg: '#EAF1FF',
    tag: '主力',
    tagColor: '#EAF1FF',
    isPro: false,
  },
  {
    id: 'z1-mini',
    name: 'Z1 Mini',
    description: '节省资源，适合简单问答',
    iconColor: '#5856D6',
    iconBg: '#F0F4FF',
    tag: '轻量',
    tagColor: '#F0F4FF',
    isPro: false,
  },
];

export function HomeScreen() {
  const router = useRouter();
  const { palette } = useTheme();

  const {
    drawerVisible,
    setDrawerVisible,
    modelSheetVisible,
    openModelSheet,
    closeModelSheet,
    attachmentSheetVisible,
    openAttachmentSheet,
    closeAttachmentSheet,
  } = useSheetStore();

  const handleNewChat = useCallback(() => {
    router.push('/chat');
  }, [router]);

  const handleMenuPress = useCallback(() => {
    setDrawerVisible(true);
  }, [setDrawerVisible]);

  const handlePillPress = useCallback(() => {
    openModelSheet();
  }, [openModelSheet]);

  const handleVoice = useCallback(() => {
    // voice button handler
  }, []);

  const handleCall = useCallback(() => {
    // call button handler
  }, []);

  const handleAttachment = useCallback(() => {
    openAttachmentSheet();
  }, [openAttachmentSheet]);

  const handleModelSelect = useCallback(
    (_model: ModelOption) => {
      closeModelSheet();
    },
    [closeModelSheet],
  );

  const handleDrawerClose = useCallback(() => {
    setDrawerVisible(false);
  }, [setDrawerVisible]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <DynamicIsland />
      <StatusBar />

      {/* Top bar */}
      <View
        style={[
          styles.topBar,
          { backgroundColor: palette.bg, borderBottomColor: palette.border },
        ]}
      >
        <IconButton name="burger" accessibilityLabel="打开菜单" onPress={handleMenuPress} />
        <Pill name="OpenZ" meta="Z1 思考" onPress={handlePillPress} accessibilityLabel="切换模型" />
        <IconButton name="voice" accessibilityLabel="语音输入" onPress={handleVoice} />
        <IconButton name="phone" accessibilityLabel="拨打" onPress={handleCall} />
        <IconButton name="plus" accessibilityLabel="新对话" onPress={handleNewChat} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <WelcomeSection name="Alex" subtitle="有什么可以帮你的？" />
        <ToolsStrip />
      </View>

      {/* Spacer pushes content to bottom */}
      <View style={styles.spacer} />

      {/* Watermark */}
      <Text style={[styles.watermark, { color: palette.fg3 }]}>内容由 AI 生成</Text>

      {/* Input bar */}
      <InputBar onAttachment={handleAttachment} />

      <HomeIndicator />

      {/* Settings Drawer - width 320 per spec */}
      <SettingsDrawer visible={drawerVisible} onClose={handleDrawerClose} testID="settings-drawer" />

      {/* Model Switch Sheet */}
      <BottomSheet
        visible={modelSheetVisible}
        title="切换模型"
        onClose={closeModelSheet}
        testID="model-sheet"
      >
        <SheetHeader title="选择模型" />
        {MOCK_MODELS.map((model) => (
          <ModelOptionRow
            key={model.id}
            model={model}
            isSelected={model.id === 'z1'}
            onPress={handleModelSelect}
          />
        ))}
      </BottomSheet>

      {/* Attachment Sheet */}
      <BottomSheet
        visible={attachmentSheetVisible}
        title="添加附件"
        onClose={closeAttachmentSheet}
        testID="attachment-sheet"
      >
        <SheetHeader title="上传文件" />
        <FileCard name="test_image.png" path="/tmp/test.png" size="2.4 MB" />
      </BottomSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  content: { flex: 1 },
  spacer: { flex: 1 },
  watermark: {
    fontSize: 10,
    textAlign: 'center',
    paddingBottom: 2,
  },
});
