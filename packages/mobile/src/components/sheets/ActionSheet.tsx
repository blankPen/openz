import { Modal, Pressable, View, Text, StyleSheet, Animated } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type ActionItem = {
  icon: string;
  label: string;
  danger?: boolean;
  onPress: () => void;
};

type Props = {
  visible: boolean;
  title?: string;
  items: ActionItem[];
  onClose: () => void;
  testID?: string;
};

export function ActionSheet({ visible, title, items, onClose, testID }: Props) {
  const { palette, tokens } = useTheme();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable
        onPress={onClose}
        style={StyleSheet.absoluteFillObject}
      >
        <View style={StyleSheet.absoluteFill}>
          <View
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: palette.bg,
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              paddingBottom: 40,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: -10 },
              shadowOpacity: 0.18,
              shadowRadius: 40,
              elevation: 20,
            }}
          >
            {/* Handle */}
            <View style={{ alignItems: 'center', paddingTop: 10, paddingBottom: 4 }}>
              <View
                style={{
                  width: 40,
                  height: 4,
                  backgroundColor: palette.surface2,
                  borderRadius: 2,
                }}
              />
            </View>

            {/* Title */}
            {title && (
              <Text
                style={{
                  color: palette.fg3,
                  fontSize: tokens.fontSize.sm,
                  fontWeight: '500',
                  textAlign: 'center',
                  marginTop: 10,
                  marginBottom: 8,
                }}
              >
                {title}
              </Text>
            )}

            {/* Actions */}
            {items.map((item, index) => (
              <Pressable
                key={index}
                onPress={() => {
                  item.onPress();
                  onClose();
                }}
                style={({ pressed }) => [
                  styles.actionItem,
                  pressed && { backgroundColor: palette.surface },
                ]}
                accessibilityRole="button"
                accessibilityLabel={item.label}
              >
                <View
                  style={{
                    width: 20,
                    height: 20,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Icon
                    name={item.icon as any}
                    size={18}
                    color={item.danger ? palette.danger : palette.fg}
                  />
                </View>
                <Text
                  style={{
                    fontSize: tokens.fontSize.lg,
                    color: item.danger ? palette.danger : palette.fg,
                    fontWeight: '400',
                  }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 20,
    minHeight: 48,
  },
});
