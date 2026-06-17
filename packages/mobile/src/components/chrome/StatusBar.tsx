import { View, Text } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import Svg, { Rect, Path } from 'react-native-svg';

// 设计稿固定 9:41 + 信号/wifi/电池(均为 SVG 形式,不依赖系统 StatusBar)
export function StatusBar() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        height: 54,
        paddingTop: 18,
        paddingHorizontal: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '600', color: palette.fg }}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Svg width={18} height={12} viewBox="0 0 18 12" fill={palette.fg}>
          <Rect x={0} y={8} width={3} height={4} rx={0.5} />
          <Rect x={5} y={5} width={3} height={7} rx={0.5} />
          <Rect x={10} y={2} width={3} height={10} rx={0.5} />
          <Rect x={15} y={0} width={3} height={12} rx={0.5} />
        </Svg>
        <Svg width={16} height={12} viewBox="0 0 16 12" fill={palette.fg}>
          <Path d="M8 11a1 1 0 100-2 1 1 0 000 2zM4.5 7.5a4.5 4.5 0 016.5 0l-1 1a3 3 0 00-4.5 0l-1-1zM1.5 4.5a9 9 0 0110 0l-1 1a7.5 7.5 0 00-8 0l-1-1z" />
        </Svg>
        <Svg width={27} height={13} viewBox="0 0 27 13" fill="none">
          <Rect x={0.5} y={0.5} width={22} height={12} rx={3} stroke={palette.fg} strokeOpacity={0.35} />
          <Rect x={2} y={2} width={19} height={9} rx={1.5} fill={palette.fg} />
          <Rect x={24} y={4} width={2} height={5} rx={1} fill={palette.fg} fillOpacity={0.4} />
        </Svg>
      </View>
    </View>
  );
}
