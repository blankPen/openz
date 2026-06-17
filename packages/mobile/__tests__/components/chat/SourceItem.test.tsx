import { render } from '@testing-library/react-native';
import { SourceItem } from '../../../src/components/chat/SourceItem';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('SourceItem', () => {
  it('renders title and domain', () => {
    const { getByText } = render(
      <SourceItem index={1} title="OpenAI Function Calling" url="platform.openai.com" />,
      { wrapper }
    );
    expect(getByText('OpenAI Function Calling')).toBeTruthy();
    expect(getByText('platform.openai.com')).toBeTruthy();
  });

  it('renders index number', () => {
    const { getByText } = render(
      <SourceItem index={3} title="Test" url="example.com" />,
      { wrapper }
    );
    expect(getByText('3')).toBeTruthy();
  });
});
