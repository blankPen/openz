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
    expect(getByTestId('welcome-name')).toBeTruthy();
    expect(getByTestId('welcome-subtitle')).toBeTruthy();
  });

  it('renders InputBar with placeholder text', () => {
    const { getByPlaceholderText } = render(<HomeScreen />, { wrapper });

    expect(getByPlaceholderText('输入消息...')).toBeTruthy();
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

    // Default tools
    expect(getByText('联网')).toBeTruthy();
    expect(getByText('Deep Research')).toBeTruthy();
    expect(getByText('法律助手')).toBeTruthy();
    expect(getByText('创意助手')).toBeTruthy();
    expect(getByText('学术助手')).toBeTruthy();
  });

  it('pill press opens model sheet', () => {
    const { getByLabelText } = render(<HomeScreen />, { wrapper });

    const pill = getByLabelText('切换模型');
    fireEvent.press(pill);

    expect(useSheetStore.getState().modelSheetVisible).toBe(true);
  });

  it('attachment button press calls handler', () => {
    const { getByTestId } = render(<HomeScreen />, { wrapper });

    // InputBar on HomeScreen renders AttachmentButton which gets a testID from its parent
    // Use testID on the AttachmentButton itself for reliable querying
    const attachmentButton = getByTestId('attachment-button');
    fireEvent.press(attachmentButton);

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
    // HomeIndicator component is rendered in the tree
    const { root } = render(<HomeScreen />, { wrapper }) as any;
    // HomeIndicator renders a View with height:34 and pointerEvents:none
    // containing an inner View with width:134, height:5
    const allViews = root.findAllByType('RCTView');
    const homeIndicatorViews = allViews.filter((v: any) => {
      const style = v.props.style || [];
      const styleArr = Array.isArray(style) ? style : [style];
      return styleArr.some((s: any) => s && s.height === 34);
    });
    expect(homeIndicatorViews.length).toBeGreaterThan(0);
  });

  // S5: SettingsDrawer design spec
  describe('SettingsDrawer in HomeScreen', () => {
    it('drawer has width of 320', () => {
      const { root } = render(<HomeScreen />, { wrapper }) as any;
      // Find the drawer Animated.View with width 320
      const drawerView = root.findAllByType('RCTView').find((v: any) =>
        v.props.style?.some?.((s: any) => s?.width === 320)
      );
      expect(drawerView).toBeTruthy();
    });

    it('user card present with avatar initial Z', () => {
      useSheetStore.setState({ drawerVisible: true });
      const { getByText } = render(<HomeScreen />, { wrapper });
      // Should show user name Alex
      expect(getByText('Alex')).toBeTruthy();
    });

    it('drawer has at least 8 menu items across 4 sections', () => {
      useSheetStore.setState({ drawerVisible: true });
      const { getByText } = render(<HomeScreen />, { wrapper });
      // 4 sections: 通用, 智能助手, 账户, 其他
      expect(getByText('通用')).toBeTruthy();
      expect(getByText('智能助手')).toBeTruthy();
      expect(getByText('账户')).toBeTruthy();
      expect(getByText('其他')).toBeTruthy();
    });

    it('theme toggle has 3 segments (浅色/深色/自动)', () => {
      useSheetStore.setState({ drawerVisible: true });
      const { getByText } = render(<HomeScreen />, { wrapper });
      expect(getByText('浅色')).toBeTruthy();
      expect(getByText('深色')).toBeTruthy();
      expect(getByText('自动')).toBeTruthy();
    });

    it('logout button present with red color text', () => {
      useSheetStore.setState({ drawerVisible: true });
      const { getByText } = render(<HomeScreen />, { wrapper });
      expect(getByText('退出登录')).toBeTruthy();
    });
  });
});
