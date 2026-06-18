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

export function ToolCallCard({ toolCall, onToggle, isExpanded = true }: Props) {
  const { palette, tokens } = useTheme();
  const sourceCount = toolCall.sources?.length ?? 0;
  // 设计稿：name 自动拼接 "· X 个来源" 后缀，避免与 name 重复
  const nameAlreadyHasCount = /·\s*\d+\s*个来源/.test(toolCall.name);
  const displayName = nameAlreadyHasCount ? toolCall.name : `${toolCall.name}${sourceCount > 0 ? ` · ${sourceCount} 个来源` : ''}`;

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
            paddingVertical: 10,
            paddingHorizontal: 12,
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
            {displayName}
          </Text>
          <Text
            style={{ fontSize: tokens.fontSize.xs, color: palette.fg3, marginTop: 1 }}
            numberOfLines={1}
          >
            {toolCall.description}
          </Text>
        </View>
        <View style={{ transform: [{ rotate: isExpanded ? '0deg' : '-90deg' }] }}>
          <Icon name="chevDown" size={14} color={palette.fg3} />
        </View>
      </Pressable>
      {isExpanded && toolCall.sources && toolCall.sources.length > 0 && (
        <View style={{ borderTopWidth: 1, borderTopColor: palette.border, paddingVertical: 8, paddingHorizontal: 12 }}>
          {toolCall.sources.map((source, i) => (
            <View key={source.index} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: palette.surface }}>
              <SourceItem index={source.index} title={source.title} url={source.url} />
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
