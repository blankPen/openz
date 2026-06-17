import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; accessibilityLabel?: string };

export function AttachmentButton({ onPress, accessibilityLabel = '附件' }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Icon name="plus" size={20} color={palette.fg} />
    </Pressable>
  );
}
