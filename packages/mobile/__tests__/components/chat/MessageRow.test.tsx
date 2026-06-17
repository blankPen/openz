import { render } from '@testing-library/react-native';
import { MessageRow } from '../../../src/components/chat/MessageRow';
import { ThemeProvider } from '../../../src/ThemeProvider';
import type { ChatMessage } from '../../../src/types/chat';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

const userMsg: ChatMessage = {
  id: '1',
  role: 'user',
  type: 'text',
  content: 'Hello AI',
  timestamp: '10:00',
};

const aiMsg: ChatMessage = {
  id: '2',
  role: 'ai',
  type: 'text',
  content: 'Hello user',
  timestamp: '10:01',
};

describe('MessageRow', () => {
  it('renders user message', () => {
    const { getByText } = render(<MessageRow message={userMsg} />, { wrapper });
    expect(getByText('Hello AI')).toBeTruthy();
    expect(getByText('10:00')).toBeTruthy();
  });

  it('renders AI message', () => {
    const { getByText } = render(<MessageRow message={aiMsg} />, { wrapper });
    expect(getByText('Hello user')).toBeTruthy();
  });
});