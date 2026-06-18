import { render } from '@testing-library/react-native';
import { SettingsDrawer } from '../../../src/components/drawer/SettingsDrawer';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('SettingsDrawer', () => {
  it('renders user name', () => {
    const { getByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('Alex')).toBeTruthy();
  });

  it('renders pro badge', () => {
    const { getByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('免费版 · 升级 Pro')).toBeTruthy();
  });

  it('renders section titles', () => {
    const { getByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('通用')).toBeTruthy();
    expect(getByText('智能助手')).toBeTruthy();
    expect(getByText('账户')).toBeTruthy();
    expect(getByText('其他')).toBeTruthy();
  });

  it('renders menu items', () => {
    const { getByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('语音播报')).toBeTruthy();
    expect(getByText('回车发送')).toBeTruthy();
    expect(getByText('订阅 Pro')).toBeTruthy();
  });

  it('does not render theme toggle (主题已锁定 light)', () => {
    const { queryByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    // 设计变更: 外观控制已移除,主题不可变
    expect(queryByText('外观')).toBeNull();
    expect(queryByText('浅色')).toBeNull();
    expect(queryByText('深色')).toBeNull();
    expect(queryByText('自动')).toBeNull();
  });

  it('renders logout button', () => {
    const { getByText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('退出登录')).toBeTruthy();
  });

  it('does not crash when visible is false', () => {
    const { queryByText } = render(<SettingsDrawer visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('Alex')).toBeNull();
  });

  it('renders backdrop with accessibility label for click-to-close', () => {
    const { getByLabelText } = render(<SettingsDrawer visible onClose={jest.fn()} />, { wrapper });
    // 抽屉展开时遮罩可点击关闭
    expect(getByLabelText('关闭设置面板')).toBeTruthy();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<SettingsDrawer visible onClose={jest.fn()} testID="settings-drawer" />, { wrapper });
    expect(getByTestId('settings-drawer')).toBeTruthy();
  });
});
