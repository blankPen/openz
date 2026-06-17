import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; disabled?: boolean; accessibilityLabel?: string; testID?: string };

export function SendButton({ onPress, disabled, accessibilityLabel = '发送', testID }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
        backgroundColor: disabled
          ? palette.surface2
          : pressed
            ? palette.primary2
            : '#1A66FF',
      })}
    >
      <Icon name="send" size={20} color={disabled ? palette.fg3 : '#FFFFFF'} />
    </Pressable>
  );
}
