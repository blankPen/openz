import { render } from '@testing-library/react-native';
import { ChatScreen } from '../../src/screens/ChatScreen';
import { ThemeProvider } from '../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('ChatScreen', () => {
  it('renders without error', () => {
    const { UNSAFE_root } = render(<ChatScreen />, { wrapper });
    expect(UNSAFE_root).toBeTruthy();
  });
});
