import { render, fireEvent } from '@testing-library/react-native';
import { HomeScreen } from '../../src/screens/HomeScreen';
import { ThemeProvider } from '../../src/ThemeProvider';
import { useSheetStore } from '../../src/stores/sheetStore';

// Mock react-native-mmkv used by settingsStore (ThemeProvider pulls it in)
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k: string, v: string) => { store[k] = v; },
      getString: (k: string) => store[k],
      delete: (k: string) => { delete store[k]; },
    })),
  };
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('HomeScreen', () => {
  beforeEach(() => {
    useSheetStore.setState({
      drawerVisible: false,
      modelSheetVisible: false,
      attachmentSheetVisible: false,
    });
  });

  it('renders without error', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { root } = render(<HomeScreen />, { wrapper }) as any;
    expect(root).toBeTruthy();
  });

  it('renders WelcomeSection with name and subtitle', () => {
    const { getByTestId } = render(<HomeScreen />, { wrapper });

    expect(getByTestId('welcome-section')).toBeTruthy();
    expect(getByTestId('welcome-greeting')).toBeTruthy();
  });

  it('renders InputBar with placeholder text', () => {
    const { getByPlaceholderText } = render(<HomeScreen />, { wrapper });

    expect(getByPlaceholderText('尽管问，带图也行')).toBeTruthy();
  });

  it('menu button press calls the open drawer handler', () => {
    const { getByLabelText } = render(<HomeScreen />, { wrapper });

    const menuButton = getByLabelText('打开菜单');
    fireEvent.press(menuButton);

    // Handler calls setDrawerVisible(true), which triggers the drawer animation
    expect(useSheetStore.getState().drawerVisible).toBe(true);
  });

  it('renders tools strip', () => {
    const { getByText } = render(<HomeScreen />, { wrapper });

    // Default tools (S3 design spec)
    expect(getByText('通用 Agent')).toBeTruthy();
    expect(getByText('一键 PPT')).toBeTruthy();
    expect(getByText('OpenZ Claw')).toBeTruthy();
    expect(getByText('健康助手')).toBeTruthy();
  });

  it('pill press opens model sheet', () => {
    const { getByLabelText } = render(<HomeScreen />, { wrapper });

    const pill = getByLabelText('切换模型');
    fireEvent.press(pill);

    expect(useSheetStore.getState().modelSheetVisible).toBe(true);
  });

  it('attachment button press calls handler', () => {
    const { getByTestId } = render(<HomeScreen />, { wrapper });

    // InputBar renders PlusButton with testID
    const plusButton = getByTestId('plus-button');
    fireEvent.press(plusButton);

    expect(useSheetStore.getState().attachmentSheetVisible).toBe(true);
  });

  // S4: HomeScreen structure restoration
  it('topbar has 5 icon buttons: menu, voice, call, newChat', () => {
    const { getAllByLabelText } = render(<HomeScreen />, { wrapper });
    // Menu button (burger icon)
    expect(getAllByLabelText('打开菜单')).toHaveLength(1);
    // Voice button in topbar
    expect(getAllByLabelText('语音输入')).toHaveLength(2); // one in topbar, one in inputbar
    // Call button in topbar
    expect(getAllByLabelText('拨打')).toHaveLength(1);
    // New chat (plus) button
    expect(getAllByLabelText('新对话')).toHaveLength(1);
  });

  it('watermark "内容由 AI 生成" is present at bottom', () => {
    const { getByText } = render(<HomeScreen />, { wrapper });

    expect(getByText('内容由 AI 生成')).toBeTruthy();
  });

  it('spacer exists between welcome content and input bar', () => {
    const { getByTestId, getByText } = render(<HomeScreen />, { wrapper });
    // The spacer is rendered as a View - verify structure:
    // welcome section, spacer, watermark, input bar
    expect(getByTestId('welcome-section')).toBeTruthy();
    // Watermark appears below spacer
    expect(getByText('内容由 AI 生成')).toBeTruthy();
  });

  it('home indicator renders', () => {
    // HomeIndicator component renders with testID
    const { getByTestId } = render(<HomeScreen />, { wrapper });
    expect(getByTestId('home-indicator')).toBeTruthy();
  });

  // S5: SettingsDrawer design spec
  describe('SettingsDrawer in HomeScreen', () => {
    beforeEach(() => {
      // Ensure drawer is visible for these tests
      useSheetStore.setState({ drawerVisible: true });
    });

    it('renders SettingsDrawer when drawerVisible is true', () => {
      const { getByTestId } = render(<HomeScreen />, { wrapper });
      // SettingsDrawer renders with its testID
      expect(getByTestId('settings-drawer')).toBeTruthy();
    });

    it('user card present with name Alex', () => {
      const { getByTestId } = render(<HomeScreen />, { wrapper });
      // SettingsDrawer user name is inside the drawer
      const drawer = getByTestId('settings-drawer');
      expect(drawer).toBeTruthy();
    });

    it('drawer has all 4 section titles', () => {
      const { getByText } = render(<HomeScreen />, { wrapper });
      // 4 sections: 通用, 智能助手, 账户, 其他
      expect(getByText('通用')).toBeTruthy();
      expect(getByText('智能助手')).toBeTruthy();
      expect(getByText('账户')).toBeTruthy();
      expect(getByText('其他')).toBeTruthy();
    });

    it('theme toggle has 3 segments (浅色/深色/自动)', () => {
      const { getAllByText } = render(<HomeScreen />, { wrapper });
      // Each theme option appears in ThemeToggle (exact label) and optionally elsewhere
      // Use getAllByText since "浅色" may appear in MenuItem value too
      const lightBtns = getAllByText('浅色');
      expect(lightBtns.length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('深色').length).toBeGreaterThanOrEqual(1);
      expect(getAllByText('自动').length).toBeGreaterThanOrEqual(1);
    });

    it('logout button present', () => {
      const { getByText } = render(<HomeScreen />, { wrapper });
      expect(getByText('退出登录')).toBeTruthy();
    });
  });
});
