import { View, Text, Pressable, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { Icon } from '../common/Icon';
import { FileCard } from './FileCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

// ── 4 核心入口 —— 与设计稿 attachment.html 对齐 ──────────────────────────────

type Entry = {
  icon: 'image' | 'doc' | 'camera' | 'quote';
  label: string;
  color: string;
  bg: string;
};

const ENTRIES: Entry[] = [
  { icon: 'image', label: '本地图片', color: '#1A66FF', bg: '#EAF1FF' },
  { icon: 'doc', label: '本地文件', color: '#FF7A45', bg: '#FFE8DB' },
  { icon: 'camera', label: '拍照', color: '#34A853', bg: '#E1F4E9' },
  { icon: 'quote', label: '引用回复', color: '#8B5CF6', bg: '#F0E7FE' },
];

// ── Entry grid item ────────────────────────────────────────────────────────

function EntryItem({ entry, testID }: { entry: Entry; testID?: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={() => {}}
      testID={testID}
      style={({ pressed }) => [
        styles.entry,
        { backgroundColor: '#F5F5F7', opacity: pressed ? 0.6 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={entry.label}
    >
      <View
        testID={testID ? `${testID}-icon` : undefined}
        style={[
          styles.entryIcon,
          { backgroundColor: entry.bg },
        ]}
      >
        <Icon name={entry.icon} size={22} color={entry.color} />
      </View>
      <Text style={{ color: '#3C3C43', fontSize: tokens.fontSize.xs, fontWeight: '500' }}>
        {entry.label}
      </Text>
    </Pressable>
  );
}

// ── Recent files —— 与设计稿 attachment.html 对齐 ──────────────────────────

const RECENT_FILES = [
  { name: '产品架构图_v2.png', path: '图片 · 2.4 MB', size: '昨天', fileType: 'img' as const },
  { name: '竞品分析_Q2.pdf', path: 'PDF · 18 页 · 3.1 MB', size: '2 天前', fileType: 'pdf' as const },
  { name: '用户访谈记录.xlsx', path: '表格 · 24 KB', size: '上周', fileType: 'xls' as const },
];

// ── AttachmentSheet ────────────────────────────────────────────────────────

export function AttachmentSheet({ visible, onClose, testID }: Props) {
  return (
    <BottomSheet visible={visible} title="添加附件" onClose={onClose} testID={testID}>
      <ScrollView
        style={{ maxHeight: 520 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {/* 4 entry grid */}
        <View style={styles.entryGrid}>
          {ENTRIES.map((e) => (
            <EntryItem key={e.label} entry={e} testID={`entry-${e.label}`} />
          ))}
        </View>

        {/* 最近使用 */}
        <Text style={styles.sectionLabel}>最近使用</Text>
        <View style={{ gap: 6 }}>
          {RECENT_FILES.map((f) => (
            <FileCard
              key={f.name}
              name={f.name}
              path={f.path}
              size={f.size}
              fileType={f.fileType}
            />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  entryGrid: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  entry: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 4,
    borderRadius: 12,
  },
  entryIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8E8E93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 14,
    marginBottom: 10,
    paddingHorizontal: 4,
  },
});
