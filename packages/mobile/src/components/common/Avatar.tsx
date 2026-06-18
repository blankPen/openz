import { View, Text, StyleProp, ViewStyle } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  label: string;      // single char, e.g. "A" or "Z"
  size?: number;      // default 64
  color?: string;     // default palette.primary
  /**
   * 使用蓝色渐变背景 (#4A8BFF → #1A66FF, 135deg)
   * 设计稿 home.html 中 Avatar 采用渐变填充；drawer 中用户头像亦使用渐变。
   */
  gradient?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

export function Avatar({ label, size = 64, color, gradient, style, testID }: Props) {
  const { palette } = useTheme();
  const useGradient = gradient ?? true;
  const solidBg = color ?? palette.primary;

  return (
    <View
      testID={testID}
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        },
        !useGradient && { backgroundColor: solidBg },
        style,
      ]}
    >
      {useGradient ? (
        <Svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          style={{ position: 'absolute', top: 0, left: 0 }}
          pointerEvents="none"
        >
          <Defs>
            <LinearGradient id={`avGrad-${size}`} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#4A8BFF" />
              <Stop offset="1" stopColor="#1A66FF" />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={size} rx={size / 2} ry={size / 2} fill={`url(#avGrad-${size})`} />
        </Svg>
      ) : null}
      <Text
        style={{
          color: '#FFFFFF',
          fontSize: size * 0.4,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
    </View>
  );
}
