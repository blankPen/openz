# Mobile Phase 2: UI 1:1 复刻设计稿（5 屏）

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 5 屏设计稿（首页空对话态、对话进行态、模型切换面板、侧边设置抽屉、附件面板）以 1:1 精度实现为 React Native 组件，完成 mobile app 阶段 2 UI 层。

**Architecture:** 自底向上分层：Layer 0（基础符号/图标/类型）→ Layer 1（原子 UI 组件）→ Layer 2（复合业务组件）→ Layer 3（页面组合）→ Layer 4（全局状态）。每层只依赖其下方层级，并行 agent 按层调度，层内无依赖可完全并行。

**Tech Stack:** React Native + Expo SDK 52, react-native-svg, zustand 5, react-native-mmkv 3, jest + @testing-library/react-native

---

## Global Constraints

- **Expo SDK:** 52 / **React Native:** 0.76.x / **zustand:** 5
- **Theme system:** 所有颜色必须来自 `useTheme().palette`，不得硬编码颜色值
- **字体:** `useTheme().tokens.fontSize` + `fontWeight`，不得硬编码字号
- **圆角:** `useTheme().tokens.radius` (sm/md/lg/xl)
- **测试覆盖率:** 每个新组件/模块必须有 jest 单元测试，测试文件置于 `__tests__/` 与源文件平行的目录结构
- **i18n:** 所有用户可见文案必须通过 `src/i18n.ts` 的 `t()` 获取，不得硬编码中文字符串
- **无状态组件优先:** UI 组件尽量设计为纯展示组件，状态由父组件通过 props 传入

---

## 依赖关系图（层内无跨层依赖）

```
Layer 0: 类型 + 图标扩展
├── T0: 类型定义 (types.ts)
└── T1: 新增 Icon

Layer 1: 原子 UI 组件（互相无依赖，可完全并行）
├── C1: Avatar
├── C2: Pill (模型选择器)
├── C3: ToolCard (工具入口卡)
├── C4: UserBubble (用户消息气泡)
├── C5: AIBubble (AI 消息气泡，Markdown渲染)
├── C6: CodeBlock (代码块，含复制按钮)
├── C7: ThinkingCard (可折叠思考卡)
├── C8: ToolCallCard (工具调用结果卡)
├── C9: AIActionsBar (AI 操作栏)
├── C10: StreamingIndicator (流式打字指示器)
├── C11: MessageRow (消息行，含时间戳)
└── C12: SourceItem (搜索来源项)

Layer 2: 复合业务组件
├── B1: ToolsStrip (工具快捷入口横滚栏)
├── B2: WelcomeSection (首页欢迎区)
├── B3: InputBar (输入框 + Mic/附件/发送按钮集合)
├── B4: SheetHeader (BottomSheet 通用头部)
├── B5: ModelOption (模型选项项)
└── B6: FileCard (最近文件卡片)

Layer 3: 全局状态 (Store)
├── S1: chatStore (消息列表、思考状态、输入状态)
└── S2: sheetStore (各 BottomSheet 的 visible 状态)

Layer 4: 页面
├── P1: 首页 (app/index.tsx → HomeScreen)
├── P2: 对话页 (app/chat.tsx → ChatScreen)
└── P3: 抽屉/面板 (Drawer + ModelSwitchSheet + AttachmentSheet)

Layer 5: 集成
├── I1: app/_layout.tsx 接入 chatStore + sheetStore
└── I2: 路由跳转 (Drawer open/close → /chat)
```

---

## Layer 0: 类型 + 图标扩展

### T0: 新增类型定义

**Files:**
- Create: `packages/mobile/src/types/chat.ts`
- Modify: `packages/mobile/src/stores/settingsStore.ts` (添加 model/mode/persona 枚举)

**Interfaces:**
- Produces: `MessageRole`, `MessageType`, `ChatMessage`, `ThinkingStep`, `SourceItem`, `ToolCall`, `ModelOption`, `PersonaOption`, `ModeOption`, `SheetType`

```typescript
// packages/mobile/src/types/chat.ts

export type MessageRole = 'user' | 'ai';
export type MessageType = 'text' | 'thinking' | 'tool-call' | 'tool-result';

export interface ThinkingStep {
  step: number;
  content: string;
}

export interface SourceItem {
  index: number;
  title: string;
  url: string;
}

export interface ToolCall {
  name: string;
  description: string;
  sources?: SourceItem[];
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  type: MessageType;
  content: string;
  thinkingSteps?: ThinkingStep[];
  toolCall?: ToolCall;
  timestamp: string; // "HH:mm" format
  isStreaming?: boolean;
}

export interface ModelOption {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconBg: string;
  tag?: string;       // e.g. "最新" | "稳定"
  tagColor?: string;
  isPro?: boolean;
}

export interface ModeOption {
  id: string;
  name: string;
  description: string;
  iconColor: string;
  iconBg: string;
}

export interface PersonaOption {
  id: string;
  name: string;
  description: string;
  avatar: string; // single char
  avatarBg: string;
  avatarColor: string;
}
```

- [ ] **Step 1: 创建 types/chat.ts，写入上述类型定义**
- [ ] **Step 2: 添加 jest 测试 `__tests__/types/chat.test.ts`，验证类型构造函正确性**

```typescript
// __tests__/types/chat.test.ts
import { describe, it, expect } from '@jest/globals';

describe('chat types', () => {
  it('should construct ChatMessage correctly', () => {
    const msg: import('../src/types/chat').ChatMessage = {
      id: '1',
      role: 'user',
      type: 'text',
      content: 'hello',
      timestamp: '10:00',
    };
    expect(msg.role).toBe('user');
  });

  it('should allow optional thinkingSteps', () => {
    const msg: import('../src/types/chat').ChatMessage = {
      id: '2',
      role: 'ai',
      type: 'thinking',
      content: '',
      thinkingSteps: [{ step: 1, content: 'thinking...' }],
      timestamp: '10:01',
    };
    expect(msg.thinkingSteps?.length).toBe(1);
  });
});
```

- [ ] **Step 3: git add + git commit -m "feat(mobile): add chat types for phase 2"**

---

### T1: 扩展 Icon 组件（新增缺失图标）

**Files:**
- Modify: `packages/mobile/src/components/common/Icon.tsx` (添加新图标定义)

**Interfaces:**
- Consumes: `IconName` type 扩展
- Produces: 新增 `IconName` 枚举值

需要新增的图标（按设计稿使用）：

| IconName | 用途 | SVG 形状 |
|----------|------|---------|
| `menu` | 左侧菜单按钮 | 三横线 |
| `model` | 模型切换 | 圆角方形内有层级线 |
| `phone` | 实时通话 | 电话听筒 |
| `copy` | 复制按钮 | 两个重叠矩形 |
| `like` | 点赞 | 心形 |
| `regenerate` | 重新生成 | 循环箭头 |
| `share` | 分享 | 箭头分支图标 |
| `flash` | 深度思考模式 | 闪电 |
| `cube` | 专业领域模式 | 立方体 |
| `globe` | 联网模式 | 地球仪 |
| `lawyer` | 法律垂直 | 天平 |
| `fire` | 小火（创意人格）| 火焰 |
| `phd` | 博士（严谨人格）| 博士帽 |
| `chevUp` | 折叠展开箭头 | 向上 chevron |
| `search` | 联网搜索 | 放大镜 |
| `file` | 文件图标 | 文件形状 |
| `star` | 订阅 Pro | 星星 |
| `chart` | 用量统计 | 柱状图 |
| `help` | 帮助反馈 | 问号圆圈 |
| `info` | 关于 | i 圆圈 |

- [ ] **Step 1: 在 `Icon.tsx` 的 `iconPaths` 对象中新增上述 20 个图标的 SVG Path 数据（参考 design spec 中的 stroke 形状）**
- [ ] **Step 2: 在 `IconName` type 联合类型中添加上述 20 个新名称**
- [ ] **Step 3: 写测试 `__tests__/components/common/Icon.new-icons.test.tsx`，渲染每个新图标确认不报错**

```typescript
// __tests__/components/common/Icon.new-icons.test.tsx
import { render } from '@testing-library/react-native';
import { Icon } from '../../../src/components/common/Icon';

describe('new icons', () => {
  const newIcons = ['menu', 'model', 'phone', 'copy', 'like', 'regenerate',
    'share', 'flash', 'cube', 'globe', 'lawyer', 'fire', 'phd',
    'chevUp', 'search', 'file', 'star', 'chart', 'help', 'info'] as const;

  newIcons.forEach(name => {
    it(`renders ${name} without error`, () => {
      const { getByTestId } = render(<Icon name={name} color="#000" testID={`icon-${name}`} />);
      // Just verify no throw
      expect(getByTestId(`icon-${name}`)).toBeTruthy();
    });
  });
});
```

- [ ] **Step 4: git add + git commit -m "feat(mobile): add 20 missing icons for phase 2"**

---

## Layer 1: 原子 UI 组件

> 所有 Layer 1 组件互相无依赖，可完全并行执行。

### C1: Avatar

**Files:**
- Create: `packages/mobile/src/components/common/Avatar.tsx`
- Test: `__tests__/components/common/Avatar.test.tsx`

**Interfaces:**
- Produces: `<Avatar label color size />` 组件

```typescript
// Props
type Props = {
  label: string;      // single char, e.g. "A" or "Z"
  size?: number;      // default 64
  color?: string;     // default palette.primary
  style?: StyleProp<ViewStyle>;
};
```

实现：圆形背景（渐变或纯色），内部显示 label 文字（白色，fontWeight: '700'），使用 LinearGradient 或纯色 View 实现。

- [ ] **Step 1: 写测试**
- [ ] **Step 2: 实现组件**
- [ ] **Step 3: 测试通过**
- [ ] **Step 4: git commit -m "feat(mobile): add Avatar component"**

---

### C2: Pill（模型选择器）

**Files:**
- Create: `packages/mobile/src/components/common/Pill.tsx`
- Test: `__tests__/components/common/Pill.test.tsx`

**Interfaces:**
- Produces: `<Pill name meta onPress />` 组件

```typescript
// Props
type Props = {
  name: string;         // e.g. "OpenZ"
  meta?: string;        // e.g. "Z1 思考"
  onPress?: () => void;
  accessibilityLabel?: string;
};
```

样式：透明背景，左侧 name（semibold, fg 色）+ 右侧 meta（medium, fg-3 色）+ chevDown 图标。点击时 opacity 0.55。

- [ ] **Step 1-4: 测试→实现→通过→commit**（同 C1 流程）
- [ ] **Commit: "feat(mobile): add Pill model selector component"**

---

### C3: ToolCard（工具入口卡）

**Files:**
- Create: `packages/mobile/src/components/common/ToolCard.tsx`
- Test: `__tests__/components/common/ToolCard.test.tsx`

**Interfaces:**
- Produces: `<ToolCard icon iconBg iconColor name size onPress />` 组件

```typescript
// Props
type Props = {
  icon: React.ReactNode;     // Icon component
  iconBg: string;
  iconColor: string;
  name: string;
  size?: number;             // default 56
  isPrimary?: boolean;       // 是否为主要工具（放大 1.1x + 阴影）
  onPress?: () => void;
};
```

外观：76x? 纵向布局：icon (56x56, 圆角16) + name (12px, fg-2 色)。主工具 icon 放大 1.1x 并带 boxShadow。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add ToolCard agent entry component"**

---

### C4: UserBubble（用户消息气泡）

**Files:**
- Create: `packages/mobile/src/components/chat/UserBubble.tsx`
- Test: `__tests__/components/chat/UserBubble.test.tsx`

**Interfaces:**
- Produces: `<UserBubble content timestamp />` 组件

```typescript
type Props = {
  content: string;
  timestamp: string;
};
```

样式：`maxWidth: 78%`，`backgroundColor: palette.primary`，白色文字，borderRadius: 18px（上方两侧），右对齐。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add UserBubble component"**

---

### C5: AIBubble（AI 消息气泡）

**Files:**
- Create: `packages/mobile/src/components/chat/AIBubble.tsx`
- Test: `__tests__/components/chat/AIBubble.test.tsx`

**Interfaces:**
- Produces: `<AIBubble content timestamp />` 组件

```typescript
type Props = {
  content: string;     // 支持 Markdown 文本
  timestamp: string;
};
```

样式：`maxWidth: 88%`，`backgroundColor: palette.surface`，fg 色文字，borderRadius: 4px（左上两侧）/ 18px（其余角）。支持解析 `**bold**`、`` `code` ``、代码块。**注意：暂不接入真实 Markdown 解析库，先用正则做最小化解析。**

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add AIBubble with minimal Markdown support"**

---

### C6: CodeBlock（代码块）

**Files:**
- Create: `packages/mobile/src/components/chat/CodeBlock.tsx`
- Test: `__tests__/components/chat/CodeBlock.test.tsx`

**Interfaces:**
- Consumes: `CopyButton` 组件（由 C9 提供）
- Produces: `<CodeBlock code language onCopy />` 组件

```typescript
type Props = {
  code: string;
  language?: string;
  onCopy?: (code: string) => void;
};
```

样式：深色背景 `#1C1C1E`，圆角 8px，顶部有 language 标签 + 复制按钮（IconButton）。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add CodeBlock with copy button"**

---

### C7: ThinkingCard（可折叠思考卡）

**Files:**
- Create: `packages/mobile/src/components/chat/ThinkingCard.tsx`
- Test: `__tests__/components/chat/ThinkingCard.test.tsx`

**Interfaces:**
- Produces: `<ThinkingCard elapsedSeconds stepCount steps onToggle isExpanded />` 组件

```typescript
type Props = {
  elapsedSeconds: number;       // e.g. 8
  stepCount: number;           // e.g. 3
  steps: ThinkingStep[];        // from types/chat.ts
  onToggle?: () => void;
  isExpanded?: boolean;        // default false
};
```

外观：浅灰 surface 背景，12px 圆角，左侧闪电图标 + "已思考 N 秒 · 规划 N 个章节" 文字 + chevDown 箭头。可展开显示步骤列表（1、2、3... 编号圆圈）。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add ThinkingCard collapsible component"**

---

### C8: ToolCallCard（工具调用结果卡）

**Files:**
- Create: `packages/mobile/src/components/chat/ToolCallCard.tsx`
- Test: `__tests__/components/chat/ToolCallCard.test.tsx`

**Interfaces:**
- Produces: `<ToolCallCard toolCall onToggle isExpanded />` 组件

```typescript
type Props = {
  toolCall: ToolCall;       // from types/chat.ts
  onToggle?: () => void;
  isExpanded?: boolean;
};
```

外观：带边框卡片，左上角彩色图标 + "工具名 · N 个来源" + chevDown。可展开显示 SourceItem 列表。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add ToolCallCard component"**

---

### C9: AIActionsBar（AI 操作栏）

**Files:**
- Create: `packages/mobile/src/components/chat/AIActionsBar.tsx`
- Test: `__tests__/components/chat/AIActionsBar.test.tsx`

**Interfaces:**
- Produces: `<AIActionsBar onCopy onLike onRegenerate onShare likeCount />` 组件

```typescript
type Props = {
  onCopy?: () => void;
  onLike?: () => void;
  onRegenerate?: () => void;
  onShare?: () => void;
  likeCount?: number;      // undefined 时不显示数字
};
```

外观：横向 4 个 action 按钮（复制/点赞/重新生成/分享），图标 + 文字，间距 14px。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add AIActionsBar component"**

---

### C10: StreamingIndicator（流式打字指示器）

**Files:**
- Create: `packages/mobile/src/components/chat/StreamingIndicator.tsx`
- Test: `__tests__/components/chat/StreamingIndicator.test.tsx`

**Interfaces:**
- Produces: `<StreamingIndicator />` 组件

外观：显示 "OpenZ 正在回复…" + 左侧旋转 spinner。spinner 用 View + border 动画实现（border-top-color: primary，其余 transparent，animation: rotate 360deg 0.8s linear infinite）。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add StreamingIndicator component"**

---

### C11: MessageRow（消息行）

**Files:**
- Create: `packages/mobile/src/components/chat/MessageRow.tsx`
- Test: `__tests__/components/chat/MessageRow.test.tsx`

**Interfaces:**
- Consumes: `UserBubble`, `AIBubble`, `ThinkingCard`, `ToolCallCard`, `AIActionsBar`
- Produces: `<MessageRow message onCopy onLike onRegenerate onShare />` 组件

```typescript
type Props = {
  message: ChatMessage;
  onCopy?: () => void;
  onLike?: () => void;
  onRegenerate?: () => void;
  onShare?: () => void;
};
```

根据 `message.role`（user/ai）决定对齐方式（user 靠右，ai 靠左）。AI 消息包含 `ThinkingCard`（如果 type=thinking）+ `AIBubble` + `AIActionsBar`。用户消息包含 `UserBubble` + 时间戳。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add MessageRow component"**

---

### C12: SourceItem（搜索来源项）

**Files:**
- Create: `packages/mobile/src/components/chat/SourceItem.tsx`
- Test: `__tests__/components/chat/SourceItem.test.tsx`

**Interfaces:**
- Produces: `<SourceItem index title url />` 组件

```typescript
type Props = {
  index: number;
  title: string;
  url: string;
};
```

外观：左侧数字圆圈（primarySoft 背景 + primary 文字）+ title（fg 色）+ url 域名（fg-3 色）。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add SourceItem component"**

---

## Layer 2: 复合业务组件

> Layer 2 依赖 Layer 1 的组件，并行执行但需等 Layer 1 完成。

### B1: ToolsStrip（工具快捷入口栏）

**Files:**
- Create: `packages/mobile/src/components/home/ToolsStrip.tsx`
- Test: `__tests__/components/home/ToolsStrip.test.tsx`

**Interfaces:**
- Consumes: `ToolCard` (C3)
- Produces: `<ToolsStrip onToolPress />`

```typescript
type Props = {
  onToolPress?: (toolId: string) => void;
};
```

外观：横向滚动，4 个 ToolCard（通用Agent/一键PPT/OpenZ Claw/健康助手），首尾各有 14px margin。scrollEventThrottle 处理横向滚动。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add ToolsStrip horizontal scroll component"**

---

### B2: WelcomeSection（首页欢迎区）

**Files:**
- Create: `packages/mobile/src/components/home/WelcomeSection.tsx`
- Test: `__tests__/components/home/WelcomeSection.test.tsx`

**Interfaces:**
- Consumes: `Avatar` (C1)
- Produces: `<WelcomeSection userName />`

```typescript
type Props = {
  userName?: string;    // default "Alex"
};
```

外观：居中，Avatar（64px 渐变蓝）+ 问候语（"嗨 {userName}，今天要和 OpenZ 一起做点什么？"），accent 色高亮关键词。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add WelcomeSection home component"**

---

### B3: InputBar（输入框完整组合）

**Files:**
- Create: `packages/mobile/src/components/input/InputBar.tsx`
- Test: `__tests__/components/input/InputBar.test.tsx`

**Interfaces:**
- Consumes: `TextField`, `MicButton`, `AttachmentButton`, `SendButton`（已有）
- Produces: `<InputBar onSend onMic onAttach />`

```typescript
type Props = {
  onSend?: (text: string) => void;
  onMic?: () => void;
  onAttach?: () => void;
  placeholder?: string;
};
```

外观：input-box 容器（F2F2F2 背景，16px 圆角），内部 TextField + input-actions 行（左侧 Mic + 右侧附件/发送按钮集合）。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add InputBar composite component"**

---

### B4: SheetHeader（BottomSheet 通用头部）

**Files:**
- Create: `packages/mobile/src/components/sheets/SheetHeader.tsx`
- Test: `__tests__/components/sheets/SheetHeader.test.tsx`

**Interfaces:**
- Consumes: `IconButton`（已有）
- Produces: `<SheetHeader title subtitle onClose />`

```typescript
type Props = {
  title: string;
  subtitle?: string;
  onClose?: () => void;
};
```

外观：左侧 title（17px bold）+ subtitle（12px, fg-3）+ 右侧关闭按钮。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add SheetHeader component"**

---

### B5: ModelOption（模型选项项）

**Files:**
- Create: `packages/mobile/src/components/sheets/ModelOption.tsx`
- Test: `__tests__/components/sheets/ModelOption.test.tsx`

**Interfaces:**
- Consumes: `Icon` (extended)
- Produces: `<ModelOption option isActive onPress />`

```typescript
type Props = {
  option: ModelOption | ModeOption | PersonaOption;
  isActive?: boolean;
  onPress?: () => void;
};
```

外观：左侧彩色图标（36px 圆角10）+ name + tag 标签 + description，右侧 checkmark。active 状态：背景 primarySoft + 边框 primary。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add ModelOption sheet item component"**

---

### B6: FileCard（最近文件卡片）

**Files:**
- Create: `packages/mobile/src/components/sheets/FileCard.tsx`
- Test: `__tests__/components/sheets/FileCard.test.tsx`

**Interfaces:**
- Produces: `<FileCard name type size lastModified onPress />`

```typescript
type Props = {
  name: string;
  type: 'image' | 'pdf' | 'xls' | 'doc' | string;
  size: string;          // e.g. "2.4 MB"
  lastModified: string;  // e.g. "昨天"
  onPress?: () => void;
};
```

外观：左侧文件类型缩略图（彩色背景 + 类型字母 IMG/PDF/XLS）+ 文件信息 + 右侧时间。

- [ ] **Step 1-4: 测试→实现→通过→commit**
- [ ] **Commit: "feat(mobile): add FileCard recent file component"**

---

## Layer 3: 全局状态

### S1: chatStore

**Files:**
- Modify: `packages/mobile/src/stores/settingsStore.ts` (追加 chatStore)
- Create: `packages/mobile/src/stores/chatStore.ts`
- Test: `__tests__/stores/chatStore.test.ts`

**Interfaces:**
- Produces: `useChatStore()` hook

```typescript
type ChatState = {
  messages: ChatMessage[];
  isStreaming: boolean;
  inputText: string;
};

type ChatActions = {
  addMessage: (msg: ChatMessage) => void;
  setStreaming: (v: boolean) => void;
  setInputText: (t: string) => void;
  clearMessages: () => void;
};

type ChatStore = ChatState & ChatActions;
```

**注意：Phase 2 只做静态 UI，不接入 Socket.IO。chatStore 用于组件间的 UI 状态管理（如消息渲染、输入框内容）。**

- [ ] **Step 1: 写测试验证 store 的 CRUD 操作**
- [ ] **Step 2: 实现 chatStore**
- [ ] **Step 3: 测试通过**
- [ ] **Step 4: git commit -m "feat(mobile): add chatStore for message state management"**

---

### S2: sheetStore

**Files:**
- Create: `packages/mobile/src/stores/sheetStore.ts`
- Test: `__tests__/stores/sheetStore.test.ts`

**Interfaces:**
- Produces: `useSheetStore()` hook

```typescript
type SheetState = {
  modelSheetVisible: boolean;
  attachmentSheetVisible: boolean;
};

type SheetActions = {
  openModelSheet: () => void;
  closeModelSheet: () => void;
  openAttachmentSheet: () => void;
  closeAttachmentSheet: () => void;
};

type SheetStore = SheetState & SheetActions;
```

- [ ] **Step 1: 写测试**
- [ ] **Step 2: 实现 sheetStore**
- [ ] **Step 3: 测试通过**
- [ ] **Step 4: git commit -m "feat(mobile): add sheetStore for bottom sheet state"**

---

## Layer 4: 页面

### P1: HomeScreen（首页）

**Files:**
- Create: `packages/mobile/src/screens/HomeScreen.tsx`
- Test: `__tests__/screens/HomeScreen.test.tsx`
- Modify: `packages/mobile/app/index.tsx` (使用 HomeScreen 替代当前 Redirect)

**Interfaces:**
- Consumes: `WelcomeSection` (B2), `ToolsStrip` (B1), `InputBar` (B3), `DynamicIsland`, `StatusBar`, `HomeIndicator`
- Produces: `HomeScreen` 组件

外观：按设计稿 home.html 的 4 层结构：Topbar（汉堡菜单 + Pill + 语音/通话/新建按钮）+ WelcomeSection + spacer + ToolsStrip + InputBar + 水印 + HomeIndicator。

- [ ] **Step 1: 写测试（快照测试即可，验证组件能渲染）**
- [ ] **Step 2: 实现 HomeScreen**
- [ ] **Step 3: 修改 app/index.tsx 为 `<HomeScreen />`**
- [ ] **Step 4: git commit -m "feat(mobile): implement HomeScreen with all home page components"**

---

### P2: ChatScreen（对话页）

**Files:**
- Create: `packages/mobile/src/screens/ChatScreen.tsx`
- Test: `__tests__/screens/ChatScreen.test.tsx`
- Modify: `packages/mobile/app/chat.tsx` (使用 ChatScreen 替代当前占位符)

**Interfaces:**
- Consumes: `MessageRow` (C11), `InputBar` (B3), `ThinkingCard` (C7), `ToolCallCard` (C8), `StreamingIndicator` (C10), `useChatStore` (S1), `useSheetStore` (S2)
- Produces: `ChatScreen` 组件

外观：顶部 Topbar（与首页相同）+ 消息列表（ScrollView + 多个 MessageRow）+ InputBar + HomeIndicator。

消息列表使用 `useChatStore().messages` 渲染，InputBar 的 onSend 调用 `useChatStore().addMessage`（Phase 2 静态演示用）。

- [ ] **Step 1: 写测试（验证消息列表渲染和 InputBar 交互）**
- [ ] **Step 2: 实现 ChatScreen**
- [ ] **Step 3: git commit -m "feat(mobile): implement ChatScreen with message flow"**

---

### P3: Drawer + ModelSwitchSheet + AttachmentSheet

**Files:**
- Create: `packages/mobile/src/components/drawer/SettingsDrawer.tsx`
- Test: `__tests__/components/drawer/SettingsDrawer.test.tsx`
- Create: `packages/mobile/src/components/sheets/ModelSwitchSheet.tsx`
- Test: `__tests__/components/sheets/ModelSwitchSheet.test.tsx`
- Create: `packages/mobile/src/components/sheets/AttachmentSheet.tsx`
- Test: `__tests__/components/sheets/AttachmentSheet.test.tsx`

**Interfaces:**
- Consumes: `UserCard`, `ThemeToggle`, `MenuItem`, `Switch`, `ModelOption` (B5), `FileCard` (B6), `SheetHeader` (B4), `useSheetStore` (S2)
- Produces: 三个独立组件

#### SettingsDrawer 外观
- 宽度 320px，背景 palette.bg，圆角 0，左侧有 UserCard（头像 + Alex + 免费版标签）
- 4 个 section：通用（外观/字体大小/语言）、智能助手（默认模型/语音播报/回车发送）、账户（订阅Pro/用量配额）、其他（帮助反馈/关于）
- 每个 MenuItem 左侧图标 + 文字 + 右侧 value 或 Switch
- 底部退出登录按钮（danger 色）
- 抽屉打开时右侧 73px 透明区域点击关闭

#### ModelSwitchSheet 外观
- 使用 SheetHeader (B4) + ModelOption (B5) 组合
- 3 个分组 section label（基础模型/推理模式/Agent人格）
- 当前选中项有 active 样式（primarySoft 背景 + primary 边框）

#### AttachmentSheet 外观
- 使用 SheetHeader (B4) + 4 入口网格（本地图片/本地文件/拍照/引用回复）+ 最近文件列表（FileCard B6）

- [ ] **Step 1: 写测试**
- [ ] **Step 2: 实现 SettingsDrawer**
- [ ] **Step 3: 实现 ModelSwitchSheet**
- [ ] **Step 4: 实现 AttachmentSheet**
- [ ] **Step 5: git commit -m "feat(mobile): implement settings drawer, model switch and attachment sheets"**

---

## Layer 5: 集成

### I1: 根布局接入 store

**Files:**
- Modify: `packages/mobile/app/_layout.tsx`

在 RootLayout 中接入 `chatStore` 和 `sheetStore`（zustand store 不需要 Provider，直接在组件中通过 hook 使用）。

- [ ] **Step 1: 修改 `_layout.tsx` 导入并使用 chatStore/sheetStore**
- [ ] **Step 2: git commit -m "feat(mobile): integrate chatStore and sheetStore in root layout"**

---

### I2: 路由跳转

**Files:**
- Modify: `packages/mobile/app/chat.tsx`, `packages/mobile/app/index.tsx`, `packages/mobile/src/screens/HomeScreen.tsx`

实现交互：
- HomeScreen 的"新建会话"按钮 → 跳转到 `/chat`
- HomeScreen/ChatScreen 的菜单按钮 → 打开 SettingsDrawer
- ChatScreen 的输入框附件按钮 → 打开 AttachmentSheet
- ChatScreen 的 Pill → 打开 ModelSwitchSheet
- SettingsDrawer 关闭 → 跳回 `/`

**注意：Drawer 使用 `Animated` + `translateX` 实现滑动，BottomSheet 复用已有的 BottomSheet 组件（C0）。**

- [ ] **Step 1: 实现 HomeScreen → `/chat` 跳转**
- [ ] **Step 2: 实现菜单 → Drawer 开关**
- [ ] **Step 3: 实现各 Sheet 的 open/close 与 sheetStore 联动**
- [ ] **Step 4: git commit -m "feat(mobile): wire up routing and drawer/sheet interactions"**

---

## 验证清单

### 自检项（每个 agent 完成自己任务后必须检查）

1. **设计稿像素对比**：目测对比 HTML 设计稿，色值/圆角/字号/间距是否一致
2. **Theme 适配**：在浅色/深色模式下均正常显示
3. **无硬编码**：所有颜色来自 `palette`，字号来自 `tokens.fontSize`
4. **文案 i18n**：用户可见文案通过 `t()` 获取
5. **单元测试**：`pnpm --filter @openz/mobile test` 全量通过
6. **TypeScript**：`pnpm --filter @openz/mobile typecheck` 通过
7. **Web 热重载**：在 `npx expo start --web` 下确认组件正常渲染

---

## 执行顺序建议（并行调度）

```
T0 → T1 (Layer 0，串行)
    ↓
C1-C12 (Layer 1，12 个 agent 完全并行)
    ↓
B1-B6 (Layer 2，6 个 agent 完全并行)
    ↓
S1, S2 (Layer 3，并行)
    ↓
P1, P2, P3 (Layer 4，P3 可与 P1/P2 并行)
    ↓
I1, I2 (Layer 5，I1 → I2 串行)
```

**总计：27 个 Task，Layer 内完全无依赖，可同时调度。**
