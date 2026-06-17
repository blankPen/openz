import { Pressable, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
};

export function Switch({ value, onChange, testID }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? palette.success : palette.surface2,
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <View
        testID={testID ? `${testID}-track` : undefined}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX: value ? 16 : 0 }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
        }}
      />
    </Pressable>
  );
}
