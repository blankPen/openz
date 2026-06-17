import { render, fireEvent } from '@testing-library/react-native';
import { ThinkingCard } from '../../../src/components/chat/ThinkingCard';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

const mockSteps = [
  { step: 1, content: '理解用户问题' },
  { step: 2, content: '规划章节大纲' },
];

describe('ThinkingCard', () => {
  it('renders summary text', () => {
    const { getByText } = render(<ThinkingCard elapsedSeconds={8} stepCount={3} steps={mockSteps} />, { wrapper });
    expect(getByText(/已思考 8 秒/)).toBeTruthy();
  });

  it('shows steps when expanded', () => {
    const { getByText } = render(<ThinkingCard elapsedSeconds={8} stepCount={2} steps={mockSteps} isExpanded={true} />, { wrapper });
    expect(getByText('理解用户问题')).toBeTruthy();
    expect(getByText('规划章节大纲')).toBeTruthy();
  });

  it('hides steps when collapsed', () => {
    const { queryByText } = render(<ThinkingCard elapsedSeconds={8} stepCount={2} steps={mockSteps} isExpanded={false} />, { wrapper });
    expect(queryByText('理解用户问题')).toBeNull();
  });

  it('calls onToggle when pressed', () => {
    const onToggle = jest.fn();
    const { getByText } = render(<ThinkingCard elapsedSeconds={8} stepCount={2} steps={mockSteps} onToggle={onToggle} />, { wrapper });
    fireEvent.press(getByText(/已思考 8 秒/));
    expect(onToggle).toHaveBeenCalled();
  });
});
