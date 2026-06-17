import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';
import type { ToolCall } from '../../types/chat';
import { SourceItem } from './SourceItem';

type Props = {
  toolCall: ToolCall;
  onToggle?: () => void;
  isExpanded?: boolean; // default false
};

export function ToolCallCard({ toolCall, onToggle, isExpanded = false }: Props) {
  const { palette, tokens } = useTheme();
  const sourceCount = toolCall.sources?.length ?? 0;

  return (
    <View
      style={{
        maxWidth: '88%',
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        borderRadius: 12,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 10,
            backgroundColor: pressed ? palette.surface : 'transparent',
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            backgroundColor: palette.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="search" size={16} color={palette.primary} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text
            style={{ fontSize: tokens.fontSize.sm, fontWeight: '600', color: palette.fg }}
            numberOfLines={1}
          >
            {toolCall.name}
            {sourceCount > 0 && ` · ${sourceCount} 个来源`}
          </Text>
          <Text
            style={{ fontSize: tokens.fontSize.xs, color: palette.fg3, marginTop: 1 }}
            numberOfLines={1}
          >
            {toolCall.description}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: isExpanded ? '180deg' : '-90deg' }] }}>
          <Icon name="chevDown" size={14} color={palette.fg3} />
        </View>
      </Pressable>
      {isExpanded && toolCall.sources && toolCall.sources.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: palette.border, padding: 8 }}>
          {toolCall.sources.map((source) => (
            <SourceItem key={source.index} index={source.index} title={source.title} url={source.url} />
          ))}
        </View>
      )}
    </View>
  );
}
