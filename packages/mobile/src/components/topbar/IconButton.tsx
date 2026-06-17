import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon, type IconName } from '../common/Icon';

type Props = {
  name: IconName;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function IconButton({ name, size = 22, onPress, style, accessibilityLabel }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? name}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? palette.surface : 'transparent',
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={palette.fg} />
    </Pressable>
  );
}
