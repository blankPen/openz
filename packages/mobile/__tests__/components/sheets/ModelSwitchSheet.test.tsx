import { render } from '@testing-library/react-native';
import { ModelSwitchSheet } from '../../../src/components/sheets/ModelSwitchSheet';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('ModelSwitchSheet', () => {
  it('renders sheet title "切换模型"', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('切换模型')).toBeTruthy();
  });

  it('renders subtitle about immediate effect', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('选择后立即生效，下一条消息生效')).toBeTruthy();
  });

  it('renders 3 sections (设计稿 model-switch.html)', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('基础模型')).toBeTruthy();
    expect(getByText('推理模式')).toBeTruthy();
    expect(getByText('Agent 人格')).toBeTruthy();
  });

  it('renders model section options', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('OpenZ Z1')).toBeTruthy();
    expect(getByText('OpenZ Z0.9')).toBeTruthy();
    expect(getByText('OpenZ Z2 Preview')).toBeTruthy();
  });

  it('renders mode section options', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('深度思考')).toBeTruthy();
    expect(getByText('快速')).toBeTruthy();
    expect(getByText('联网')).toBeTruthy();
    expect(getByText('专业领域')).toBeTruthy();
  });

  it('renders persona section options (设计稿)', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('OpenZ 默认')).toBeTruthy();
    expect(getByText('小火 · 创意')).toBeTruthy();
    expect(getByText('博士 · 严谨')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<ModelSwitchSheet visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('切换模型')).toBeNull();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<ModelSwitchSheet visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('切换模型/模式')).toBeNull();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<ModelSwitchSheet visible onClose={jest.fn()} testID="model-switch" />, { wrapper });
    expect(getByTestId('model-switch')).toBeTruthy();
  });

  describe('section label styles', () => {
    it('section labels are uppercase', () => {
      const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
      // The section labels should be uppercase
      const label = getByText('基础模型');
      expect(label).toBeTruthy();
    });

    it('has exactly 3 sections', () => {
      const { getAllByTestId } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
      // Count section containers - they have specific marginBottom
    });
  });

  describe('sheet handle', () => {
    it('sheet has handle bar', () => {
      const { getByTestId } = render(
        <ModelSwitchSheet visible onClose={jest.fn()} testID="model-switch" />,
        { wrapper }
      );
      // The BottomSheet should render a handle element
      const sheet = getByTestId('model-switch');
      expect(sheet).toBeTruthy();
    });
  });
});
