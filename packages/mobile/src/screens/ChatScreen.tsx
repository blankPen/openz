import { useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useSheetStore } from '../stores/sheetStore';
import { useChatStore } from '../stores/chatStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStatus } from '../hooks/useSocket';
import { useSessions, useCreateSession, useDeleteSession } from '../hooks/useSessions';
import { useSessionStream } from '../hooks/useSessionStream';
import { useTtsClient } from '../hooks/useTtsClient';
import { WelcomeSection } from '../components/home/WelcomeSection';
import { MessageRow } from '../components/chat/MessageRow';
import { StreamingIndicator } from '../components/chat/StreamingIndicator';
import { InputBar } from '../components/input/InputBar';
import { IconButton } from '../components/topbar/IconButton';
import { Pill } from '../components/common/Pill';
import { HistoryDrawer } from '../components/drawer/HistoryDrawer';
import { ModelSwitchSheet } from '../components/sheets/ModelSwitchSheet';
import { AttachmentSheet } from '../components/sheets/AttachmentSheet';
import { sessionToConvMap, convToSessionMap } from '../lib/sessionMaps';
import type { AgentEvent } from '@openz/shared';

/**
 * OpenZ 聊天屏幕（接入 daemon 后端）
 *
 * 数据流:
 *  1. useSessions 列出服务端 sessions
 *  2. 点击/新建 → setActiveConversation
 *  3. handleSend → useSessionStream.sendMessage 触发 SSE
 *  4. 收到 SSE 事件 → 调 chatStore.addMessage / updateMessage
 *  5. assistant_complete → useTtsClient.speak (若 ttsAutoPlay)
 *  6. 顶部小喇叭 toggle ttsAutoPlay，连接状态条显示 daemon 状态
 */
export function ChatScreen() {
  const { palette } = useTheme();
  const insets = useSafeAreaInsets();

  // local UI
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const chatState = useChatStore((s) => s.chatState);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const createConversation = useChatStore((s) => s.createConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setChatState = useChatStore((s) => s.setChatState);

  // 网络层
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const ttsAutoPlay = useSettingsStore((s) => s.ttsAutoPlay);
  const toggleTtsAutoPlay = useSettingsStore((s) => s.setTtsAutoPlay);
  const { status: connStatus } = useConnectionStatus();
  const sessionsQuery = useSessions();
  const createSessionMut = useCreateSession();
  const deleteSessionMut = useDeleteSession();

  // 流式输出 + TTS
  const streamingMessageIdRef = useRef<string | null>(null);
  const pendingTextRef = useRef<string>('');
  const currentConvIdRef = useRef<string | null>(null);
  const tts = useTtsClient();

  const handleSseEvent = useCallback(
    (event: AgentEvent, convId: string) => {
      switch (event.type) {
        case 'message_start': {
          const msgId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          streamingMessageIdRef.current = msgId;
          pendingTextRef.current = '';
          addMessage(convId, {
            id: msgId,
            role: 'ai',
            type: 'text',
            content: '',
            timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            isStreaming: true,
          });
          break;
        }
        case 'text_delta': {
          const text = (event.data as { text?: string })?.text ?? '';
          pendingTextRef.current += text;
          const id = streamingMessageIdRef.current;
          if (id) updateMessage(convId, id, { content: pendingTextRef.current });
          break;
        }
        case 'thinking_delta': {
          const text = (event.data as { text?: string })?.text ?? '';
          const id = streamingMessageIdRef.current;
          if (id) {
            const conv = conversations[convId];
            const msg = conv?.messages.find((m) => m.id === id);
            const steps = msg?.thinkingSteps ?? [];
            const last = steps[steps.length - 1];
            const newSteps = last
              ? [...steps.slice(0, -1), { ...last, content: last.content + text }]
              : [...steps, { step: steps.length + 1, content: text }];
            updateMessage(convId, id, { thinkingSteps: newSteps });
          }
          break;
        }
        case 'tool_use_start':
          console.log('[ChatScreen] tool_use_start', event.data);
          break;
        case 'assistant_complete':
        case 'turn_done': {
          const id = streamingMessageIdRef.current;
          if (id) updateMessage(convId, id, { isStreaming: false });
          streamingMessageIdRef.current = null;
          setChatState('idle');
          if (ttsAutoPlay) {
            const text = pendingTextRef.current;
            const sessionId = convToSessionMap.get(convId);
            if (text && sessionId) tts.speak(sessionId, text);
          }
          break;
        }
        case 'error': {
          const id = streamingMessageIdRef.current;
          if (id) {
            updateMessage(convId, id, {
              isStreaming: false,
              content: pendingTextRef.current + '\n[出错]',
            });
          } else {
            addMessage(convId, {
              id: `err-${Date.now()}`,
              role: 'ai',
              type: 'text',
              content: '[出错] ' + ((event.data as { error?: string })?.error ?? ''),
              timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
            });
          }
          streamingMessageIdRef.current = null;
          setChatState('idle');
          break;
        }
        default:
          break;
      }
    },
    [addMessage, conversations, setChatState, tts, ttsAutoPlay, updateMessage],
  );

  const sessionStream = useSessionStream(
    activeConvId ? convToSessionMap.get(activeConvId) ?? null : null,
    {
      onEvent: (e) => {
        if (currentConvIdRef.current) handleSseEvent(e, currentConvIdRef.current);
      },
      onClose: (reason) => {
        console.log('[ChatScreen] SSE closed', reason);
        setChatState('idle');
        streamingMessageIdRef.current = null;
      },
    },
  );

  useEffect(() => {
    currentConvIdRef.current = activeConvId;
  }, [activeConvId]);

  // sessions 列表加载完后,默认选第一个
  useEffect(() => {
    if (sessionsQuery.data && sessionsQuery.data.length > 0 && !activeConvId) {
      const first = sessionsQuery.data[0];
      const convId = createConversation();
      sessionToConvMap.set(first.id, convId);
      convToSessionMap.set(convId, first.id);
      setActiveConversation(convId);
    }
  }, [sessionsQuery.data, activeConvId, createConversation, setActiveConversation]);

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

  const messages = activeConvId ? conversations[activeConvId]?.messages ?? [] : [];
  const hasMessages = messages.length > 0;
  const isStreaming = chatState === 'streaming';

  const handleMenuPress = useCallback(() => setDrawerVisible(true), [setDrawerVisible]);
  const handlePillPress = useCallback(() => openModelSheet(), [openModelSheet]);
  const handleVoice = useCallback(() => {
    toggleTtsAutoPlay(!ttsAutoPlay);
  }, [ttsAutoPlay, toggleTtsAutoPlay]);
  const handleCall = useCallback(() => {
    Alert.alert('实时通话', '暂未实现');
  }, []);
  const handleAttachment = useCallback(() => openAttachmentSheet(), [openAttachmentSheet]);
  const handleDrawerClose = useCallback(() => setDrawerVisible(false), [setDrawerVisible]);

  const handleNewChat = useCallback(async () => {
    if (!serverUrl) {
      Alert.alert('未配置服务器', '请在设置中配置 serverUrl');
      return;
    }
    try {
      const session = await createSessionMut.mutateAsync({ engine: 'claude', cwd: '/' });
      if (session) {
        const convId = createConversation();
        sessionToConvMap.set(session.id, convId);
        convToSessionMap.set(convId, session.id);
        setActiveConversation(convId);
      }
    } catch (err: any) {
      Alert.alert('创建会话失败', err?.message ?? String(err));
    }
  }, [serverUrl, createSessionMut, createConversation, setActiveConversation]);

  const handleDeleteChat = useCallback(() => {
    if (!activeConvId) return;
    Alert.alert('删除会话', '确认删除当前会话？此操作不可恢复。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          const sessionId = convToSessionMap.get(activeConvId);
          deleteConversation(activeConvId);
          if (sessionId) {
            try {
              await deleteSessionMut.mutateAsync(sessionId);
            } catch {
              /* 静默 */
            }
            sessionToConvMap.delete(sessionId);
            convToSessionMap.delete(activeConvId);
          }
        },
      },
    ]);
  }, [activeConvId, deleteConversation, deleteSessionMut]);

  const handleSend = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      if (!serverUrl) {
        Alert.alert('未配置服务器', '请在设置中配置 serverUrl');
        return;
      }
      let convId = activeConvId;
      if (!convId) {
        try {
          const session = await createSessionMut.mutateAsync({ engine: 'claude', cwd: '/' });
          if (!session) return;
          convId = createConversation();
          sessionToConvMap.set(session.id, convId);
          convToSessionMap.set(convId, session.id);
          setActiveConversation(convId);
        } catch (err: any) {
          Alert.alert('创建会话失败', err?.message ?? String(err));
          return;
        }
      }
      addMessage(convId, {
        id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        role: 'user',
        type: 'text',
        content: trimmed,
        timestamp: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      });
      currentConvIdRef.current = convId;
      setChatState('streaming');
      try {
        const sessionId = convToSessionMap.get(convId);
        if (!sessionId) throw new Error('没有对应的 daemon sessionId');
        await sessionStream.sendMessage(trimmed);
      } catch (err: any) {
        Alert.alert('发送失败', err?.message ?? String(err));
        setChatState('idle');
        streamingMessageIdRef.current = null;
      }
    },
    [activeConvId, serverUrl, createSessionMut, createConversation, setActiveConversation, addMessage, setChatState, sessionStream],
  );

  const handleStop = useCallback(() => {
    sessionStream.abort();
    const id = streamingMessageIdRef.current;
    if (id && currentConvIdRef.current) {
      updateMessage(currentConvIdRef.current, id, { isStreaming: false });
    }
    streamingMessageIdRef.current = null;
    setChatState('idle');
  }, [sessionStream, updateMessage, setChatState]);

  return (
    <View style={[styles.root, { backgroundColor: palette.bg }]}>
      <View style={{ height: insets.top, backgroundColor: palette.bg }} />

      <ConnectionBar
        status={connStatus}
        sessionsLoading={sessionsQuery.isLoading}
        sessionCount={sessionsQuery.data?.length ?? 0}
        onPressSettings={() => setDrawerVisible(true)}
      />

      <View style={styles.topBar}>
        <IconButton name="burger" accessibilityLabel="打开菜单" onPress={handleMenuPress} />
        <Pill name="OpenZ" meta="Z1 思考" onPress={handlePillPress} accessibilityLabel="切换模型" />
        <View style={styles.topBarRight}>
          <Pressable
            onPress={handleVoice}
            style={[styles.iconBtn, ttsAutoPlay && styles.iconBtnOn]}
            testID="tts-toggle"
            accessibilityLabel="切换语音播报"
          >
            <Text style={{ fontSize: 18, color: ttsAutoPlay ? '#fff' : '#666' }}>
              {ttsAutoPlay ? '🔊' : '🔈'}
            </Text>
          </Pressable>
          <IconButton name="phone" accessibilityLabel="实时通话" onPress={handleCall} />
          <Pressable
            onPress={handleNewChat}
            style={styles.iconBtn}
            testID="new-chat-button"
            accessibilityLabel="新对话"
          >
            <Text style={{ fontSize: 18, color: '#666' }}>＋</Text>
          </Pressable>
          {activeConvId ? (
            <Pressable
              onPress={handleDeleteChat}
              style={styles.iconBtn}
              testID="delete-chat-button"
              accessibilityLabel="删除会话"
            >
              <Text style={{ fontSize: 16, color: '#FF3B30' }}>🗑</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

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

      <InputBar
        onSend={handleSend}
        onStop={handleStop}
        onAttachment={handleAttachment}
        isStreaming={isStreaming}
      />

      <Text style={[styles.watermark, { color: palette.fg3 }]}>内容由 AI 生成</Text>

      <View style={{ height: insets.bottom, backgroundColor: palette.bg }} />

      <HistoryDrawer visible={drawerVisible} onClose={handleDrawerClose} onNewChat={handleNewChat} testID="history-drawer" />
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

/** 顶部连接状态条 */
function ConnectionBar({
  status,
  sessionsLoading,
  sessionCount,
  onPressSettings,
}: {
  status: 'connected' | 'connecting' | 'disconnected';
  sessionsLoading: boolean;
  sessionCount: number;
  onPressSettings: () => void;
}) {
  if (status === 'connected') return null;
  const bg = status === 'connecting' ? '#FFA500' : '#FF3B30';
  const text =
    status === 'connecting'
      ? '正在连接...'
      : `未连接 · 去设置 (${sessionCount} 个本地会话)`;
  return (
    <Pressable
      onPress={onPressSettings}
      style={[styles.connBar, { backgroundColor: bg }]}
      testID="connection-bar"
    >
      {sessionsLoading ? <ActivityIndicator size="small" color="#fff" /> : null}
      <Text style={styles.connText}>{text}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  connBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    gap: 8,
  },
  connText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
    gap: 6,
  },
  iconBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
  },
  iconBtnOn: {
    backgroundColor: '#4A8BFF',
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
