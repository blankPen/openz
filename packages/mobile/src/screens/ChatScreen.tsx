import { useCallback } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useSheetStore } from '../stores/sheetStore';
import { useChatStore } from '../stores/chatStore';
import { WelcomeSection } from '../components/home/WelcomeSection';
import { MessageRow } from '../components/chat/MessageRow';
import { StreamingIndicator } from '../components/chat/StreamingIndicator';
import { InputBar } from '../components/input/InputBar';
import { IconButton } from '../components/topbar/IconButton';
import { Pill } from '../components/common/Pill';
import { SettingsDrawer } from '../components/drawer/SettingsDrawer';
import { ModelSwitchSheet } from '../components/sheets/ModelSwitchSheet';
import { AttachmentSheet } from '../components/sheets/AttachmentSheet';

/**
 * OpenZ 统一聊天屏幕 (单一路由)
 *
 * - 无消息(activeConversationId 为空,或当前对话 messages 为空)→ 显示 WelcomeSection
 * - 有消息 → 显示消息流 + 流式指示器
 * - 顶部 / 底部安全区由 useSafeAreaInsets 预留,不再渲染 iPhone 外壳的固定 9:41 条 / Home 横条 / DynamicIsland
 * - 抽屉/弹层常驻,任何分支都能用
 * - 布局顺序:顶部安全区 → 顶栏 → 主体(欢迎/消息流) → InputBar → 水印 → 底部安全区
 */
export function ChatScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const chatState = useChatStore((s) => s.chatState);
  const createConversation = useChatStore((s) => s.createConversation);
  const addMessage = useChatStore((s) => s.addMessage);

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

  const messages = activeConversationId
    ? conversations[activeConversationId]?.messages ?? []
    : [];
  const hasMessages = messages.length > 0;
  const isStreaming = chatState === 'streaming';

  const handleMenuPress = useCallback(() => setDrawerVisible(true), [setDrawerVisible]);
  const handlePillPress = useCallback(() => openModelSheet(), [openModelSheet]);
  const handleVoice = useCallback(() => {
    // 语音播报
  }, []);
  const handleCall = useCallback(() => {
    // 实时通话
  }, []);
  const handleAttachment = useCallback(() => openAttachmentSheet(), [openAttachmentSheet]);
  const handleDrawerClose = useCallback(() => setDrawerVisible(false), [setDrawerVisible]);

  // 点击"新对话":新建一个空对话,无消息自动回到欢迎区
  const handleNewChat = useCallback(() => {
    createConversation();
  }, [createConversation]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      let convId = activeConversationId;
      if (!convId) convId = createConversation();
      addMessage(convId, {
        id: Date.now().toString(),
        role: 'user',
        type: 'text',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString('zh-CN', {
          hour: '2-digit',
          minute: '2-digit',
        }),
      });
    },
    [activeConversationId, addMessage, createConversation],
  );

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      {/* 顶部安全区 —— 代替原 iPhone 外壳的 StatusBar / DynamicIsland */}
      <View style={{ height: insets.top, backgroundColor: palette.bg }} />

      {/* 顶栏 —— 设计稿 home.html / conversation.html 一致:菜单 + pill + 语音/通话/新建 */}
      <View style={styles.topBar}>
        <IconButton name="burger" accessibilityLabel="打开菜单" onPress={handleMenuPress} />
        <Pill name="OpenZ" meta="Z1 思考" onPress={handlePillPress} accessibilityLabel="切换模型" />
        <View style={styles.topBarRight}>
          <IconButton name="voice" accessibilityLabel="语音播报" onPress={handleVoice} />
          <IconButton name="phone" accessibilityLabel="实时通话" onPress={handleCall} />
          <IconButton name="plus" accessibilityLabel="新对话" onPress={handleNewChat} />
        </View>
      </View>

      {/* 中部:无消息 → 欢迎区 + 撑开 spacer;有消息 → 滚动消息流 */}
      {hasMessages ? (
        <ScrollView
          style={styles.flow}
          contentContainerStyle={styles.flowContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.map((msg) => (
            <MessageRow key={msg.id} message={msg} />
          ))}
          {isStreaming && <StreamingIndicator />}
        </ScrollView>
      ) : (
        <View style={styles.welcomeArea}>
          <WelcomeSection name="Alex" />
          <View style={styles.spacer} />
        </View>
      )}

      {/* Input bar —— 两个分支都可用,首条消息自然把欢迎区切换为消息流 */}
      <InputBar
        onSend={handleSend}
        onAttachment={handleAttachment}
      />

      {/* 水印 —— 设计稿要求在 InputBar 下方 */}
      <Text style={[styles.watermark, { color: palette.fg3 }]}>内容由 AI 生成</Text>

      {/* 底部安全区 —— 代替原 iPhone 外壳的 HomeIndicator */}
      <View style={{ height: insets.bottom, backgroundColor: palette.bg }} />

      {/* Sheets / Drawer —— 全局常驻 */}
      <SettingsDrawer visible={drawerVisible} onClose={handleDrawerClose} testID="settings-drawer" />
      <ModelSwitchSheet
        visible={modelSheetVisible}
        onClose={closeModelSheet}
        testID="model-sheet"
      />
      <AttachmentSheet
        visible={attachmentSheetVisible}
        onClose={closeAttachmentSheet}
        testID="attachment-sheet"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 4,
    paddingBottom: 12,
  },
  topBarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 'auto',
    gap: 2,
  },
  flow: { flex: 1 },
  flowContent: { paddingHorizontal: 14, paddingVertical: 8, gap: 14 },
  welcomeArea: { flex: 1 },
  spacer: { flex: 1 },
  watermark: {
    fontSize: 10,
    textAlign: 'center',
    paddingBottom: 2,
  },
});
