import { View, Text, Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = {
  onCopy?: () => void;
  onLike?: () => void;
  onRegenerate?: () => void;
  onShare?: () => void;
  likeCount?: number;
};

type Action = {
  icon: 'copy' | 'like' | 'regenerate' | 'share';
  label: string;
  onPress?: () => void;
  isActive?: boolean;
};

export function AIActionsBar({ onCopy, onLike, onRegenerate, onShare, likeCount }: Props) {
  const { palette, tokens } = useTheme();

  const actions: Action[] = [
    { icon: 'copy', label: '复制', onPress: onCopy },
    { icon: 'like', label: likeCount !== undefined ? String(likeCount) : '点赞', onPress: onLike, isActive: likeCount !== undefined },
    { icon: 'regenerate', label: '重新生成', onPress: onRegenerate },
    { icon: 'share', label: '分享', onPress: onShare },
  ];

  return (
    <View style={{ flexDirection: 'row', gap: 14, paddingVertical: 4, paddingHorizontal: 8 }}>
      {actions.map((action) => (
        <Pressable
          key={action.icon}
          onPress={action.onPress}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              paddingHorizontal: 2,
              borderRadius: 6,
              opacity: pressed ? 0.55 : 1,
              backgroundColor: action.isActive ? palette.primarySoft : 'transparent',
            },
          ]}
        >
          <Icon
            name={action.icon}
            size={14}
            color={action.isActive ? palette.primary : palette.fg3}
          />
          {action.label && (
            <Text
              style={{
                fontSize: tokens.fontSize.sm,
                color: action.isActive ? palette.primary : palette.fg3,
              }}
            >
              {action.label}
            </Text>
          )}
        </Pressable>
      ))}
    </View>
  );
}
