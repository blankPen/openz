import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; disabled?: boolean; accessibilityLabel?: string; testID?: string };

/**
 * 发送按钮（圆形蓝色填充）
 * 设计稿 home.html / conversation.html：`.input-action.send-btn` 始终
 * 背景色 var(--primary)，无 disabled 灰色变体。disable 时通过点击事件
 * 短路即可，颜色保持品牌一致。
 */
export function SendButton({ onPress, disabled, accessibilityLabel = '发送', testID }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: pressed ? palette.primary2 : '#1A66FF',
        opacity: disabled ? 0.45 : 1,
      })}
    >
      <Icon name="send" size={20} color="#FFFFFF" />
    </Pressable>
  );
}
