import { View } from 'react-native';
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