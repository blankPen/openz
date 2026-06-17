import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';
import type { ModelOption } from '../../types/chat';

type Props = {
  model: ModelOption;
  isSelected?: boolean;
  onPress?: (model: ModelOption) => void;
  testID?: string;
};

export function ModelOptionRow({ model, isSelected, onPress, testID }: Props) {
  const { palette, tokens } = useTheme();

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress?.(model)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 12,
          paddingHorizontal: 4,
          borderRadius: 12,
          opacity: pressed ? 0.6 : 1,
          backgroundColor: isSelected ? palette.surface2 : 'transparent',
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${model.name} ${model.isPro ? 'Pro' : ''}`}
    >
      {/* Icon */}
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          backgroundColor: model.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12,
        }}
      >
        <Icon name="model" size={22} color={model.iconColor} />
      </View>

      {/* Text content */}
      <View style={{ flex: 1, marginRight: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: tokens.fontSize.md,
              fontWeight: '600',
              color: palette.fg,
            }}
          >
            {model.name}
          </Text>
          {model.isPro && (
            <View
              style={{
                backgroundColor: '#1A66FF',
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: '#fff' }}>PRO</Text>
            </View>
          )}
          {model.tag && (
            <View
              style={{
                backgroundColor: model.tagColor ?? palette.surface2,
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: palette.fg2,
                }}
              >
                {model.tag}
              </Text>
            </View>
          )}
        </View>
        <Text
          style={{
            fontSize: tokens.fontSize.sm,
            color: palette.fg3,
            marginTop: 2,
          }}
          numberOfLines={2}
        >
          {model.description}
        </Text>
      </View>

      {/* Selected indicator */}
      {isSelected && (
        <Icon name="check" size={18} color="#1A66FF" />
      )}
    </Pressable>
  );
}
