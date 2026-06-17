import { render } from '@testing-library/react-native';
import { StreamingIndicator } from '../../../src/components/chat/StreamingIndicator';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('StreamingIndicator', () => {
  it('renders text', () => {
    const { getByText } = render(<StreamingIndicator />, { wrapper });
    expect(getByText('OpenZ 正在回复…')).toBeTruthy();
  });

  it('renders without error', () => {
    const { root } = render(<StreamingIndicator />, { wrapper });
    expect(root).toBeTruthy();
  });
});
