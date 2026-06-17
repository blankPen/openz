import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  index: number;
  title: string;
  url: string;
};

export function SourceItem({ index, title, url }: Props) {
  const { palette, tokens } = useTheme();

  // Extract domain from URL
  const domain = url.replace(/^https?:\/\//, '').split('/')[0];

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
      <View
        style={{
          width: 18,
          height: 18,
          borderRadius: 4,
          backgroundColor: palette.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <Text style={{ fontSize: 11, fontWeight: '600', color: palette.primary }}>
          {index}
        </Text>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{ fontSize: tokens.fontSize.sm, color: palette.fg }}
          numberOfLines={1}
        >
          {title}
        </Text>
        <Text
          style={{ fontSize: tokens.fontSize.xs, color: palette.fg3 }}
          numberOfLines={1}
        >
          {domain}
        </Text>
      </View>
    </View>
  );
}
