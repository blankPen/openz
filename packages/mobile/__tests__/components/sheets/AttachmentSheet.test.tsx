import { render } from '@testing-library/react-native';
import { AttachmentSheet } from '../../../src/components/sheets/AttachmentSheet';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('AttachmentSheet', () => {
  it('renders sheet title', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('添加附件')).toBeTruthy();
  });

  it('renders all 4 entry items', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('本地图片')).toBeTruthy();
    expect(getByText('本地文件')).toBeTruthy();
    expect(getByText('拍照')).toBeTruthy();
    expect(getByText('引用回复')).toBeTruthy();
  });

  it('renders recent files section', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('最近使用')).toBeTruthy();
  });

  it('renders recent file names', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('项目需求文档.pdf')).toBeTruthy();
    expect(getByText('会议记录-2025-06-01.txt')).toBeTruthy();
    expect(getByText('截图 2025-06-01.png')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<AttachmentSheet visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('添加附件')).toBeNull();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} testID="attachment-sheet" />, { wrapper });
    expect(getByTestId('attachment-sheet')).toBeTruthy();
  });

  // TDD color verification tests - these should FAIL until implementation matches spec
  it('renders 本地图片 entry with correct icon background color #EAF1FF', () => {
    const { getByLabelText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const entry = getByLabelText('本地图片');
    const iconContainer = entry.parent;
    expect(iconContainer).toBeTruthy();
    // The entry Pressable has the background color as the icon container bg
    const style = iconContainer.props.style;
    // Find the backgroundColor - it should be #EAF1FF for 本地图片
    const bgColor = findBackgroundColor(style);
    expect(bgColor?.toUpperCase()).toBe('#EAF1FF');
  });

  it('renders 本地文件 entry with correct icon background color #FFE8DB', () => {
    const { getByLabelText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const entry = getByLabelText('本地文件');
    const iconContainer = entry.parent;
    expect(iconContainer).toBeTruthy();
    const style = iconContainer.props.style;
    const bgColor = findBackgroundColor(style);
    expect(bgColor?.toUpperCase()).toBe('#FFE8DB');
  });

  it('renders 拍照 entry with correct icon background color #E1F4E9', () => {
    const { getByLabelText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const entry = getByLabelText('拍照');
    const iconContainer = entry.parent;
    expect(iconContainer).toBeTruthy();
    const style = iconContainer.props.style;
    const bgColor = findBackgroundColor(style);
    expect(bgColor?.toUpperCase()).toBe('#E1F4E9');
  });

  it('renders 引用回复 entry with correct icon background color #F0E7FE', () => {
    const { getByLabelText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const entry = getByLabelText('引用回复');
    const iconContainer = entry.parent;
    expect(iconContainer).toBeTruthy();
    const style = iconContainer.props.style;
    const bgColor = findBackgroundColor(style);
    expect(bgColor?.toUpperCase()).toBe('#F0E7FE');
  });

  it('renders recent files section with file cards', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    // Verify 3 file cards exist
    expect(getByText('项目需求文档.pdf')).toBeTruthy();
    expect(getByText('会议记录-2025-06-01.txt')).toBeTruthy();
    expect(getByText('截图 2025-06-01.png')).toBeTruthy();
  });
});

// Helper to extract backgroundColor from nested style arrays
function findBackgroundColor(style: any): string | undefined {
  if (!style) return undefined;
  if (Array.isArray(style)) {
    for (const s of style) {
      const found = findBackgroundColor(s);
      if (found) return found;
    }
    return undefined;
  }
  if (style && typeof style === 'object' && style.backgroundColor) {
    return style.backgroundColor;
  }
  return undefined;
}
