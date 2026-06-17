import { render } from '@testing-library/react-native';
import { ModelSwitchSheet } from '../../../src/components/sheets/ModelSwitchSheet';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('ModelSwitchSheet', () => {
  it('renders sheet title', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('切换模型')).toBeTruthy();
  });

  it('renders model section', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('基础模型')).toBeTruthy();
  });

  it('renders mode section', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('推理模式')).toBeTruthy();
  });

  it('renders persona section', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('Agent人格')).toBeTruthy();
  });

  it('renders model names', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('OpenZ Z1')).toBeTruthy();
    expect(getByText('OpenZ Z0.9')).toBeTruthy();
    expect(getByText('OpenZ Z2 Preview')).toBeTruthy();
  });

  it('renders mode names', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('深度思考')).toBeTruthy();
    expect(getByText('快速')).toBeTruthy();
    expect(getByText('联网')).toBeTruthy();
    expect(getByText('专业领域')).toBeTruthy();
  });

  it('renders persona names', () => {
    const { getByText } = render(<ModelSwitchSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('OpenZ默认')).toBeTruthy();
    expect(getByText('小火')).toBeTruthy();
    expect(getByText('博士')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<ModelSwitchSheet visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('切换模型')).toBeNull();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<ModelSwitchSheet visible onClose={jest.fn()} testID="model-switch" />, { wrapper });
    expect(getByTestId('model-switch')).toBeTruthy();
  });
});
