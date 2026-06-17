import { View } from 'react-native';

export function DynamicIsland() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 11,
        left: '50%',
        marginLeft: -60,
        width: 120,
        height: 35,
        backgroundColor: '#000000',
        borderRadius: 20,
        zIndex: 200,
      }}
    />
  );
}
