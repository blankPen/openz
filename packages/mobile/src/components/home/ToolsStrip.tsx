import { ScrollView, View } from 'react-native';
import { ToolCard } from '../common/ToolCard';
import { Icon } from '../common/Icon';
import { useTheme } from '../../hooks/useTheme';

export type Tool = {
  name: string;
  icon: 'search' | 'flash' | 'globe' | 'lawyer' | 'fire' | 'phd';
  iconBg: string;
  iconColor: string;
  isPrimary?: boolean;
  onPress?: () => void;
};

type Props = {
  tools?: Tool[];
};

const DEFAULT_TOOLS: Tool[] = [
  { name: '联网', icon: 'globe', iconBg: '#EAF1FF', iconColor: '#1A66FF', isPrimary: true },
  { name: 'Deep Research', icon: 'flash', iconBg: '#FFF3E0', iconColor: '#FF9500' },
  { name: '法律助手', icon: 'lawyer', iconBg: '#F5F5F7', iconColor: '#3C3C43' },
  { name: '创意助手', icon: 'fire', iconBg: '#FFF0F0', iconColor: '#FF3B30' },
  { name: '学术助手', icon: 'phd', iconBg: '#F0F4FF', iconColor: '#5856D6' },
];

export function ToolsStrip({ tools = DEFAULT_TOOLS }: Props) {
  const { palette, tokens } = useTheme();
  return (
    <View style={{ paddingVertical: tokens.space.sm }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: tokens.space.md, gap: tokens.space.md }}
      >
        {tools.map((tool, i) => (
          <ToolCard
            key={i}
            icon={<Icon name={tool.icon} size={24} color={tool.iconColor} />}
            iconBg={tool.iconBg}
            iconColor={tool.iconColor}
            name={tool.name}
            size={56}
            isPrimary={tool.isPrimary}
            onPress={tool.onPress}
          />
        ))}
      </ScrollView>
    </View>
  );
}
