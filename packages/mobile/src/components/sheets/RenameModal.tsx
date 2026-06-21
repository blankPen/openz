import { Modal, Pressable, View, Text, TextInput, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  visible: boolean;
  initialValue: string;
  onConfirm: (newTitle: string) => void;
  onClose: () => void;
};

export function RenameModal({ visible, initialValue, onConfirm, onClose }: Props) {
  const { palette, tokens } = useTheme();

  const handleConfirm = (text: string) => {
    const trimmed = text.trim();
    if (trimmed) {
      onConfirm(trimmed);
    }
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.modalBox,
            { backgroundColor: palette.bg },
          ]}
        >
          <Text style={[styles.modalTitle, { color: palette.fg }]}>重命名会话</Text>
          <TextInput
            defaultValue={initialValue}
            style={[
              styles.modalInput,
              {
                color: palette.fg,
                borderColor: palette.border,
                backgroundColor: palette.surface,
                fontSize: tokens.fontSize.md,
              },
            ]}
            autoFocus
            selectTextOnFocus
            onSubmitEditing={(e) => handleConfirm(e.nativeEvent.text)}
            returnKeyType="done"
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.cancelBtn,
                { backgroundColor: pressed ? palette.surface2 : palette.surface },
              ]}
            >
              <Text style={[styles.cancelBtnText, { color: palette.fg }]}>取消</Text>
            </Pressable>
            <Pressable
              onPress={(e) => {
                const text = (e.currentTarget as any)._lastNativeText || initialValue;
                // Use ref-based approach to get input value
              }}
              style={({ pressed }) => [
                styles.modalBtn,
                styles.confirmBtn,
                { backgroundColor: pressed ? palette.primary2 : palette.primary },
              ]}
            >
              <Text style={styles.confirmBtnText}>确定</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBox: {
    width: 280,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 40,
    elevation: 20,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 14,
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  cancelBtn: {},
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirmBtn: {},
  confirmBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
