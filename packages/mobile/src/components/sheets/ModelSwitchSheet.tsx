import { Text, ScrollView } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { BottomSheet } from './BottomSheet';
import { ModelOptionRow } from './ModelOption';
import type { ModelOption, ModeOption, PersonaOption } from '../../types/chat';

type Props = {
  visible: boolean;
  onClose: () => void;
  testID?: string;
};

// ── Demo data —— 与设计稿 model-switch.html 对齐 ──────────────────────────

const MODELS: ModelOption[] = [
  {
    id: 'openz-z1',
    name: 'OpenZ Z1',
    description: '长文档 · 多步推理 · 工具调用',
    iconColor: '#1A66FF',
    iconBg: '#EAF1FF',
    tag: '最新',
    tagColor: '#EAF1FF',
  },
  {
    id: 'openz-z09',
    name: 'OpenZ Z0.9',
    description: '通用对话 · 速度更快',
    iconColor: '#8B5CF6',
    iconBg: '#F0E7FE',
    tag: '稳定',
    tagColor: '#FFE8DB',
  },
  {
    id: 'openz-z2',
    name: 'OpenZ Z2 Preview',
    description: '实验模型 · 需要 Pro 权限',
    iconColor: '#34A853',
    iconBg: '#E1F4E9',
    isPro: true,
  },
];

const MODES: ModeOption[] = [
  {
    id: 'deep',
    name: '深度思考',
    description: '显示思考过程 · 适合复杂问题',
    iconColor: '#FF9500',
    iconBg: '#FFF7E5',
  },
  {
    id: 'fast',
    name: '快速',
    description: '直接回答 · 响应更快',
    iconColor: '#1A66FF',
    iconBg: '#EAF1FF',
  },
  {
    id: 'web',
    name: '联网',
    description: '实时检索 · 引用网页来源',
    iconColor: '#34A853',
    iconBg: '#E1F4E9',
  },
  {
    id: 'pro',
    name: '专业领域',
    description: '调用垂直 Agent · 法律/医疗/代码',
    iconColor: '#FF7A45',
    iconBg: '#FFE8DB',
  },
];

const PERSONAS: PersonaOption[] = [
  {
    id: 'default',
    name: 'OpenZ 默认',
    description: '理性 · 友好 · 信息密度高',
    avatar: 'K',
    avatarBg: '#1A66FF',
    avatarColor: '#FFFFFF',
  },
  {
    id: 'fire',
    name: '小火 · 创意',
    description: '活泼 · 适合头脑风暴',
    avatar: '小',
    avatarBg: '#FFE8DB',
    avatarColor: '#FF7A45',
  },
  {
    id: 'phd',
    name: '博士 · 严谨',
    description: '学术 · 引用规范 · 长文写作',
    avatar: '博',
    avatarBg: '#F0E7FE',
    avatarColor: '#8B5CF6',
  },
];

// ── Section label ──────────────────────────────────────────────────────────

function SectionLabel({ title }: { title: string }) {
  const { palette, tokens } = useTheme();
  return (
    <Text
      style={{
        color: palette.fg3,
        fontSize: tokens.fontSize.xs,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        paddingHorizontal: 4,
        marginTop: 14,
        marginBottom: 8,
      }}
    >
      {title}
    </Text>
  );
}

// ── ModelSwitchSheet ────────────────────────────────────────────────────────

export function ModelSwitchSheet({ visible, onClose, testID }: Props) {
  const { palette, tokens } = useTheme();

  return (
    <BottomSheet visible={visible} title="切换模型" onClose={onClose} testID={testID}>
      <ScrollView
        style={{ maxHeight: 520 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 12 }}
      >
        {/* Subtitle */}
        <Text
          style={{
            color: palette.fg3,
            fontSize: tokens.fontSize.sm,
            marginBottom: 4,
            paddingHorizontal: 4,
          }}
        >
          选择后立即生效，下一条消息生效
        </Text>

        {/* 基础模型 */}
        <SectionLabel title="基础模型" />
        {MODELS.map((m, i) => (
          <ModelOptionRow
            key={m.id}
            model={m}
            isSelected={i === 0}
            tagVariant={i === 0 ? 'pro' : m.isPro ? 'pro' : 'soft'}
          />
        ))}

        {/* 推理模式 */}
        <SectionLabel title="推理模式" />
        {MODES.map((m, i) => (
          <ModelOptionRow key={m.id} model={m} isSelected={i === 0} />
        ))}

        {/* Agent 人格 */}
        <SectionLabel title="Agent 人格" />
        {PERSONAS.map((p, i) => (
          <ModelOptionRow
            key={p.id}
            model={{
              id: p.id,
              name: p.name,
              description: p.description,
              iconColor: p.avatarColor,
              iconBg: p.avatarBg,
            }}
            avatarLabel={p.avatar}
            isSelected={i === 0}
          />
        ))}
      </ScrollView>
    </BottomSheet>
  );
}
