import { Pressable, View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  icon: React.ReactNode;     // Icon component
  iconBg: string;
  iconColor: string;
  name: string;
  size?: number;              // default 56
  isPrimary?: boolean;        // primary tool: scale 1.1 + shadow
  onPress?: () => void;
};

export function ToolCard({ icon, iconBg, iconColor, name, size = 56, isPrimary, onPress }: Props) {
  const { palette, tokens } = useTheme();
  const iconSize = isPrimary ? size * 1.1 : size;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        { alignItems: 'center', gap: 6, opacity: pressed ? 0.55 : 1 },
        isPrimary && { transform: [{ scale: 1.05 }] },
      ]}
    >
      <View
        style={{
          width: iconSize,
          height: iconSize,
          borderRadius: 16,
          backgroundColor: iconBg,
          alignItems: 'center',
          justifyContent: 'center',
          ...(isPrimary ? { shadowColor: '#1A66FF', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.18, shadowRadius: 12 } : {}),
        }}
      >
        {icon}
      </View>
      <Text style={{ fontSize: tokens.fontSize.xs, fontWeight: isPrimary ? '600' : '500', color: palette.fg2 }}>
        {name}
      </Text>
    </Pressable>
  );
}
