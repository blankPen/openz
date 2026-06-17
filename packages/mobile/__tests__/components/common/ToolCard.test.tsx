import { render, fireEvent } from '@testing-library/react-native';
import { ToolCard } from '../../../src/components/common/ToolCard';
import { Icon } from '../../../src/components/common/Icon';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('ToolCard', () => {
  it('renders name', () => {
    const { getByText } = render(
      <ToolCard icon={<Icon name="sparkles" color="#1A66FF" size={26} />} iconBg="#EAF1FF" iconColor="#1A66FF" name="通用 Agent" />,
      { wrapper }
    );
    expect(getByText('通用 Agent')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ToolCard icon={<Icon name="sparkles" color="#1A66FF" size={26} />} iconBg="#EAF1FF" iconColor="#1A66FF" name="Test" onPress={onPress} />,
      { wrapper }
    );
    fireEvent.press(getByText('Test'));
    expect(onPress).toHaveBeenCalled();
  });
});
