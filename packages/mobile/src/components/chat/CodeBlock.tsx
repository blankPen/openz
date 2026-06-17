import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';
import { IconButton } from '../topbar/IconButton';

type Props = {
  code: string;
  language?: string;
  onCopy?: (code: string) => void;
};

export function CodeBlock({ code, language, onCopy }: Props) {
  const { palette, tokens } = useTheme();
  return (
    <View
      testID="code-block"
      style={{
        backgroundColor: '#1C1C1E',
        borderRadius: 8,
        marginVertical: 8,
        overflow: 'hidden',
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderBottomWidth: 1,
          borderBottomColor: '#3A3A3C',
        }}
      >
        <Text style={{ color: '#8E8E93', fontSize: tokens.fontSize.xs, fontFamily: 'Menlo' }}>
          {language ?? 'code'}
        </Text>
        <Pressable
          onPress={() => onCopy?.(code)}
          style={({ pressed }) => [{ opacity: pressed ? 0.55 : 1 }]}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingHorizontal: 6,
              paddingVertical: 2,
              borderWidth: 1,
              borderColor: '#3A3A3C',
              borderRadius: 4,
            }}
          >
            <Icon name="copy" size={12} color="#8E8E93" />
            <Text style={{ color: '#8E8E93', fontSize: 10 }}>复制</Text>
          </View>
        </Pressable>
      </View>
      <Text
        style={{
          color: '#E5E5EA',
          fontSize: tokens.fontSize.sm,
          fontFamily: 'Menlo',
          lineHeight: tokens.fontSize.sm * 1.5,
          padding: 12,
          overflow: 'hidden',
        }}
        numberOfLines={20}
      >
        {code}
      </Text>
    </View>
  );
}
