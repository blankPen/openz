import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../hooks/useTheme';
import { useSheetStore } from '../stores/sheetStore';
import { DynamicIsland } from '../components/chrome/DynamicIsland';
import { StatusBar } from '../components/chrome/StatusBar';
import { HomeIndicator } from '../components/chrome/HomeIndicator';
import { IconButton } from '../components/topbar/IconButton';
import { Pill } from '../components/common/Pill';
import { WelcomeSection } from '../components/home/WelcomeSection';
import { ToolsStrip } from '../components/home/ToolsStrip';
import { InputBar } from '../components/input/InputBar';

function Topbar({ onMenuPress, onModelPress }: { onMenuPress?: () => void; onModelPress?: () => void }) {
  const { palette } = useTheme();

  return (
    <View style={topbarStyles.container}>
      {/* Left: menu button */}
      <IconButton
        name="burger"
        accessibilityLabel="打开菜单"
        onPress={onMenuPress}
      />

      {/* Center: Pill (model selector) */}
      <Pill
        name="OpenZ"
        meta="Z1 思考"
        onPress={onModelPress}
      />

      {/* Right: voice, phone, new chat */}
      <View style={topbarStyles.rightButtons}>
        <IconButton name="voice" accessibilityLabel="语音" />
        <IconButton name="phone" accessibilityLabel="电话" />
        <IconButton name="plus" accessibilityLabel="新对话" />
      </View>
    </View>
  );
}

const topbarStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 4,
    gap: 8,
  },
  rightButtons: {
    flexDirection: 'row',
    gap: 2,
  },
});

export function HomeScreen() {
  const { palette } = useTheme();
  const router = useRouter();
  const { openModelSheet } = useSheetStore();

  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <DynamicIsland />
      <StatusBar />
      <Topbar
        onMenuPress={() => {}}
        onModelPress={() => openModelSheet()}
      />
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <WelcomeSection name="Zhang San" subtitle="有什么可以帮你的？" />
      </View>
      <ToolsStrip />
      <InputBar
        onSend={(text) => {
          router.push('/chat');
        }}
      />
      <HomeIndicator />
    </View>
  );
}
