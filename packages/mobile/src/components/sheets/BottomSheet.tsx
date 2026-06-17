import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../topbar/IconButton';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  testID?: string;
};

export function BottomSheet({ visible, title, onClose, children, testID }: Props) {
  const { palette } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]}
        accessibilityLabel="遮罩"
      />
      <View
        testID={testID}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '78%',
          backgroundColor: palette.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.15,
          shadowRadius: 40,
        }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            backgroundColor: palette.surface2,
            borderRadius: 2,
            alignSelf: 'center',
            marginVertical: 4,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.fg }}>{title}</Text>
          <IconButton name="close" size={14} onPress={onClose} accessibilityLabel="关闭" />
        </View>
        <View style={{ paddingHorizontal: 14 }}>{children}</View>
      </View>
    </Modal>
  );
}
