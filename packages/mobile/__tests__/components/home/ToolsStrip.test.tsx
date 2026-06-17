import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/ThemeProvider';
import { ToolsStrip } from '../../../src/components/home/ToolsStrip';
import type { Tool } from '../../../src/components/home/ToolsStrip';

describe('ToolsStrip', () => {
  test('renders default tools', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip />
      </ThemeProvider>,
    );
    expect(getByText('联网')).toBeTruthy();
    expect(getByText('Deep Research')).toBeTruthy();
    expect(getByText('法律助手')).toBeTruthy();
    expect(getByText('创意助手')).toBeTruthy();
    expect(getByText('学术助手')).toBeTruthy();
  });

  test('renders custom tools', () => {
    const customTools: Tool[] = [
      { name: 'Custom Tool', icon: 'search', iconBg: '#fff', iconColor: '#000' },
    ];
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip tools={customTools} />
      </ThemeProvider>,
    );
    expect(getByText('Custom Tool')).toBeTruthy();
  });

  test('fires onPress when tool is pressed', () => {
    const onPress = jest.fn();
    const tools: Tool[] = [
      { name: 'Press Me', icon: 'globe', iconBg: '#fff', iconColor: '#000', onPress },
    ];
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip tools={tools} />
      </ThemeProvider>,
    );
    fireEvent.press(getByText('Press Me'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  test('renders empty when tools array is empty', () => {
    const { queryByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip tools={[]} />
      </ThemeProvider>,
    );
    expect(queryByText('联网')).toBeNull();
  });
});
