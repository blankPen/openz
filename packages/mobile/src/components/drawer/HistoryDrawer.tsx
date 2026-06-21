import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore } from '../../stores/settingsStore';
import { useChatStore } from '../../stores/chatStore';
import { useSessions, useDeleteSession } from '../../hooks/useSessions';
import { Avatar } from '../common/Avatar';
import { Icon } from '../common/Icon';
import { sessionToConvMap, convToSessionMap } from '../../lib/sessionMaps';
import type { Session } from '@openz/shared';

type Props = {
  visible: boolean;
  onClose: () => void;
  onNewChat: () => void;
  onOpenSettings: () => void;
  testID?: string;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return '刚刚';
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`;
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`;
  if (diff < 2 * day) return '昨天';
  if (diff < 7 * day) return `${Math.floor(diff / day)} 天前`;
  return new Date(timestamp).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
}

function getSessionTitle(_session: Session, convId?: string): string {
  if (convId) {
    const conv = useChatStore.getState().conversations[convId];
    if (conv && conv.messages.length > 0) {
      const firstUserMsg = conv.messages.find((m) => m.role === 'user');
      if (firstUserMsg) {
        const title = firstUserMsg.content.slice(0, 30);
        return title.length < firstUserMsg.content.length ? title + '…' : title;
      }
    }
  }
  return '新对话';
}

// ── SessionItem ───────────────────────────────────────────────────────────────

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  onPress: (session: Session) => void;
  onDelete: (sessionId: string) => void;
}

function SessionItem({ session, isActive, onPress, onDelete }: SessionItemProps) {
  const { palette, tokens } = useTheme();
  const convId = sessionToConvMap.get(session.id);
  const title = getSessionTitle(session, convId);
  const [showDel, setShowDel] = useState(false);

  return (
    <Pressable
      onPress={() => onPress(session)}
      onLongPress={() => setShowDel((v) => !v)}
      style={({ pressed }) => [
        styles.sessionItem,
        isActive && { backgroundColor: palette.primarySoft },
        pressed && !isActive && { backgroundColor: palette.surface },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`历史会话: ${title}`}
    >
      <View style={styles.sessionIcon}>
        <Icon name="history" size={16} color={isActive ? palette.primary : palette.fg3} />
      </View>
      <View style={styles.sessionInfo}>
        <Text
          style={[
            styles.sessionTitle,
            { color: isActive ? palette.primary : palette.fg, fontSize: tokens.fontSize.md },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text style={{ color: palette.fg3, fontSize: tokens.fontSize.xs }}>
          {formatRelativeTime(session.createdAt)}
        </Text>
      </View>
      {showDel && (
        <Pressable
          onPress={() => onDelete(session.id)}
          style={({ pressed }) => [
            styles.deleteBtn,
            { backgroundColor: pressed ? '#FF3B30' : palette.surface },
          ]}
          hitSlop={8}
          accessibilityLabel="删除会话"
        >
          <Icon name="trash" size={14} color={palette.danger} />
        </Pressable>
      )}
    </Pressable>
  );
}

// ── HistoryDrawer ─────────────────────────────────────────────────────────────

export function HistoryDrawer({ visible, onClose, onNewChat, onOpenSettings, testID }: Props) {
  const { palette, tokens } = useTheme();
  const translateX = useRef(new Animated.Value(-320)).current;
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  // Sessions
  const sessionsQuery = useSessions();
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const deleteSessionMut = useDeleteSession();

  // Active conversation
  const activeConvId = useChatStore((s) => s.activeConversationId);
  const createConversation = useChatStore((s) => s.createConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const conversations = useChatStore((s) => s.conversations);

  // Animate
  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -320,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 0.45 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, backdropOpacity]);

  const handleSessionPress = (session: Session) => {
    let convId = sessionToConvMap.get(session.id);

    if (!convId) {
      // 创建新本地 conversation 并建立映射
      convId = createConversation();
      sessionToConvMap.set(session.id, convId);
      convToSessionMap.set(convId, session.id);
    }

    setActiveConversation(convId);

    // 加载历史消息（如果本地还没有消息）
    // 注意：必须从 store 直接读取，避免闭包捕获过时的 conversations 副本
    const currentConvs = useChatStore.getState().conversations;
    const conv = currentConvs[convId];
    if (!conv || conv.messages.length === 0) {
      loadHistory(session.id, convId);
    }

    onClose();
  };

  async function loadHistory(sessionId: string, convId: string) {
    if (!serverUrl) return;
    try {
      const url = `${serverUrl}/sessions/${sessionId}/events`;
      const resp = await fetch(url);
      if (!resp.ok) return;
      const data = await resp.json();
      const events: import('@openz/shared').AgentEvent[] = data.events ?? [];

      // 解析事件，还原消息
      for (const ev of events) {
        if (ev.type === 'message_start') {
          const msgId = `hist-${ev.eventId}`;
          addMessage(convId, {
            id: msgId,
            role: 'ai',
            type: 'text',
            content: '',
            timestamp: new Date(ev.timestamp).toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            }),
            isStreaming: false,
          });
        } else if (ev.type === 'text_delta') {
          // 找到最后一条 ai 消息并追加
          const conv = useChatStore.getState().conversations[convId];
          if (conv) {
            const msgs = conv.messages;
            const lastAi = [...msgs].reverse().find((m) => m.role === 'ai');
            if (lastAi) {
              updateMessage(convId, lastAi.id, {
                content: lastAi.content + ev.data.text,
              });
            }
          }
        } else if (ev.type === 'tool_result') {
          // 可以选择展示 tool 结果，这里只打印
          console.log('[HistoryDrawer] tool_result', ev.data.content);
        }
      }
    } catch (e) {
      console.log('[HistoryDrawer] loadHistory error', e);
    }
  }

  const handleDeleteSession = (sessionId: string) => {
    const convId = sessionToConvMap.get(sessionId);
    sessionToConvMap.delete(sessionId);
    if (convId) convToSessionMap.delete(convId);

    deleteSessionMut.mutate(sessionId);
  };

  const sessions = sessionsQuery.data ?? [];
  const activeSessionId = activeConvId ? convToSessionMap.get(activeConvId) : null;

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="关闭" />
      </Animated.View>

      {/* Drawer */}
      <Animated.View
        testID={testID}
        style={[
          styles.drawer,
          { backgroundColor: palette.bg, shadowColor: '#000' },
          { transform: [{ translateX }] },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header / UserCard */}
          <View style={[styles.userCard, { borderBottomColor: palette.border }]}>
            <Avatar label="A" size={52} />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: palette.fg, fontSize: 17 }]}>Alex</Text>
              <View style={[styles.proBadge, { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '600' }}>
                  免费版 · 升级 Pro
                </Text>
              </View>
            </View>
          </View>

          {/* 历史会话 Section */}
          <View style={styles.section}>
            {/* 新建对话按钮 */}
            <Pressable
              onPress={onNewChat}
              style={({ pressed }) => [
                styles.newChatBtn,
                { backgroundColor: pressed ? palette.primarySoft : palette.primary },
              ]}
              accessibilityRole="button"
              accessibilityLabel="新建对话"
            >
              <Icon name="plus" size={16} color="#fff" />
              <Text style={styles.newChatBtnText}>新建对话</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: palette.fg3, fontSize: tokens.fontSize.xs, marginTop: 14 }]}>
              历史会话
            </Text>

            {sessionsQuery.isLoading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={palette.primary} />
                <Text style={{ color: palette.fg3, marginLeft: 8 }}>加载中…</Text>
              </View>
            ) : sessions.length === 0 ? (
              <View style={styles.emptyRow}>
                <Text style={{ color: palette.fg3, fontSize: tokens.fontSize.sm }}>暂无历史会话</Text>
              </View>
            ) : (
              <View style={[styles.sessionList, { borderColor: palette.border }]}>
                {sessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    isActive={session.id === activeSessionId}
                    onPress={handleSessionPress}
                    onDelete={handleDeleteSession}
                  />
                ))}
              </View>
            )}
          </View>

        </ScrollView>

        {/* Footer */}
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Pressable
            onPress={onOpenSettings}
            style={({ pressed }) => [
              styles.settingsBtn,
              { backgroundColor: pressed ? palette.surface : 'transparent' },
            ]}
            accessibilityRole="button"
            accessibilityLabel="设置"
          >
            <Icon name="gear" size={18} color={palette.fg2} />
            <Text style={[styles.settingsText, { color: palette.fg, fontSize: tokens.fontSize.md }]}>
              设置
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              styles.logoutBtn,
              { backgroundColor: pressed ? palette.surface : 'transparent' },
            ]}
            accessibilityRole="button"
          >
            <Icon name="logout" size={18} color={palette.danger} />
            <Text style={[styles.logoutText, { color: palette.danger, fontSize: tokens.fontSize.md }]}>
              退出登录
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 320,
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollContent: { paddingHorizontal: 12, paddingTop: 60, paddingBottom: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    marginBottom: 18,
  },
  userInfo: { flex: 1 },
  userName: { fontWeight: '600', marginBottom: 6 },
  proBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 8,
  },
  sessionList: {},
  newChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
    marginHorizontal: 4,
  },
  newChatBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  sessionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 44,
    gap: 10,
  },
  sessionIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionInfo: { flex: 1 },
  sessionTitle: { fontWeight: '500', marginBottom: 2 },
  deleteBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 12,
  },
  emptyRow: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  divider: { height: 1, marginBottom: 18 },
  serverUrlBlock: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  serverUrlLabel: { fontSize: 12, fontWeight: '600' },
  serverUrlInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
  },
  saveBtn: {
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600' },
  serverUrlHint: { fontSize: 11 },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    flex: 1,
    marginRight: 8,
  },
  settingsText: { fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  logoutText: { fontWeight: '500' },
});
