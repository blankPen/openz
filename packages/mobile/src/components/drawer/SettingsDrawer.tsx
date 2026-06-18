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
import { useSettingsStore } from '../../stores/settingsStore';
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
        { backgroundColor: pressed ? palette.surface : 'transparent' },
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
  // 抽屉打开时背景遮罩透明度从 0 渐入到 0.45,关闭时渐出
  const backdropOpacity = useRef(new Animated.Value(0)).current;

  const voiceBroadcast = useSettingsStore((s) => s.voiceBroadcast);
  const setVoiceBroadcast = useSettingsStore((s) => s.setVoiceBroadcast);
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const setEnterToSend = useSettingsStore((s) => s.setEnterToSend);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const language = useSettingsStore((s) => s.language);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(translateX, {
        toValue: visible ? 0 : -320,
        duration: 260,
        useNativeDriver: true,
      }),
      Animated.timing(backdropOpacity, {
        toValue: visible ? 0.45 : 0,
        duration: 260,
        useNativeDriver: true,
      }),
    ]).start();
  }, [visible, translateX, backdropOpacity]);

  const fontSizeLabel = { small: '小', standard: '标准', large: '大' }[fontSize];
  const languageLabel = { 'zh-CN': '中文', 'en-US': 'English' }[language];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      {/* 半透明遮罩 —— 设计稿要求抽屉展开时点击外部关闭,这里加可见遮罩 */}
      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000', opacity: backdropOpacity }]}
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessibilityLabel="关闭设置面板"
        />
      </Animated.View>

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
          {/* Header / UserCard —— 设计稿 settings.html .drawer-head：
             padding 60px 20px 18px，border-bottom: 1px solid var(--border) */}
          <View style={[styles.userCard, { borderBottomColor: palette.border }]}>
            <Avatar label="A" size={52} />
            <View style={styles.userInfo}>
              <Text style={[styles.userName, { color: palette.fg, fontSize: 17 }]}>
                Alex
              </Text>
              <View style={[styles.proBadge, { backgroundColor: palette.primarySoft }]}>
                <Text style={{ color: palette.primary, fontSize: 11, fontWeight: '600' }}>
                  免费版 · 升级 Pro
                </Text>
              </View>
            </View>
          </View>

          {/* Section 1: 通用 —— 主题已锁定 light,不再提供外观切换控件 */}
          <Section title="通用">
            <View>
              <MenuItem icon="textSize" label="字体大小" value={fontSizeLabel + ' ›'} />
              <MenuItem icon="lang" label="语言" value={languageLabel + ' ›'} />
            </View>
          </Section>

          {/* Section 2: 智能助手 */}
          <Section title="智能助手">
            <View>
              <MenuItem icon="robot" label="默认模型" value="OpenZ Z1 ›" />
              <MenuItem
                icon="voice"
                label="语音播报"
                switchValue={voiceBroadcast}
                onSwitchChange={setVoiceBroadcast}
              />
              <MenuItem
                icon="quote"
                label="回车发送"
                switchValue={enterToSend}
                onSwitchChange={setEnterToSend}
              />
            </View>
          </Section>

          {/* Section 3: 账户 */}
          <Section title="账户">
            <View>
              <MenuItem icon="sparkles" label="订阅 Pro" value="解锁全部能力 ›" onPress={() => {}} />
              <MenuItem icon="chart" label="用量与配额" value="68% 已用 ›" onPress={() => {}} />
            </View>
          </Section>

          {/* Section 4: 其他 */}
          <Section title="其他">
            <View>
              <MenuItem icon="help" label="帮助与反馈" value="›" onPress={() => {}} />
              <MenuItem icon="info" label="关于 OpenZ" value="v 2.6.0 ›" onPress={() => {}} />
            </View>
          </Section>
        </ScrollView>

        {/* Logout */}
        <View style={[styles.footer, { borderTopColor: palette.border }]}>
          <Pressable
            onPress={() => {}}
            style={({ pressed }) => [
              styles.logoutBtn,
              { backgroundColor: pressed ? palette.surface : 'transparent' },
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
  scrollContent: { paddingHorizontal: 12, paddingTop: 60, paddingBottom: 16 },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 18,
    borderBottomWidth: 1,
    marginBottom: 18,
  },
  userInfo: { flex: 1 },
  menuIcon: {
    width: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: { fontWeight: '600', marginBottom: 6 },
  proBadge: {
    alignSelf: 'flex-start',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  section: { marginBottom: 18 },
  sectionTitle: {
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
    marginLeft: 8,
  },
  sectionBody: {
    // 设计稿：扁平列表，无 surface 容器
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minHeight: 40,
  },
  menuLabel: { flex: 1, fontWeight: '500' },
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
