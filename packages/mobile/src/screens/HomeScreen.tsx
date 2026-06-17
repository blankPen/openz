import { useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated } from 'react-native';
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
import { Icon } from '../components/common/Icon';
import { BottomSheet } from '../components/sheets/BottomSheet';
import { SheetHeader } from '../components/sheets/SheetHeader';
import { ModelOptionRow } from '../components/sheets/ModelOption';
import { FileCard } from '../components/sheets/FileCard';
import { Switch } from '../components/drawer/Switch';
import type { ModelOption } from '../types/chat';

const DRAWER_WIDTH = 300;

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
  const drawerAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;

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

  const openDrawer = useCallback(() => {
    setDrawerVisible(true);
    Animated.parallel([
      Animated.spring(drawerAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerAnim, backdropAnim, setDrawerVisible]);

  const closeDrawer = useCallback(() => {
    Animated.parallel([
      Animated.timing(drawerAnim, {
        toValue: -DRAWER_WIDTH,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => setDrawerVisible(false));
  }, [drawerAnim, backdropAnim, setDrawerVisible]);

  const handleNewChat = useCallback(() => {
    router.push('/chat');
  }, [router]);

  const handleMenuPress = useCallback(() => {
    openDrawer();
  }, [openDrawer]);

  const handlePillPress = useCallback(() => {
    openModelSheet();
  }, [openModelSheet]);

  const handleAttachment = useCallback(() => {
    openAttachmentSheet();
  }, [openAttachmentSheet]);

  const handleModelSelect = useCallback(
    (_model: ModelOption) => {
      closeModelSheet();
    },
    [closeModelSheet],
  );

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
        <Pill name="Z1" meta="思考" onPress={handlePillPress} accessibilityLabel="切换模型" />
        <IconButton name="plus" accessibilityLabel="新对话" onPress={handleNewChat} />
      </View>

      {/* Main content */}
      <View style={styles.content}>
        <WelcomeSection name="Zhang San" subtitle="有什么可以帮你的？" />
        <ToolsStrip />
      </View>

      {/* Input bar */}
      <InputBar onAttachment={handleAttachment} />

      <HomeIndicator />

      {/* Backdrop */}
      {drawerVisible && (
        <Animated.View
          pointerEvents="auto"
          style={[
            StyleSheet.absoluteFillObject,
            { backgroundColor: 'rgba(0,0,0,0.35)', opacity: backdropAnim },
          ]}
        >
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeDrawer} accessibilityLabel="关闭" />
        </Animated.View>
      )}

      {/* Settings Drawer */}
      <Animated.View
        pointerEvents={drawerVisible ? 'auto' : 'none'}
        style={[
          styles.drawer,
          {
            backgroundColor: palette.bg,
            transform: [{ translateX: drawerAnim }],
          },
        ]}
      >
        <View style={[styles.drawerHeader, { borderBottomColor: palette.border }]}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.fg }}>设置</Text>
          <IconButton name="close" size={18} onPress={closeDrawer} accessibilityLabel="关闭" />
        </View>

        <View style={styles.drawerContent}>
          <View style={[styles.drawerRow, { borderBottomColor: palette.border }]}>
            <Text style={{ fontSize: 15, color: palette.fg }}>深色模式</Text>
            <Switch value={false} onChange={() => {}} />
          </View>

          <Pressable
            style={[styles.drawerRow, { borderBottomColor: palette.border }]}
            onPress={() => useSheetStore.getState().openSheet('about')}
          >
            <Text style={{ fontSize: 15, color: palette.fg }}>关于</Text>
            <Icon name="chevDown" size={14} color={palette.fg3} />
          </Pressable>
        </View>
      </Animated.View>

      {/* Model Switch Sheet */}
      <BottomSheet
        visible={modelSheetVisible}
        title="切换模型"
        onClose={closeModelSheet}
        testID="model-sheet"
      >
        <SheetHeader title="选择模型" subtitle="不同模型擅长不同任务" />
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
        <SheetHeader title="上传文件" subtitle="支持图片、文档、代码文件" />
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
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: DRAWER_WIDTH,
    shadowColor: '#000',
    shadowOffset: { width: 5, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  drawerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  drawerContent: { paddingTop: 8 },
  drawerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
