import { View, ScrollView } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { DynamicIsland } from '../components/chrome/DynamicIsland';
import { StatusBar } from '../components/chrome/StatusBar';
import { HomeIndicator } from '../components/chrome/HomeIndicator';
import { MessageRow } from '../components/chat/MessageRow';
import { StreamingIndicator } from '../components/chat/StreamingIndicator';
import { InputBar } from '../components/input/InputBar';
import { useChatStore } from '../stores/chatStore';
import type { ChatMessage } from '../types/chat';

export function ChatScreen() {
  const { palette } = useTheme();
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const conversations = useChatStore((s) => s.conversations);
  const chatState = useChatStore((s) => s.chatState);
  const addMessage = useChatStore((s) => s.addMessage);

  const messages = activeConversationId
    ? conversations[activeConversationId]?.messages ?? []
    : [];
  const isStreaming = chatState === 'streaming';

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <DynamicIsland />
      <StatusBar />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingVertical: 8 }}>
        {messages.map((msg) => (
          <MessageRow key={msg.id} message={msg} />
        ))}
        {isStreaming && <StreamingIndicator />}
      </ScrollView>
      <InputBar
        onSend={(text) => {
          if (!activeConversationId) return;
          const msg: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            type: 'text',
            content: text,
            timestamp: new Date().toLocaleTimeString('zh-CN', {
              hour: '2-digit',
              minute: '2-digit',
            }),
          };
          addMessage(activeConversationId, msg);
        }}
      />
      <HomeIndicator />
    </View>
  );
}
