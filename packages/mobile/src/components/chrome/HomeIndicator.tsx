import { View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export function HomeIndicator() {
  const { palette } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        height: 34,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 8,
      }}
    >
      <View
        style={{
          width: 134,
          height: 5,
          backgroundColor: palette.fg,
          borderRadius: 3,
        }}
      />
    </View>
  );
}
