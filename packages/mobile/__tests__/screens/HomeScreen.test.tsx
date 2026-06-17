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
});
