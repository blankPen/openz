import { render, fireEvent } from '@testing-library/react-native';
import { AIActionsBar } from '../../../src/components/chat/AIActionsBar';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('AIActionsBar', () => {
  it('renders all 4 actions', () => {
    const { getByText } = render(<AIActionsBar />, { wrapper });
    expect(getByText('复制')).toBeTruthy();
    expect(getByText('重新生成')).toBeTruthy();
    expect(getByText('分享')).toBeTruthy();
  });

  it('renders like count when provided', () => {
    const { getByText } = render(<AIActionsBar likeCount={8} />, { wrapper });
    expect(getByText('8')).toBeTruthy();
  });

  it('calls onCopy when copy pressed', () => {
    const onCopy = jest.fn();
    const { getByText } = render(<AIActionsBar onCopy={onCopy} />, { wrapper });
    fireEvent.press(getByText('复制'));
    expect(onCopy).toHaveBeenCalled();
  });
});
