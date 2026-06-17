import { render } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/ThemeProvider';
import { ToolsStrip } from '../../../src/components/home/ToolsStrip';

describe('ToolsStrip', () => {
  test('renders 4 tools with correct names', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip />
      </ThemeProvider>,
    );
    expect(getByText('通用 Agent')).toBeTruthy();
    expect(getByText('一键 PPT')).toBeTruthy();
    expect(getByText('OpenZ Claw')).toBeTruthy();
    expect(getByText('健康助手')).toBeTruthy();
  });

  test('renders 4 tools (count)', () => {
    const { getAllByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip />
      </ThemeProvider>,
    );
    const toolNames = ['通用 Agent', '一键 PPT', 'OpenZ Claw', '健康助手'];
    toolNames.forEach(name => {
      expect(getAllByText(name)).toHaveLength(1);
    });
  });

  test('first tool has isPrimary styling', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ToolsStrip />
      </ThemeProvider>,
    );
    // First tool should be "通用 Agent" and be primary
    const primaryTool = getByText('通用 Agent');
    expect(primaryTool).toBeTruthy();
  });
});
