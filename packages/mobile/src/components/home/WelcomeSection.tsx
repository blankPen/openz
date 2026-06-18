import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../common/Avatar';

type Props = {
  /** Display name shown as the heading, e.g. "Zhang San" */
  name: string;
  /** Optional subtitle / role line shown below the name */
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Greets the user with an avatar and their name.
 * Used at the top of the home screen.
 */
export function WelcomeSection({ name, subtitle, style }: Props) {
  const { palette } = useTheme();

  // First character of the first token for the avatar label
  const avatarLabel = name.trim().charAt(0).toUpperCase();

  return (
    <View
      style={[
        {
          flexDirection: 'column',
          alignItems: 'center',
          paddingHorizontal: 28,
          paddingBottom: 16,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      testID="welcome-section"
    >
      <Avatar
        label={avatarLabel}
        size={64}
        color={palette.primary}
        style={{ marginBottom: 14 }}
        testID="welcome-avatar"
      />
      <Text
        style={{
          fontSize: 20,
          fontWeight: '600',
          lineHeight: 29, // 20 * 1.45 = 29
          color: palette.fg,
          includeFontPadding: false,
          textAlign: 'center',
        }}
        testID="welcome-greeting"
      >
        嗨 <Text style={{ color: palette.primary }}>{name}</Text>，今天要和{' '}
        <Text style={{ color: palette.primary }}>OpenZ</Text>
        {' 一起做点什么？'}
      </Text>
    </View>
  );
}
