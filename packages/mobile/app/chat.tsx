import { View } from 'react-native';
import { useTheme } from '../src/hooks/useTheme';
import { StatusBar as PhoneStatusBar } from '../src/components/chrome/StatusBar';
import { DynamicIsland } from '../src/components/chrome/DynamicIsland';
import { HomeIndicator } from '../src/components/chrome/HomeIndicator';

export default function Chat() {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <DynamicIsland />
      <PhoneStatusBar />
      <View style={{ flex: 1 }} />
      <HomeIndicator />
    </View>
  );
}
