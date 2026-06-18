import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';
import type { ThinkingStep } from '../../types/chat';

type Props = {
  elapsedSeconds: number;
  stepCount: number;
  steps: ThinkingStep[];
  onToggle?: () => void;
  isExpanded?: boolean; // default false
};

export function ThinkingCard({ elapsedSeconds, stepCount, steps, onToggle, isExpanded = false }: Props) {
  const { palette, tokens } = useTheme();
  return (
    <View style={{ maxWidth: '88%' }}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [
          {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            backgroundColor: palette.surface,
            borderRadius: 12,
            paddingVertical: 8,
            paddingHorizontal: 12,
            opacity: pressed ? 0.55 : 1,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
      >
        <View
          style={{
            width: 18,
            height: 18,
            borderRadius: 9,
            backgroundColor: palette.primarySoft,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name="flash" size={11} color={palette.primary} />
        </View>
        <Text style={{ flex: 1, fontSize: tokens.fontSize.sm, color: palette.fg2 }}>
          已思考 <Text style={{ fontWeight: '600', color: palette.fg }}>{elapsedSeconds} 秒</Text> · 规划 {stepCount} 个章节
        </Text>
        <Icon
          name="chevDown"
          size={12}
          color={palette.fg3}
          style={{ transform: [{ rotate: isExpanded ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {isExpanded && (
        <View style={{ marginTop: 6, backgroundColor: palette.surface, borderRadius: 12, overflow: 'hidden' }}>
          {steps.map((step, i) => (
            <View
              key={step.step}
              style={{
                flexDirection: 'row',
                gap: 10,
                padding: 9,
                borderBottomWidth: i < steps.length - 1 ? 1 : 0,
                borderBottomColor: palette.border,
              }}
            >
              <View
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: palette.primarySoft,
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Text style={{ fontSize: 10, fontWeight: '600', color: palette.primary }}>{step.step}</Text>
              </View>
              <Text style={{ flex: 1, fontSize: tokens.fontSize.sm, color: palette.fg2, lineHeight: tokens.fontSize.sm * 1.5 }}>
                {step.content}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
