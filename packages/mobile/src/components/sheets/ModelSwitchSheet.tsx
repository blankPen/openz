import { View, Text, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { SheetHeader } from './SheetHeader';
import { ModelOptionRow } from './ModelOption';
import type { ModelOption, ModeOption, PersonaOption } from '../../types/chat';

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

// ── Demo data ─────────────────────────────────────────────────────────────────

const MODELS: ModelOption[] = [
  {
    id: 'openz-z1',
    name: 'OpenZ Z1',
    description: '最新一代旗舰模型，推理能力最强',
    iconColor: '#1A66FF',
    iconBg: '#E6F0FF',
    tag: '最新',
    tagColor: '#E6F7FF',
  },
  {
    id: 'openz-z09',
    name: 'OpenZ Z0.9',
    description: '稳定版模型，表现均衡',
    iconColor: '#34C759',
    iconBg: '#E6F7E6',
    tag: '稳定',
    tagColor: '#E6F7E6',
  },
  {
    id: 'openz-z2',
    name: 'OpenZ Z2 Preview',
    description: '预览版本，探索新一代能力',
    iconColor: '#FF9500',
    iconBg: '#FFF3E0',
    isPro: true,
  },
];

const MODES: ModeOption[] = [
  {
    id: 'deep',
    name: '深度思考',
    description: '更长的推理链，解决复杂问题',
    iconColor: '#5856D6',
    iconBg: '#F0F0FF',
  },
  {
    id: 'fast',
    name: '快速',
    description: '低延迟，快速响应',
    iconColor: '#34C759',
    iconBg: '#E6F7E6',
  },
  {
    id: 'web',
    name: '联网',
    description: '实时网络搜索，信息最新',
    iconColor: '#007AFF',
    iconBg: '#E6F0FF',
  },
  {
    id: 'pro',
    name: '专业领域',
    description: '法律、金融、医疗等专业领域',
    iconColor: '#FF9500',
    iconBg: '#FFF3E0',
  },
];

const PERSONAS: PersonaOption[] = [
  {
    id: 'default',
    name: 'OpenZ默认',
    description: '中立、专业的助手风格',
    avatar: 'K',
    avatarBg: '#E6F0FF',
    avatarColor: '#1A66FF',
  },
  {
    id: 'fire',
    name: '小火',
    description: '活泼友好，有趣有温度',
    avatar: '火',
    avatarBg: '#FFF0F0',
    avatarColor: '#FF6B6B',
  },
  {
    id: 'phd',
    name: '博士',
    description: '严谨学术，深入浅出',
    avatar: '博',
    avatarBg: '#F0F0FF',
    avatarColor: '#5856D6',
  },
];

// ── Section ──────────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { palette, tokens } = useTheme();
  return (
    <View style={{ marginBottom: 20 }}>
      <Text style={{ color: palette.fg3, fontSize: tokens.fontSize.xs, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8, marginLeft: 4 }}>
        {title}
      </Text>
      <View style={{ backgroundColor: palette.surface, borderRadius: 12, overflow: 'hidden' }}>
        {children}
      </View>
    </View>
  );
}

// ── ModelSwitchSheet ──────────────────────────────────────────────────────────

export function ModelSwitchSheet({ visible, onClose, testID }: Props) {
  const { palette } = useTheme();

  return (
    <BottomSheet visible={visible} title="切换模型" onClose={onClose} testID={testID}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* 基础模型 */}
        <Section title="基础模型">
          {MODELS.map((m) => (
            <ModelOptionRow key={m.id} model={m} isSelected={m.id === 'openz-z1'} />
          ))}
        </Section>

        {/* 推理模式 */}
        <Section title="推理模式">
          {MODES.map((m) => (
            <ModelOptionRow
              key={m.id}
              model={{ ...m, name: m.name, description: m.description, iconColor: m.iconColor, iconBg: m.iconBg }}
              isSelected={m.id === 'deep'}
            />
          ))}
        </Section>

        {/* Agent人格 */}
        <Section title="Agent人格">
          {PERSONAS.map((p) => (
            <ModelOptionRow
              key={p.id}
              model={{
                id: p.id,
                name: p.name,
                description: p.description,
                iconColor: p.avatarColor,
                iconBg: p.avatarBg,
              }}
              isSelected={p.id === 'default'}
            />
          ))}
        </Section>
      </ScrollView>
    </BottomSheet>
  );
}
