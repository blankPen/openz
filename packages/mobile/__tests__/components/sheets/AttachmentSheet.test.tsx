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
    expect(getByText('最近文件')).toBeTruthy();
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
});
