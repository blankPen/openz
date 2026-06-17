import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../topbar/IconButton';
import type { IconName } from '../common/Icon';

type Props = {
  title: string;
  leftIcon?: IconName;
  rightIcon?: IconName;
  onLeftPress?: () => void;
  onRightPress?: () => void;
  onClose?: () => void;
  testID?: string;
};

export function SheetHeader({ title, leftIcon, rightIcon, onLeftPress, onRightPress, onClose, testID }: Props) {
  const { palette } = useTheme();

  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingTop: 8,
        paddingBottom: 12,
      }}
    >
      <View style={{ flex: 1 }}>
        {leftIcon && (
          <IconButton name={leftIcon} size={14} onPress={onLeftPress} accessibilityLabel={title + '-left'} />
        )}
      </View>
      <Text style={[styles.title, { color: palette.fg }]}>{title}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {rightIcon ? (
          <IconButton name={rightIcon} size={14} onPress={onRightPress} accessibilityLabel={title + '-right'} />
        ) : onClose ? (
          <IconButton name="close" size={14} onPress={onClose} accessibilityLabel="关闭" />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    flex: 2,
  },
});
