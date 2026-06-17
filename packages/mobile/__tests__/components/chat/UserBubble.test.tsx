import { render } from '@testing-library/react-native';
import { UserBubble } from '../../../src/components/chat/UserBubble';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('UserBubble', () => {
  it('renders content', () => {
    const { getByText } = render(<UserBubble content="Hello world" timestamp="10:00" />, { wrapper });
    expect(getByText('Hello world')).toBeTruthy();
  });

  it('renders timestamp', () => {
    const { getByText } = render(<UserBubble content="Hi" timestamp="16:32" />, { wrapper });
    expect(getByText('16:32')).toBeTruthy();
  });
});
