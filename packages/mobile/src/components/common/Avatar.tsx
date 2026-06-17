import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  label: string;      // single char, e.g. "A" or "Z"
  size?: number;      // default 64
  color?: string;     // default palette.primary
  style?: StyleProp<ViewStyle>;
};

export function Avatar({ label, size = 64, color, style }: Props) {
  const { palette } = useTheme();
  const bg = color ?? palette.primary;
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.4,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
