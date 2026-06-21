import { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Switch,
  TextInput,
  StyleSheet,
  Modal,
} from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { useSettingsStore } from '../stores/settingsStore';
import { Icon } from '../components/common/Icon';
import { BottomSheet } from '../components/sheets/BottomSheet';
import type { ThemeMode, FontSize, Language } from '../stores/settingsStore';

// ── Section label ───────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  const { palette, tokens } = useTheme();
  return (
    <Text
      style={{
        color: palette.fg3,
        fontSize: tokens.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingHorizontal: 4,
        marginTop: 16,
        marginBottom: 6,
      }}
    >
      {title}
    </Text>
  );
}

// ── Row ──────────────────────────────────────────────────────────────────────

interface RowProps {
  label: string;
  value?: string;
  onPress?: () => void;
  children?: React.ReactNode;
}

function Row({ label, value, onPress, children }: RowProps) {
  const { palette, tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: pressed && onPress ? palette.surface : 'transparent' },
      ]}
      accessibilityRole={onPress ? 'button' : 'none'}
    >
      <Text style={[styles.rowLabel, { color: palette.fg, fontSize: tokens.fontSize.md }]}>{label}</Text>
      <View style={styles.rowRight}>
        {value && (
          <Text style={[styles.rowValue, { color: palette.fg3, fontSize: tokens.fontSize.md }]}>{value}</Text>
        )}
        {children}
        {onPress && <Icon name="chevDown" size={14} color={palette.fg3} />}
      </View>
    </Pressable>
  );
}

function SwitchRow({ label, value, onValueChange }: { label: string; value: boolean; onValueChange: (v: boolean) => void }) {
  const { palette, tokens } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, { color: palette.fg, fontSize: tokens.fontSize.md }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: palette.surface2, true: palette.primary }}
        thumbColor="#fff"
        ios_backgroundColor={palette.surface2}
      />
    </View>
  );
}

// ── Selector sheet ────────────────────────────────────────────────────────────

interface SelectorOption<T extends string> {
  label: string;
  value: T;
}

interface SelectorSheetProps<T extends string> {
  visible: boolean;
  title: string;
  options: SelectorOption<T>[];
  current: T;
  onSelect: (v: T) => void;
  onClose: () => void;
}

function SelectorSheet<T extends string>({
  visible,
  title,
  options,
  current,
  onSelect,
  onClose,
}: SelectorSheetProps<T>) {
  const { palette, tokens } = useTheme();
  return (
    <BottomSheet visible={visible} title={title} onClose={onClose}>
      <ScrollView style={{ maxHeight: 340 }} showsVerticalScrollIndicator={false}>
        {options.map((opt) => {
          const isSelected = opt.value === current;
          return (
            <Pressable
              key={opt.value}
              onPress={() => { onSelect(opt.value); onClose(); }}
              style={({ pressed }) => [
                styles.selectorRow,
                { backgroundColor: pressed ? palette.surface : 'transparent' },
              ]}
            >
              <Text
                style={[
                  styles.selectorLabel,
                  { color: isSelected ? palette.primary : palette.fg, fontSize: tokens.fontSize.lg },
                ]}
              >
                {opt.label}
              </Text>
              {isSelected && <Icon name="check" size={16} color={palette.primary} />}
            </Pressable>
          );
        })}
      </ScrollView>
    </BottomSheet>
  );
}

// ── Theme options ────────────────────────────────────────────────────────────

const THEME_OPTIONS: SelectorOption<ThemeMode>[] = [
  { label: '浅色', value: 'light' },
  { label: '深色', value: 'dark' },
  { label: '跟随系统', value: 'system' },
];

const FONT_SIZE_OPTIONS: SelectorOption<FontSize>[] = [
  { label: '小', value: 'small' },
  { label: '标准', value: 'standard' },
  { label: '大', value: 'large' },
];

const LANGUAGE_OPTIONS: SelectorOption<Language>[] = [
  { label: '简体中文', value: 'zh-CN' },
  { label: 'English', value: 'en-US' },
];

// ── SettingsScreen ────────────────────────────────────────────────────────────

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

export function SettingsScreen({ visible, onClose, testID }: Props) {
  const { palette, tokens, setMode } = useTheme();

  // Settings
  const serverUrl = useSettingsStore((s) => s.serverUrl);
  const setServerUrl = useSettingsStore((s) => s.setServerUrl);
  const themeMode = useSettingsStore((s) => s.themeMode);
  const setThemeMode = useSettingsStore((s) => s.setThemeMode);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const language = useSettingsStore((s) => s.language);
  const setLanguage = useSettingsStore((s) => s.setLanguage);
  const voiceBroadcast = useSettingsStore((s) => s.voiceBroadcast);
  const setVoiceBroadcast = useSettingsStore((s) => s.setVoiceBroadcast);
  const enterToSend = useSettingsStore((s) => s.enterToSend);
  const setEnterToSend = useSettingsStore((s) => s.setEnterToSend);
  const ttsAutoPlay = useSettingsStore((s) => s.ttsAutoPlay);
  const setTtsAutoPlay = useSettingsStore((s) => s.setTtsAutoPlay);

  // Local draft for serverUrl
  const [serverUrlDraft, setServerUrlDraft] = useState(serverUrl);
  useEffect(() => setServerUrlDraft(serverUrl), [serverUrl]);

  // Selector sheet state
  const [selectorKey, setSelectorKey] = useState<string | null>(null);

  const openSelector = (key: string) => setSelectorKey(key);
  const closeSelector = () => setSelectorKey(null);

  const handleThemeSelect = (v: ThemeMode) => {
    setThemeMode(v);
    setMode(v);
  };

  const handleSaveServerUrl = () => {
    setServerUrl(serverUrlDraft.trim());
  };

  const themeLabels: Record<ThemeMode, string> = {
    light: '浅色',
    dark: '深色',
    system: '跟随系统',
  };
  const fontSizeLabels: Record<FontSize, string> = {
    small: '小',
    standard: '标准',
    large: '大',
  };
  const languageLabels: Record<Language, string> = {
    'zh-CN': '简体中文',
    'en-US': 'English',
  };

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        </View>
        <View
          testID={testID}
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            maxHeight: '85%',
            backgroundColor: palette.bg,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            paddingBottom: 28,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -10 },
            shadowOpacity: 0.15,
            shadowRadius: 40,
          }}
        >
          {/* Handle */}
          <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
            <View style={{ width: 40, height: 4, backgroundColor: palette.surface2, borderRadius: 2 }} />
          </View>

          {/* Header */}
          <View style={styles.sheetHeader}>
            <Text style={[styles.sheetTitle, { color: palette.fg }]}>设置</Text>
            <Pressable
              onPress={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: palette.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              accessibilityLabel="关闭"
            >
              <Icon name="close" size={14} color={palette.fg2} />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 8 }}
            showsVerticalScrollIndicator={false}
          >
            {/* 服务器 */}
            <SectionLabel title="服务器" />
            <View style={[styles.row, { backgroundColor: palette.surface, borderRadius: 10, paddingHorizontal: 14 }]}>
              <Text style={[styles.rowLabel, { color: palette.fg, fontSize: tokens.fontSize.md }]}>Daemon 地址</Text>
            </View>
            <TextInput
              value={serverUrlDraft}
              onChangeText={setServerUrlDraft}
              placeholder="http://localhost:19999"
              placeholderTextColor={palette.fg3}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="done"
              onSubmitEditing={handleSaveServerUrl}
              style={[
                styles.urlInput,
                {
                  color: palette.fg,
                  borderColor: palette.border,
                  backgroundColor: palette.surface,
                  fontSize: tokens.fontSize.md,
                },
              ]}
              testID="settings-server-url-input"
            />
            <Pressable
              onPress={handleSaveServerUrl}
              style={({ pressed }) => [
                styles.saveBtn,
                { backgroundColor: pressed ? palette.primary2 : palette.primary },
              ]}
              testID="settings-server-url-save"
            >
              <Text style={styles.saveBtnText}>保存</Text>
            </Pressable>
            <Text style={[styles.hintText, { color: palette.fg3 }]}>
              当前: {serverUrl || '(未配置)'}
            </Text>

            {/* 外观 */}
            <SectionLabel title="外观" />
            <View style={[styles.rowGroup, { backgroundColor: palette.surface, borderRadius: 10, overflow: 'hidden' }]}>
              <Row
                label="主题"
                value={themeLabels[themeMode]}
                onPress={() => openSelector('theme')}
              />
              <View style={[styles.separator, { backgroundColor: palette.border }]} />
              <Row
                label="字体大小"
                value={fontSizeLabels[fontSize]}
                onPress={() => openSelector('fontSize')}
              />
            </View>

            {/* 语言 */}
            <SectionLabel title="语言" />
            <View style={[styles.rowGroup, { backgroundColor: palette.surface, borderRadius: 10, overflow: 'hidden' }]}>
              <Row
                label="界面语言"
                value={languageLabels[language]}
                onPress={() => openSelector('language')}
              />
            </View>

            {/* 交互 */}
            <SectionLabel title="交互" />
            <View style={[styles.rowGroup, { backgroundColor: palette.surface, borderRadius: 10, overflow: 'hidden' }]}>
              <SwitchRow
                label="语音播报"
                value={voiceBroadcast}
                onValueChange={setVoiceBroadcast}
              />
              <View style={[styles.separator, { backgroundColor: palette.border }]} />
              <SwitchRow
                label="Enter 发送"
                value={enterToSend}
                onValueChange={setEnterToSend}
              />
              <View style={[styles.separator, { backgroundColor: palette.border }]} />
              <SwitchRow
                label="AI 回复自动播报"
                value={ttsAutoPlay}
                onValueChange={setTtsAutoPlay}
              />
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Selector sheets */}
      <SelectorSheet
        visible={selectorKey === 'theme'}
        title="选择主题"
        options={THEME_OPTIONS}
        current={themeMode}
        onSelect={handleThemeSelect}
        onClose={closeSelector}
      />
      <SelectorSheet
        visible={selectorKey === 'fontSize'}
        title="选择字体大小"
        options={FONT_SIZE_OPTIONS}
        current={fontSize}
        onSelect={(v) => setFontSize(v)}
        onClose={closeSelector}
      />
      <SelectorSheet
        visible={selectorKey === 'language'}
        title="选择语言"
        options={LANGUAGE_OPTIONS}
        current={language}
        onSelect={(v) => setLanguage(v)}
        onClose={closeSelector}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 8,
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  rowGroup: {
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  rowLabel: {
    fontWeight: '400',
    flex: 1,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowValue: {
    fontWeight: '400',
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 14,
  },
  urlInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 8,
  },
  saveBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  hintText: {
    fontSize: 11,
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 4,
    minHeight: 44,
  },
  selectorLabel: {
    fontWeight: '400',
  },
});
