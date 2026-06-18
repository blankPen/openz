import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';
import type { ModelOption } from '../../types/chat';

type Props = {
  model: ModelOption;
  isSelected?: boolean;
  /** 当非空时（如 'A' / '小' / '博'）渲染为头像文字 */
  avatarLabel?: string;
  /** Tag 颜色：'pro' (蓝紫渐变+白字) | 'normal' (橙底橙字 #FFE8DB/#FF7A45) | 'soft' (蓝底蓝字 #EAF1FF/#1A66FF) | 'default' */
  tagVariant?: 'pro' | 'normal' | 'soft' | 'default';
  onPress?: (model: ModelOption) => void;
  testID?: string;
};

/**
 * ModelSwitchSheet 中的选项行
 * 设计稿 model-switch.html：`.option` 36×36 圆角 10px icon + 标题 + 描述
 *   active: 背景 --primary-soft + 1.5px --primary 边框 + 右侧 --primary check
 *   tag 默认使用浅橙底+橙字 (最新/稳定)
 */
export function ModelOptionRow({ model, isSelected, avatarLabel, tagVariant = 'normal', onPress, testID }: Props) {
  const { palette, tokens } = useTheme();

  const tagColorConfig = {
    pro: { bg: '#1A66FF', fg: '#FFFFFF' },
    normal: { bg: '#FFE8DB', fg: '#FF7A45' },
    soft: { bg: '#EAF1FF', fg: '#1A66FF' },
    default: { bg: palette.surface2, fg: palette.fg2 },
  } as const;
  const tagStyle = tagColorConfig[tagVariant];

  return (
    <Pressable
      testID={testID}
      onPress={() => onPress?.(model)}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          marginBottom: 8,
          backgroundColor: isSelected ? palette.primarySoft : palette.surface,
          borderWidth: isSelected ? 1.5 : 0,
          borderColor: isSelected ? palette.primary : 'transparent',
          opacity: pressed ? 0.6 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={`${model.name} ${model.isPro ? 'Pro' : ''}`}
    >
      {/* Icon / avatar */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: model.iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {avatarLabel ? (
          <Text style={{ color: model.iconColor, fontSize: 16, fontWeight: '700' }}>
            {avatarLabel}
          </Text>
        ) : (
          <Icon name={'model' as any} size={18} color={model.iconColor} />
        )}
      </View>

      {/* Text content */}
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              fontSize: tokens.fontSize.md,
              fontWeight: '600',
              color: palette.fg,
            }}
            numberOfLines={1}
          >
            {model.name}
          </Text>
          {model.isPro && (
            <View
              style={{
                backgroundColor: tagStyle.bg,
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text style={{ fontSize: 10, fontWeight: '700', color: tagStyle.fg }}>PRO</Text>
            </View>
          )}
          {model.tag && (
            <View
              style={{
                backgroundColor: tagStyle.bg,
                borderRadius: 4,
                paddingHorizontal: 5,
                paddingVertical: 1,
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: '600',
                  color: tagStyle.fg,
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
            marginTop: 1,
          }}
          numberOfLines={2}
        >
          {model.description}
        </Text>
      </View>

      {/* Check mark */}
      {isSelected && <Icon name="check" size={20} color={palette.primary} />}
    </Pressable>
  );
}
