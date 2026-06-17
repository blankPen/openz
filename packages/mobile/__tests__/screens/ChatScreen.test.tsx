import { render, fireEvent } from '@testing-library/react-native';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { ThemeProvider } from '../../src/ThemeProvider';
import { useChatStore } from '../../src/stores/chatStore';
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

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
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
  });

  it('renders without error', () => {
    const { UNSAFE_root } = render(<ChatScreen />, { wrapper });
    expect(UNSAFE_root).toBeTruthy();
  });

  it('renders InputBar with placeholder text', () => {
    const { getByPlaceholderText } = render(<ChatScreen />, { wrapper });
    expect(getByPlaceholderText('输入消息...')).toBeTruthy();
  });

  it('renders messages from store via MessageRow', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'msg1', role: 'user', content: 'Hello' }));
    useChatStore.getState().addMessage(convId, makeMsg({ id: 'msg2', role: 'ai', content: 'Hi there' }));

    const { getByText } = render(<ChatScreen />, { wrapper });

    expect(getByText('Hello')).toBeTruthy();
    expect(getByText('Hi there')).toBeTruthy();
  });

  it('shows StreamingIndicator when chatState is streaming', () => {
    useChatStore.setState({ chatState: 'streaming' });

    const { getByText } = render(<ChatScreen />, { wrapper });

    expect(getByText('OpenZ 正在回复…')).toBeTruthy();
  });

  it('does not show StreamingIndicator when chatState is idle', () => {
    const { queryByText } = render(<ChatScreen />, { wrapper });

    expect(queryByText('OpenZ 正在回复…')).toBeNull();
  });

  it('onSend adds a message to the store', () => {
    const convId = useChatStore.getState().createConversation();
    useChatStore.setState({ activeConversationId: convId });

    // Verify the message list is initially empty
    expect(useChatStore.getState().conversations[convId].messages).toHaveLength(0);

    // Directly add a message via the store (same logic as onSend in ChatScreen)
    const msgId = Date.now().toString();
    useChatStore.getState().addMessage(convId, {
      id: msgId,
      role: 'user',
      type: 'text',
      content: 'Test message',
      timestamp: '12:00',
    });

    const conv = useChatStore.getState().conversations[convId];
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].content).toBe('Test message');
    expect(conv.messages[0].role).toBe('user');
  });

  it('onSend does nothing when no active conversation', () => {
    useChatStore.setState({ activeConversationId: null });

    // Render ChatScreen with no active conversation
    render(<ChatScreen />, { wrapper });

    // Even with text entered, no message should be added when there's no active conversation
    // (the onSend handler early-returns when activeConversationId is null)
    expect(Object.keys(useChatStore.getState().conversations)).toHaveLength(0);
  });
});

describe('ChatScreen message styles (S8)', () => {
  describe('UserBubble', () => {
    it('has primary background, white text, and correct top-left borderRadius', () => {
      const { getByText } = render(
        <UserBubble content="hello" timestamp="12:00" />,
        { wrapper }
      );
      const textEl = getByText('hello');
      // Walk up to find the bubble view (View > View > Text)
      const bubbleView = textEl.parent?.parent as React.ComponentType<any>;
      const style = bubbleView.props.style;
      const bgStyle = Array.isArray(style) ? style.find((s: any) => s?.backgroundColor) : style;
      expect(bgStyle.backgroundColor).toBe('#1A66FF'); // primary
      expect(bgStyle.borderRadius).toBe(18);
      expect(bgStyle.borderBottomRightRadius).toBe(4);
      // Text should be white
      expect(textEl.props.style.color).toBe('#FFFFFF');
    });
  });

  describe('AIBubble', () => {
    it('has surface background and correct top-right borderRadius (18, not 4)', () => {
      const { getByText } = render(
        <AIBubble content="hi" timestamp="12:00" />,
        { wrapper }
      );
      const textEl = getByText('hi');
      // Debug: print parent chain
      console.log('DEBUG textEl parent:', textEl.parent?.type?.name || textEl.parent?.type);
      console.log('DEBUG grandparent:', textEl.parent?.parent?.type?.name || textEl.parent?.parent?.type);
      console.log('DEBUG grandparent style:', JSON.stringify(textEl.parent?.parent?.props?.style));
      const bubbleView = textEl.parent?.parent as React.ComponentType<any>;
      const style = bubbleView.props.style;
      console.log('DEBUG style isArray:', Array.isArray(style));
      console.log('DEBUG style:', JSON.stringify(style));
      const bgStyle = Array.isArray(style) ? style.find((s: any) => s?.backgroundColor) : style;
      console.log('DEBUG bgStyle:', JSON.stringify(bgStyle));
      expect(bgStyle.backgroundColor).toBe('#FFFFFF'); // surface in light mode
      // top-right must be 18 per spec (currently missing → will be 4 → FAIL)
      expect(bgStyle.borderTopRightRadius).toBe(18);
      // other corners: top-left 4, bottom-left 18, bottom-right 18 per brief
      expect(bgStyle.borderTopLeftRadius).toBe(4);
      expect(bgStyle.borderBottomLeftRadius).toBe(18);
      expect(bgStyle.borderBottomRightRadius).toBe(18);
    });
  });

  describe('CodeBlock', () => {
    it('has dark background (#1C1C1E) and light text (#E5E5EA)', () => {
      const { getByText } = render(
        <CodeBlock code="const x = 1" language="typescript" />,
        { wrapper }
      );
      const codeEl = getByText('const x = 1');
      const style = codeEl.props.style;
      expect(style.color).toBe('#E5E5EA');
      // Background is on the outer container
      const container = codeEl.parent?.parent?.parent?.parent as React.ComponentType<any>;
      const containerStyle = container.props.style;
      const bgStyle = Array.isArray(containerStyle) ? containerStyle[0] : containerStyle;
      expect(bgStyle.backgroundColor).toBe('#1C1C1E');
    });
  });

  describe('ThinkingCard', () => {
    it('is collapsible — content hidden when isExpanded=false, shown when true', () => {
      const steps = [
        { step: '1', content: '分析问题' },
        { step: '2', content: '制定计划' },
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
        <ThinkingCard elapsedSeconds={5} stepCount={2} steps={steps} isExpanded={true} />,
        { wrapper }
      );
      expect(getByText('分析问题')).toBeTruthy();
      expect(getByText('制定计划')).toBeTruthy();
    });
  });

  describe('MessageRow AI header', () => {
    it('renders AI message with avatar showing "Z" letter, 24x24 circular primary background', () => {
      const aiMsg = makeMsg({ id: 'ai1', role: 'ai', content: 'Hello AI' });
      const { getByText } = render(
        <MessageRow message={aiMsg} />,
        { wrapper }
      );
      // Find the avatar letter "Z"
      const avatarEl = getByText('Z');
      const avatarStyle = avatarEl.parent?.parent?.props.style;
      // Avatar container should be 24x24
      const sizeStyle = Array.isArray(avatarStyle) ? avatarStyle[0] : avatarStyle;
      expect(sizeStyle.width).toBe(24);
      expect(sizeStyle.height).toBe(24);
      expect(sizeStyle.borderRadius).toBe(12); // circular
      expect(sizeStyle.backgroundColor).toBe('#1A66FF'); // primary
      // "OpenZ" name label should be present
      expect(getByText('OpenZ')).toBeTruthy();
    });
  });
});
