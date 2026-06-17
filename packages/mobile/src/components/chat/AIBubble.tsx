import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  content: string;     // supports **bold** and `code`
  timestamp: string;
};

function renderContent(text: string) {
  // Simple markdown parsing: **text** → bold, `code` → monospace
  const parts: React.ReactNode[] = [];
  const regex = /\*\*([^*]+)\*\*|`([^`]+)`/g;
  let last = 0;
  let match;
  let key = 0;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(<Text key={key++}>{text.slice(last, match.index)}</Text>);
    }
    if (match[1]) {
      parts.push(<Text key={key++} style={{ fontWeight: '700' }}>{match[1]}</Text>);
    } else if (match[2]) {
      parts.push(
        <Text key={key++} style={{ fontFamily: 'Menlo', backgroundColor: '#E8E8ED', borderRadius: 4, paddingHorizontal: 4 }}>
          {match[2]}
        </Text>
      );
    }
    last = regex.lastIndex;
  }
  if (last < text.length) {
    parts.push(<Text key={key++}>{text.slice(last)}</Text>);
  }
  return parts;
}

export function AIBubble({ content, timestamp }: Props) {
  const { palette, tokens } = useTheme();
  return (
    <View style={{ alignItems: 'flex-start' }}>
      <View
        style={{
          maxWidth: '88%',
          backgroundColor: palette.surface,
          borderRadius: 4,
          borderTopLeftRadius: 18,
          borderBottomLeftRadius: 18,
          borderBottomRightRadius: 18,
          paddingVertical: 12,
          paddingHorizontal: 14,
        }}
      >
        <Text style={{ color: palette.fg, fontSize: tokens.fontSize.lg, lineHeight: tokens.fontSize.lg * 1.55 }}>
          {renderContent(content)}
        </Text>
      </View>
      <Text style={{ fontSize: tokens.fontSize.xs, color: palette.fg3, paddingHorizontal: 4, marginTop: 4 }}>
        {timestamp}
      </Text>
    </View>
  );
}
