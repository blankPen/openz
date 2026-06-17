import { render, fireEvent } from '@testing-library/react-native';
import { CodeBlock } from '../../../src/components/chat/CodeBlock';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('CodeBlock', () => {
  it('renders code content', () => {
    const { getByText } = render(
      <CodeBlock code="const x = 1;" language="javascript" />,
      { wrapper }
    );
    expect(getByText('const x = 1;')).toBeTruthy();
  });

  it('calls onCopy when copy button pressed', () => {
    const onCopy = jest.fn();
    const { getByText } = render(
      <CodeBlock code="hello()" onCopy={onCopy} />,
      { wrapper }
    );
    fireEvent.press(getByText('复制'));
    expect(onCopy).toHaveBeenCalledWith('hello()');
  });
});
