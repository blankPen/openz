import { View, Text, StyleProp, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Avatar } from '../common/Avatar';

type Props = {
  /** Display name shown as the heading, e.g. "Alex" */
  name: string;
  /** Optional subtitle / role line shown below the name */
  subtitle?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * Greets the user with an OpenZ brand avatar and their name.
 * Used at the top of the home screen.
 *
 * 设计稿：Avatar 字母固定为 "Z"（OpenZ 品牌首字母），并使用蓝色渐变背景；
 * 标题在 "嗨 <name>，" 之后断行，第二行以 "今天要和 OpenZ 一起做点什么？" 收尾。
 */
export function WelcomeSection({ name, style }: Props) {
  const { palette } = useTheme();

  return (
    <View
      style={[
        {
          flexDirection: 'column',
          alignItems: 'center',
          paddingHorizontal: 28,
          paddingTop: 28,
          paddingBottom: 16,
          backgroundColor: palette.bg,
        },
        style,
      ]}
      testID="welcome-section"
    >
      <Avatar
        label="Z"
        size={64}
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
        嗨 <Text style={{ color: palette.primary }}>{name}</Text>，
        {'\n'}
        今天要和 <Text style={{ color: palette.primary }}>OpenZ</Text> 一起做点什么？
      </Text>
    </View>
  );
}
