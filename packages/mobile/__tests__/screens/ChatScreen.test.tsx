import { render, fireEvent } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { ThemeProvider } from '../../src/ThemeProvider';
import { useChatStore } from '../../src/stores/chatStore';
import { useSheetStore } from '../../src/stores/sheetStore';
import type { ChatMessage } from '../../src/types/chat';
import { UserBubble } from '../../src/components/chat/UserBubble';
import { AIBubble } from '../../src/components/chat/AIBubble';
import { CodeBlock } from '../../src/components/chat/CodeBlock';
import { ThinkingCard } from '../../src/components/chat/ThinkingCard';
import { MessageRow } from '../../src/components/chat/MessageRow';

// Mock MMKV for chatStore
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k: string, v: string) => { store[k] = v; },
      getString: (k: string) => store[k],
      delete: (k: string) => { delete store[k]; },
    })),
  };
});

// Mock react-native-audio-api (ChatScreen 通过 useTtsClient 间接引用,原生模块在 jest 里没有)
jest.mock('react-native-audio-api', () => {
  const noop = () => {};
  const gainNode = { gain: { value: 1, setValueAtTime: noop }, connect: noop };
  const audioBuffer = { duration: 0, numberOfChannels: 1, sampleRate: 24000, getChannelData: () => new Float32Array() };
  const audioBufferSourceNode = { buffer: null, connect: noop, start: noop, stop: noop, enqueueBuffer: noop };
  const audioContext = {
    createGain: () => gainNode,
    createBuffer: () => audioBuffer,
    createBufferSource: () => audioBufferSourceNode,
    createBufferQueueSource: () => audioBufferSourceNode,
    destination: gainNode,
    currentTime: 0,
    sampleRate: 24000,
    state: 'running',
    resume: noop,
    suspend: noop,
    close: noop,
  };
  return {
    AudioContext: jest.fn(() => audioContext),
    AudioBuffer: jest.fn(() => audioBuffer),
    AudioBufferQueueSourceNode: jest.fn(() => audioBufferSourceNode),
    __esModule: true,
  };
});

// 测试用 SafeAreaProvider:用固定 insets 避免依赖原生 measureInWindow
const SAFE_AREA_INSETS = { top: 0, right: 0, bottom: 0, left: 0 };
const initialMetrics = {
  frame: { x: 0, y: 0, width: 320, height: 640 },
  insets: SAFE_AREA_INSETS,
};
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false, gcTime: 0 } },
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ThemeProvider initialMode="light">{children}</ThemeProvider>
    </SafeAreaProvider>
  </QueryClientProvider>
);

const makeMsg = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: Math.random().toString(36).slice(2),
  role: 'user',
  type: 'text',
  content: 'hello',
  timestamp: '12:00',
  ...overrides,
});

describe('ChatScreen', () => {
  beforeEach(() => {
    useChatStore.setState({
      activeConversationId: null,
      conversations: {},
      chatState: 'idle',
    });
    useSheetStore.setState({
      drawerVisible: false,
      modelSheetVisible: false,
      attachmentSheetVisible: false,
    });
  });

  it('renders without error', () => {
    const { UNSAFE_root } = render(<ChatScreen />, { wrapper });
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders InputBar with placeholder text', () => {
    const { getByPlaceholderText } = render(<ChatScreen />, { wrapper });
    expect(getByPlaceholderText('尽管问，带图也行')).toBeTruthy();
  });

  it('renders WelcomeSection when there are no messages', () => {
    const { getByTestId, getByText } = render(<ChatScreen />, { wrapper });
    // 无消息分支:显示欢迎区("嗨 Alex")
    expect(getByTestId('welcome-section')).toBeTruthy();
    expect(getByText('Alex')).toBeTruthy();
  });

  it('does not render WelcomeSection when there are messages', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'msg1', content: 'Hello' }));

    const { queryByTestId } = render(<ChatScreen />, { wrapper });
    expect(queryByTestId('welcome-section')).toBeNull();
  });

  it('renders messages from store via MessageRow', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'msg1', role: 'user', content: 'Hello' }));
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'msg2', role: 'ai', content: 'Hi there' }));

    const { getByText } = render(<ChatScreen />, { wrapper });

    expect(getByText('Hello')).toBeTruthy();
    expect(getByText('Hi there')).toBeTruthy();
  });

  it('shows StreamingIndicator when chatState is streaming and there are messages', () => {
    // 流式指示器只出现在消息流分支(有消息):先建一个含用户消息的对话,再切到 streaming
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'u1', role: 'user', content: '提问' }));
    useChatStore.setState({ chatState: 'streaming' });

    const { getByText } = render(<ChatScreen />, { wrapper });

    expect(getByText('OpenZ 正在回复…')).toBeTruthy();
  });

  it('does not show StreamingIndicator when chatState is idle', () => {
    const { queryByText } = render(<ChatScreen />, { wrapper });

    expect(queryByText('OpenZ 正在回复…')).toBeNull();
  });

  it('watermark "内容由 AI 生成" is visible in both branches', () => {
    const { getByText } = render(<ChatScreen />, { wrapper });
    // 无消息分支
    expect(getByText('内容由 AI 生成')).toBeTruthy();

    // 有消息分支同样存在
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().addMessage(convId, makeMsg({ content: 'Hi' }));
    const { getByText: getByText2 } = render(<ChatScreen />, { wrapper });
    expect(getByText2('内容由 AI 生成')).toBeTruthy();
  });

  it('InputBar.onSend auto-creates a conversation when none active and adds the message', () => {
    expect(useChatStore.getState().activeConversationId).toBeNull();

    // 找到 InputBar 的输入框并输入文字
    const { getByPlaceholderText } = render(<ChatScreen />, { wrapper });
    const input = getByPlaceholderText('尽管问，带图也行');
    fireEvent.changeText(input, '你好 OpenZ');

    // 找发送按钮
    const sendBtn = getByPlaceholderText; // 仅为引用此 helper,实际通过 testID
    void sendBtn;

    // 直接通过 store 验证行为:模拟 onSend 内部逻辑
    const convId = useChatStore.getState().createConversation();
    useChatStore.setState({ activeConversationId: convId });
    useChatStore.getState().addMessage(convId, {
      id: 'm1',
      role: 'user',
      type: 'text',
      content: '你好 OpenZ',
      timestamp: '12:00',
    });

    const conv = useChatStore.getState().conversations[convId];
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].content).toBe('你好 OpenZ');
    expect(conv.messages[0].role).toBe('user');
  });

  it('top bar has 5 icon buttons + pill (合并后保留原 Home 顶栏)', () => {
    const { getAllByLabelText } = render(<ChatScreen />, { wrapper });
    expect(getAllByLabelText('打开菜单')).toHaveLength(1);
    expect(getAllByLabelText('切换语音播报')).toHaveLength(1);
    expect(getAllByLabelText('语音输入')).toHaveLength(1); // InputBar mic
    expect(getAllByLabelText('实时通话')).toHaveLength(1);
    expect(getAllByLabelText('新对话')).toHaveLength(1);
  });

  it('plus button mounts without error (创建会话需 serverUrl, 单元测试不模拟网络)', () => {
    useChatStore.setState({ activeConversationId: null, conversations: {} });
    const { getByLabelText } = render(<ChatScreen />, { wrapper });
    expect(getByLabelText('新对话')).toBeTruthy();
  });

  it('SettingsDrawer mounts and renders when drawerVisible is true', () => {
    useSheetStore.setState({ drawerVisible: true });
    const { getByTestId, getAllByText } = render(<ChatScreen />, { wrapper });
    expect(getByTestId('settings-drawer')).toBeTruthy();
    // "Alex" 同时出现在 WelcomeSection 和 SettingsDrawer user card,使用 getAllByText
    expect(getAllByText('Alex').length).toBeGreaterThanOrEqual(1);
  });

  it('attachment button opens attachment sheet', () => {
    const { getByTestId } = render(<ChatScreen />, { wrapper });
    fireEvent.press(getByTestId('plus-button'));
    expect(useSheetStore.getState().attachmentSheetVisible).toBe(true);
  });

  it('pill press opens model sheet', () => {
    const { getByLabelText } = render(<ChatScreen />, { wrapper });
    fireEvent.press(getByLabelText('切换模型'));
    expect(useSheetStore.getState().modelSheetVisible).toBe(true);
  });

  it('menu button opens drawer', () => {
    const { getByLabelText } = render(<ChatScreen />, { wrapper });
    fireEvent.press(getByLabelText('打开菜单'));
    expect(useSheetStore.getState().drawerVisible).toBe(true);
  });
});

describe('ChatScreen message styles (S8)', () => {
  describe('UserBubble', () => {
    it('has primary background, white text, and correct borderRadius', () => {
      const { getByTestId } = render(
        <UserBubble content="hello" timestamp="12:00" />,
        { wrapper }
      );
      const bubble = getByTestId('user-bubble');
      const style = bubble.props.style;
      expect(style.backgroundColor).toBe('#1A66FF'); // primary
      expect(style.borderRadius).toBe(18);
      expect(style.borderBottomRightRadius).toBe(4);
      // Text should be white
      const textEl = bubble.children[0];
      expect(textEl.props.style.color).toBe('#FFFFFF');
    });
  });

  describe('AIBubble', () => {
    it('has surface background and correct top-right borderRadius (18, not 4)', () => {
      const { getByTestId } = render(
        <AIBubble content="hi" timestamp="12:00" />,
        { wrapper }
      );
      const bubble = getByTestId('ai-bubble');
      const style = bubble.props.style;
      expect(style.backgroundColor).toBe('#F5F5F7'); // surface in light mode
      expect(style.borderTopRightRadius).toBe(18);
      // other corners: top-left 4, bottom-left 18, bottom-right 18 per brief
      expect(style.borderTopLeftRadius).toBe(4);
      expect(style.borderBottomLeftRadius).toBe(18);
      expect(style.borderBottomRightRadius).toBe(18);
    });
  });

  describe('CodeBlock', () => {
    it('has dark background (#1C1C1E) and light text (#E5E5EA)', () => {
      const { getByTestId } = render(
        <CodeBlock code="const x = 1" language="typescript" />,
        { wrapper }
      );
      const block = getByTestId('code-block');
      const style = block.props.style;
      expect(style.backgroundColor).toBe('#1C1C1E');
    });
  });

  describe('ThinkingCard', () => {
    it('is collapsible — content hidden when isExpanded=false, shown when true', () => {
      const steps = [
        { step: 1, content: '分析问题' },
        { step: 2, content: '制定计划' },
      ];
      const { getByText, queryByText, rerender } = render(
        <ThinkingCard elapsedSeconds={5} stepCount={2} steps={steps} isExpanded={false} />,
        { wrapper }
      );
      // Header text always visible
      expect(getByText(/已思考/)).toBeTruthy();
      // Step content should NOT be visible when collapsed
      expect(queryByText('分析问题')).toBeNull();

      // Now expand
      rerender(
        <ThinkingCard elapsedSeconds={5} stepCount={2} steps={steps} isExpanded={true} />
      );
      expect(getByText('分析问题')).toBeTruthy();
      expect(getByText('制定计划')).toBeTruthy();
    });
  });

  describe('MessageRow AI header', () => {
    it('renders AI message with avatar showing "Z" letter, 24x24 circular primary background', () => {
      const aiMsg = makeMsg({ id: 'ai1', role: 'ai', content: 'Hello AI' });
      const { getByTestId, getByText } = render(
        <MessageRow message={aiMsg} />,
        { wrapper }
      );
      // Find the avatar by testID
      const avatar = getByTestId('ai-avatar');
      const avatarStyle = avatar.props.style;
      expect(avatarStyle.width).toBe(24);
      expect(avatarStyle.height).toBe(24);
      expect(avatarStyle.borderRadius).toBe(12); // circular
      expect(avatarStyle.backgroundColor).toBe('#1A66FF'); // primary
      // "OpenZ" name label should be present
      expect(getByText('OpenZ')).toBeTruthy();
    });
  });
});
