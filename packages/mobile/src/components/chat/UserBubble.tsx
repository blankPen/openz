import { View, Text, useWindowDimensions } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  content: string;
  timestamp: string;
};

export function UserBubble({ content, timestamp }: Props) {
  const { palette, tokens } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  const maxBubbleWidth = Math.min(screenWidth * 0.78, 360);

  return (
    <View style={{ alignItems: 'flex-end' }}>
      <View
        testID="user-bubble"
        style={{
          maxWidth: maxBubbleWidth,
          backgroundColor: palette.primary,
          borderRadius: 18,
          borderBottomRightRadius: 4,
          paddingVertical: 10,
          paddingHorizontal: 14,
        }}
      >
        <Text
          style={{ color: '#FFFFFF', fontSize: tokens.fontSize.lg, lineHeight: tokens.fontSize.lg * 1.4 }}
        >
          {content}
        </Text>
      </View>
      <Text style={{ fontSize: tokens.fontSize.xs, color: palette.fg3, paddingHorizontal: 4, marginTop: 4 }}>
        {timestamp}
      </Text>
    </View>
  );
}
