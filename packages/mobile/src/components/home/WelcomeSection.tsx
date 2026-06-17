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
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingVertical: 16,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      testID="welcome-section"
    >
      <Avatar label={avatarLabel} size={52} color={palette.primary} />
      <View style={{ marginStart: 14, flex: 1 }}>
        <Text
          style={{
            fontSize: 22,
            fontWeight: '700',
            color: palette.fg,
            includeFontPadding: false,
          }}
          testID="welcome-name"
        >
          {name}
        </Text>
        {subtitle && (
          <Text
            style={{
              fontSize: 14,
              color: palette.fg3,
              marginTop: 2,
            }}
            testID="welcome-subtitle"
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}
