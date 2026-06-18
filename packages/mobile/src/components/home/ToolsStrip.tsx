import { ScrollView, View } from 'react-native';
import { ToolCard } from '../common/ToolCard';
import { Icon } from '../common/Icon';

export type Tool = {
  name: string;
  icon: 'search' | 'flash' | 'globe' | 'lawyer' | 'fire' | 'phd' | 'doc' | 'sparkles' | 'cube';
  iconBg: string;
  iconColor: string;
  isPrimary?: boolean;
  onPress?: () => void;
};

type Props = {
  tools?: Tool[];
};

const DEFAULT_TOOLS: Tool[] = [
  { name: '通用 Agent', icon: 'globe', iconBg: '#EAF1FF', iconColor: '#1A66FF', isPrimary: true },
  { name: '一键 PPT', icon: 'doc', iconBg: '#FFE8DB', iconColor: '#FF7A45' },
  { name: 'OpenZ Claw', icon: 'cube', iconBg: '#F0E7FE', iconColor: '#8B5CF6' },
  { name: '健康助手', icon: 'flash', iconBg: '#E1F4E9', iconColor: '#34A853' },
];

export function ToolsStrip({ tools = DEFAULT_TOOLS }: Props) {
  return (
    <View style={{ paddingTop: 12, paddingBottom: 6 }}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 6 }}
      >
        {tools.map((tool, i) => (
          <View key={i} style={i === 0 ? { marginLeft: 14 } : i === tools.length - 1 ? { marginRight: 14 } : undefined}>
            <ToolCard
              icon={<Icon name={tool.icon} size={24} color={tool.iconColor} />}
              iconBg={tool.iconBg}
              iconColor={tool.iconColor}
              name={tool.name}
              size={56}
              isPrimary={tool.isPrimary}
              onPress={tool.onPress}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
