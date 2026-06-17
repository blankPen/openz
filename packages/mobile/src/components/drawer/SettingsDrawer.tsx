import { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { useSettingsStore, type ThemeMode } from '../../stores/settingsStore';
import { Avatar } from '../common/Avatar';
import { Icon } from '../common/Icon';
import { Switch } from './Switch';

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

// ── MenuItem ──────────────────────────────────────────────────────────────────

type MenuItemProps = {
  icon: string;
  label: string;
  value?: string;
  switchValue?: boolean;
  onSwitchChange?: (v: boolean) => void;
  onPress?: () => void;
  danger?: boolean;
};

function MenuItem({ icon, label, value, switchValue, onSwitchChange, onPress, danger }: MenuItemProps) {
  const { palette, tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuItem,
        { opacity: pressed ? 0.6 : 1, backgroundColor: palette.surface },
      ]}
      accessibilityRole={onSwitchChange ? 'switch' : 'button'}
    >
      <Icon name={icon as any} size={18} color={danger ? palette.danger : palette.fg3} />
      <Text
        style={[
          styles.menuLabel,
          { color: danger ? palette.danger : palette.fg, fontSize: tokens.fontSize.md },
        ]}
      >
        {label}
      </Text>
      {value && !onSwitchChange && (
        <Text style={{ color: palette.fg3, fontSize: tokens.fontSize.sm }}>{value}</Text>
      )}
      {onSwitchChange && (
        <Switch value={switchValue ?? false} onChange={onSwitchChange} />
      )}
    </Pressable>
  );
}

// ── ThemeToggle ───────────────────────────────────────────────────────────────

function ThemeToggle({ value, onChange }: { value: ThemeMode; onChange: (m: ThemeMode) => void }) {
  const { palette, tokens } = useTheme();
  const options: { label: string; value: ThemeMode }[] = [
    { label: '浅色', value: 'light' },
    { label: '深色', value: 'dark' },
    { label: '自动', value: 'system' },
  ];

  return (
    <View style={[styles.themeToggle, { backgroundColor: palette.surface2 }]}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <Pressable
            key={opt.value}
            onPress={() => onChange(opt.value)}
            style={[
              styles.themeToggleBtn,
              active && { backgroundColor: palette.bg, borderRadius: 8 },
            ]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text
              style={{
                color: active ? palette.primary : palette.fg3,
                fontSize: tokens.fontSize.sm,
                fontWeight: active ? '600' : '400',
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// ── Section ──────────────────────────────────────────────────────────────────

type SectionProps = { title: string; children: React.ReactNode };

function Section({ title, children }: SectionProps) {
  const { palette, tokens } = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: palette.fg3, fontSize: tokens.fontSize.xs }]}>
        {title}
      </Text>
      <View style={[styles.sectionBody, { borderColor: palette.border }]}>{children}</View>
    </View>
  );
}

// ── SettingsDrawer ────────────────────────────────────────────────────────────

export function SettingsDrawer({ visible, onClose, testID }: Props) {
  const { palette, tokens } = useTheme();
  const translateX = useRef(new Animated.Value(-320)).current;

  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const voiceBroadcast = useSettingsStore((s) => s.voiceBroadcast);
  const setVoiceBroadcast = useSettingsStore((s) => s.setVoiceBroadcast);
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const setEnterToSend = useSettingsStore((s) => s.setEnterToSend);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const language = useSettingsStore((s) => s.language);

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: visible ? 0 : -320,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [visible, translateX]);

  const fontSizeLabel = { small: '小', standard: '标准', large: '大' }[fontSize];
  const languageLabel = { 'zh-CN': '中文', 'en-US': 'English' }[language];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={onClose}
        accessibilityLabel="关闭设置面板"
      />

      {/* Drawer */}
      <Animated.View
        testID={testID}
        style={[
          styles.drawer,
          { backgroundColor: palette.bg, shadowColor: '#000' },
          { transform: [{ translateX }] },
        ]}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header / UserCard */}
          <View style={[styles.userCard, { backgroundColor: palette.surface }]}>
            <Avatar label="A" size={56} />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: palette.fg, fontSize: tokens.fontSize.lg }]}>
                Alex
              </Text>
              <View style={[styles.proBadge, { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.primary, fontSize: tokens.fontSize.xs, fontWeight: '600' }}>
                  免费版 · 升级 Pro
                </Text>
              </View>
            </View>
          </View>

          {/* Section 1: 通用 */}
          <Section title="通用">
            <MenuItem icon="sun" label="外观" value={themeMode === 'light' ? '浅色' : themeMode === 'dark' ? '深色' : '自动'} />
            <ThemeToggle value={themeMode} onChange={setThemeMode} />
            <MenuItem icon="textSize" label="字体大小" value={fontSizeLabel} />
            <MenuItem icon="lang" label="语言" value={languageLabel} />
          </Section>

          {/* Section 2: 智能助手 */}
          <Section title="智能助手">
            <MenuItem icon="model" label="默认模型" value="OpenZ Z1" />
            <MenuItem
              icon="voice"
              label="语音播报"
              switchValue={voiceBroadcast}
              onSwitchChange={setVoiceBroadcast}
            />
            <MenuItem
              icon="send"
              label="回车发送"
              switchValue={enterToSend}
              onSwitchChange={setEnterToSend}
            />
          </Section>

          {/* Section 3: 账户 */}
          <Section title="账户">
            <MenuItem icon="sparkles" label="订阅 Pro" value="升级" onPress={() => {}} />
            <MenuItem icon="chart" label="用量" value="查看" onPress={() => {}} />
          </Section>

          {/* Section 4: 其他 */}
          <Section title="其他">
            <MenuItem icon="help" label="帮助" onPress={() => {}} />
            <MenuItem icon="info" label="关于" onPress={() => {}} />
          </Section>
        </ScrollView>

        {/* Logout */}
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              styles.logoutBtn,
              { opacity: pressed ? 0.6 : 1, backgroundColor: palette.surface },
            ]}
            accessibilityRole="button"
          >
            <Icon name="logout" size={18} color={palette.danger} />
            <Text style={[styles.logoutText, { color: palette.danger, fontSize: tokens.fontSize.md }]}>
              退出登录
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  drawer: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 320,
    shadowOffset: { width: 8, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 10,
  },
  scrollContent: { paddingHorizontal: 16, paddingTop: 60, paddingBottom: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  userInfo: { flex: 1 },
  userName: { fontWeight: '700', marginBottom: 6 },
  proBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionBody: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    paddingHorizontal: 14,
  },
  menuLabel: { flex: 1, fontWeight: '500' },
  themeToggle: {
    flexDirection: 'row',
    marginHorizontal: 14,
    marginVertical: 10,
    borderRadius: 10,
    padding: 3,
  },
  themeToggleBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    borderRadius: 8,
  },
  footer: {
    borderTopWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  logoutText: { fontWeight: '600' },
});
