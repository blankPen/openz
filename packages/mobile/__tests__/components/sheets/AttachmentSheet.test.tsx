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

  it('renders recent file names (设计稿 attachment.html)', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    expect(getByText('产品架构图_v2.png')).toBeTruthy();
    expect(getByText('竞品分析_Q2.pdf')).toBeTruthy();
    expect(getByText('用户访谈记录.xlsx')).toBeTruthy();
  });

  it('does not render when not visible', () => {
    const { queryByText } = render(<AttachmentSheet visible={false} onClose={jest.fn()} />, { wrapper });
    expect(queryByText('添加附件')).toBeNull();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} testID="attachment-sheet" />, { wrapper });
    expect(getByTestId('attachment-sheet')).toBeTruthy();
  });

  // 设计稿 attachment.html：entry 整体用 surface (#F5F5F7) 背景，
  // entry 内部有 44×44 圆角 12px 的 icon 容器，其背景色是 entry.bg。
  it('renders 本地图片 entry icon with background color #EAF1FF', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const icon = getByTestId('entry-本地图片-icon');
    const style = require('react-native').StyleSheet.flatten(icon.props.style);
    expect(style.backgroundColor?.toUpperCase()).toBe('#EAF1FF');
  });

  it('renders 本地文件 entry icon with background color #FFE8DB', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const icon = getByTestId('entry-本地文件-icon');
    const style = require('react-native').StyleSheet.flatten(icon.props.style);
    expect(style.backgroundColor?.toUpperCase()).toBe('#FFE8DB');
  });

  it('renders 拍照 entry icon with background color #E1F4E9', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const icon = getByTestId('entry-拍照-icon');
    const style = require('react-native').StyleSheet.flatten(icon.props.style);
    expect(style.backgroundColor?.toUpperCase()).toBe('#E1F4E9');
  });

  it('renders 引用回复 entry icon with background color #F0E7FE', () => {
    const { getByTestId } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    const icon = getByTestId('entry-引用回复-icon');
    const style = require('react-native').StyleSheet.flatten(icon.props.style);
    expect(style.backgroundColor?.toUpperCase()).toBe('#F0E7FE');
  });

  it('renders recent files section with file cards (设计稿)', () => {
    const { getByText } = render(<AttachmentSheet visible onClose={jest.fn()} />, { wrapper });
    // 设计稿 3 个文件卡片
    expect(getByText('产品架构图_v2.png')).toBeTruthy();
    expect(getByText('竞品分析_Q2.pdf')).toBeTruthy();
    expect(getByText('用户访谈记录.xlsx')).toBeTruthy();
  });
});
