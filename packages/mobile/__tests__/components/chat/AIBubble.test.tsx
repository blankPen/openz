import { render } from '@testing-library/react-native';
import { AIBubble } from '../../../src/components/chat/AIBubble';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('AIBubble', () => {
  it('renders plain text', () => {
    const { getByText } = render(<AIBubble content="Hello" timestamp="10:00" />, { wrapper });
    expect(getByText('Hello')).toBeTruthy();
  });

  it('renders timestamp', () => {
    const { getByText } = render(<AIBubble content="Hi" timestamp="16:32" />, { wrapper });
    expect(getByText('16:32')).toBeTruthy();
  });
});
