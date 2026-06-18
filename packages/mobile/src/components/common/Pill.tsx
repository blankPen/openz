import { Pressable, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from './Icon';

type Props = {
  name: string;         // e.g. "OpenZ"
  meta?: string;        // e.g. "Z1 思考"
  onPress?: () => void;
  accessibilityLabel?: string;
};

export function Pill({ name, meta, onPress, accessibilityLabel }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }, { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 6 }]}
      accessibilityLabel={accessibilityLabel ?? `${name} ${meta ?? ''}`}
    >
      <Text style={{ fontSize: 14, fontWeight: '600', color: palette.fg, letterSpacing: -0.005 }}>
        {name}
      </Text>
      {meta && (
        <Text style={{ fontSize: 14, fontWeight: '500', color: palette.fg3, letterSpacing: -0.005 }}>
          {meta}
        </Text>
      )}
      <Icon name="chevDown" size={11} color={palette.fg3} />
    </Pressable>
  );
}
