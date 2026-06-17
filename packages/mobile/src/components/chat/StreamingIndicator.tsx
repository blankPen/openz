import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export function StreamingIndicator() {
  const { palette, tokens } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[spinnerStyles.spinner, { borderColor: palette.border, borderTopColor: palette.primary }]} />
      <Text style={{ fontSize: tokens.fontSize.sm, color: palette.fg3 }}>
        OpenZ 正在回复…
      </Text>
    </View>
  );
}

const spinnerStyles = StyleSheet.create({
  spinner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 1.5,
  },
});
