import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { UserBubble } from './UserBubble';
import { AIBubble } from './AIBubble';
import { ThinkingCard } from './ThinkingCard';
import { ToolCallCard } from './ToolCallCard';
import { AIActionsBar } from './AIActionsBar';
import type { ChatMessage } from '../../types/chat';

type Props = {
  message: ChatMessage;
  onCopy?: () => void;
  onLike?: () => void;
  onRegenerate?: () => void;
  onShare?: () => void;
};

export function MessageRow({ message, onCopy, onLike, onRegenerate, onShare }: Props) {
  const { palette } = useTheme();

  if (message.role === 'user') {
    return (
      <View style={{ paddingHorizontal: 14, paddingVertical: 6, alignItems: 'flex-end' }}>
        <UserBubble content={message.content} timestamp={message.timestamp} />
      </View>
    );
  }

  // AI message
  return (
    <View style={{ paddingHorizontal: 14, paddingVertical: 6, alignItems: 'flex-start' }}>
      {/* AI Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {/* Avatar: 24x24, circular, primary background, "Z" letter */}
        <View
          testID="ai-avatar"
          style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: palette.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: '600' }}>Z</Text>
        </View>
        {/* Name */}
        <Text style={{ fontSize: 13, fontWeight: '600', color: palette.fg2 }}>OpenZ</Text>
        {/* Mode tag */}
        <Text
          style={{
            fontSize: 10,
            color: palette.primary,
            backgroundColor: palette.primarySoft,
            paddingHorizontal: 6,
            paddingVertical: 1,
            borderRadius: 4,
          }}
        >
          思考
        </Text>
      </View>
      {message.type === 'thinking' && message.thinkingSteps && (
        <ThinkingCard
          elapsedSeconds={8}
          stepCount={message.thinkingSteps.length}
          steps={message.thinkingSteps}
        />
      )}
      {message.type !== 'tool-call' && (
        <AIBubble content={message.content} timestamp={message.timestamp} />
      )}
      {message.type === 'tool-call' && message.toolCall && (
        <ToolCallCard toolCall={message.toolCall} />
      )}
      {message.type !== 'tool-call' && (
        <AIActionsBar
          onCopy={onCopy}
          onLike={onLike}
          onRegenerate={onRegenerate}
          onShare={onShare}
        />
      )}
    </View>
  );
}