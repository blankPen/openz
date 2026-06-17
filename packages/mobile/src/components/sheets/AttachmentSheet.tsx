import { View, Text, Pressable, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { Icon } from '../common/Icon';
import { FileCard } from './FileCard';

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

// ── Entry grid item ───────────────────────────────────────────────────────────

type Entry = {
  icon: string;
  label: string;
  color: string;
  bg: string;
};

const ENTRIES: Entry[] = [
  { icon: 'image', label: '本地图片', color: '#1A66FF', bg: '#EAF1FF' },
  { icon: 'file', label: '本地文件', color: '#FF7A45', bg: '#FFE8DB' },
  { icon: 'camera', label: '拍照', color: '#34A853', bg: '#E1F4E9' },
  { icon: 'quote', label: '引用回复', color: '#8B5CF6', bg: '#F0E7FE' },
];

function EntryGrid() {
  const { palette, tokens } = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
      {ENTRIES.map((e) => (
        <Pressable
          key={e.label}
          onPress={() => {}}
          style={({ pressed }) => [
            {
              width: '47%',
              flexDirection: 'row',
              alignItems: 'center',
              gap: 10,
              paddingVertical: 14,
              paddingHorizontal: 12,
              borderRadius: 12,
              backgroundColor: e.bg,
              opacity: pressed ? 0.6 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel={e.label}
        >
          <Icon name={e.icon as any} size={20} color={e.color} />
          <Text style={{ color: palette.fg, fontSize: tokens.fontSize.md, fontWeight: '600' }}>
            {e.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ── Recent files ─────────────────────────────────────────────────────────────

const RECENT_FILES = [
  { name: '项目需求文档.pdf', path: '/Users/alex/Downloads', size: '2.4 MB' },
  { name: '会议记录-2025-06-01.txt', path: '/Users/alex/Documents', size: '48 KB' },
  { name: '截图 2025-06-01.png', path: '/Users/alex/Desktop', size: '1.1 MB' },
];

// ── AttachmentSheet ──────────────────────────────────────────────────────────

export function AttachmentSheet({ visible, onClose, testID }: Props) {
  const { palette, tokens } = useTheme();

  return (
    <BottomSheet visible={visible} title="添加附件" onClose={onClose} testID={testID}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <EntryGrid />

        <Text
          style={{
            color: palette.fg3,
            fontSize: tokens.fontSize.xs,
            fontWeight: '600',
            textTransform: 'uppercase',
            letterSpacing: 0.5,
            marginBottom: 8,
            marginLeft: 4,
          }}
        >
          最近文件
        </Text>
        <View style={{ gap: 8 }}>
          {RECENT_FILES.map((f) => (
            <FileCard key={f.name} name={f.name} path={f.path} size={f.size} />
          ))}
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
