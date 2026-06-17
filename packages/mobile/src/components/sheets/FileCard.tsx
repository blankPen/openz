import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  name: string;
  path: string;
  size?: string;
  testID?: string;
};

export function FileCard({ name, path, size, testID }: Props) {
  const { palette, tokens } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        backgroundColor: palette.surface,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: palette.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 18 }}>📄</Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: tokens.fontSize.md, fontWeight: '600', color: palette.fg }}
          numberOfLines={1}
        >
          {name}
        </Text>
        <Text
          style={{ fontSize: tokens.fontSize.xs, color: palette.fg3 }}
          numberOfLines={1}
        >
          {path}
        </Text>
      </View>
      {size && (
        <Text style={{ fontSize: tokens.fontSize.xs, color: palette.fg3 }}>
          {size}
        </Text>
      )}
    </View>
  );
}
