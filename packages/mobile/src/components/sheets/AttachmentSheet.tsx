import { View, Text, Pressable, ScrollView, StyleSheet, Alert } from 'react-native';
import { useCallback } from 'react';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { Icon } from '../common/Icon';
import { FileCard } from './FileCard';
import { pickImage, takePhoto, pickDocument, requestMediaLibraryPermission } from '../../lib/attachment';
import type { Attachment } from '../../types/chat';

type Props = {
  visible: boolean;
  onClose: () => void;
  onAttachmentSelected?: (attachment: Attachment) => void;
  testID?: string;
};

// ── 4 核心入口 —— 与设计稿 attachment.html 对齐 ──────────────────────────────

type Entry = {
  icon: 'image' | 'doc' | 'camera' | 'quote';
  label: string;
  color: string;
  bg: string;
  action: () => void;
};

const ENTRIES = (onPickImage: () => void, onTakePhoto: () => void, onPickDoc: () => void): Entry[] => [
  { icon: 'image', label: '本地图片', color: '#1A66FF', bg: '#EAF1FF', action: onPickImage },
  { icon: 'doc', label: '本地文件', color: '#FF7A45', bg: '#FFE8DB', action: onPickDoc },
  { icon: 'camera', label: '拍照', color: '#34A853', bg: '#E1F4E9', action: onTakePhoto },
  { icon: 'quote', label: '引用回复', color: '#8B5CF6', bg: '#F0E7FE', action: () => Alert.alert('提示', '引用回复功能开发中') },
];

// ── Entry grid item ────────────────────────────────────────────────────────

function EntryItem({ entry, testID }: { entry: Entry; testID?: string }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={entry.action}
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

// ── AttachmentSheet ────────────────────────────────────────────────────────

export function AttachmentSheet({ visible, onClose, onAttachmentSelected, testID }: Props) {
  const handlePickImage = useCallback(async () => {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('权限不足', '需要相册权限才能选择图片');
      return;
    }
    const attachment = await pickImage();
    if (attachment) {
      onAttachmentSelected?.(attachment);
      onClose();
    }
  }, [onAttachmentSelected, onClose]);

  const handleTakePhoto = useCallback(async () => {
    const attachment = await takePhoto();
    if (attachment) {
      onAttachmentSelected?.(attachment);
      onClose();
    }
  }, [onAttachmentSelected, onClose]);

  const handlePickDocument = useCallback(async () => {
    const attachment = await pickDocument();
    if (attachment) {
      onAttachmentSelected?.(attachment);
      onClose();
    }
  }, [onAttachmentSelected, onClose]);

  const entries = ENTRIES(handlePickImage, handleTakePhoto, handlePickDocument);

  return (
    <BottomSheet visible={visible} title="添加附件" onClose={onClose} testID={testID}>
      <ScrollView
        style={{ maxHeight: 520 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {/* 4 entry grid */}
        <View style={styles.entryGrid}>
          {entries.map((e) => (
            <EntryItem key={e.label} entry={e} testID={`entry-${e.label}`} />
          ))}
        </View>

        {/* 提示文字 */}
        <Text style={styles.sectionLabel}>最近使用</Text>
        <View style={styles.emptyState}>
          <Icon name="doc" size={32} color="#8E8E93" />
          <Text style={styles.emptyText}>暂无最近使用的文件</Text>
          <Text style={styles.emptyHint}>选择上方选项添加附件</Text>
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#3C3C43',
    fontWeight: '500',
  },
  emptyHint: {
    fontSize: 12,
    color: '#8E8E93',
  },
});
