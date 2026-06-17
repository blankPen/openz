import { render, fireEvent } from '@testing-library/react-native';
import { ToolCallCard } from '../../../src/components/chat/ToolCallCard';
import { ThemeProvider } from '../../../src/ThemeProvider';
import type { ToolCall } from '../../../src/types/chat';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

const mockToolCall: ToolCall = {
  name: '联网搜索',
  description: '关键词：Agent vs RAG',
  sources: [
    { index: 1, title: 'OpenAI Function Calling', url: 'platform.openai.com' },
    { index: 2, title: 'Anthropic Agent Guide', url: 'anthropic.com' },
  ],
};

describe('ToolCallCard', () => {
  it('renders tool name', () => {
    const { getByText } = render(<ToolCallCard toolCall={mockToolCall} />, { wrapper });
    expect(getByText('联网搜索 · 2 个来源')).toBeTruthy();
  });

  it('shows sources when expanded', () => {
    const { getByText } = render(<ToolCallCard toolCall={mockToolCall} isExpanded={true} />, { wrapper });
    expect(getByText('OpenAI Function Calling')).toBeTruthy();
  });

  it('calls onToggle when header pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(<ToolCallCard toolCall={mockToolCall} onToggle={onToggle} />, { wrapper });
    fireEvent.press(getByText(/^联网搜索/));
    expect(onToggle).toHaveBeenCalled();
  });
});
