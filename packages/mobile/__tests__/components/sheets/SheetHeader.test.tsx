import { render, fireEvent } from '@testing-library/react-native';
import { SheetHeader } from '../../../src/components/sheets/SheetHeader';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('SheetHeader', () => {
  it('renders title', () => {
    const { getByText } = render(<SheetHeader title="Test Title" />, { wrapper });
    expect(getByText('Test Title')).toBeTruthy();
  });

  it('renders close button when onClose is provided', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(<SheetHeader title="Test" onClose={onClose} />, { wrapper });
    expect(getByLabelText('关闭')).toBeTruthy();
    fireEvent.press(getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalled();
  });

  it('renders left icon when leftIcon is provided', () => {
    const onLeftPress = jest.fn();
    const { getByLabelText } = render(
      <SheetHeader title="Test" leftIcon="chevDown" onLeftPress={onLeftPress} />,
      { wrapper }
    );
    expect(getByLabelText('Test-left')).toBeTruthy();
    fireEvent.press(getByLabelText('Test-left'));
    expect(onLeftPress).toHaveBeenCalled();
  });

  it('renders right icon when rightIcon is provided', () => {
    const onRightPress = jest.fn();
    const { getByLabelText } = render(
      <SheetHeader title="Test" rightIcon="share" onRightPress={onRightPress} />,
      { wrapper }
    );
    expect(getByLabelText('Test-right')).toBeTruthy();
    fireEvent.press(getByLabelText('Test-right'));
    expect(onRightPress).toHaveBeenCalled();
  });

  it('prefers rightIcon over close when both are provided', () => {
    const onClose = jest.fn();
    const onRightPress = jest.fn();
    const { getByLabelText, queryByLabelText } = render(
      <SheetHeader title="Test" rightIcon="copy" onRightPress={onRightPress} onClose={onClose} />,
      { wrapper }
    );
    expect(getByLabelText('Test-right')).toBeTruthy();
    expect(queryByLabelText('关闭')).toBeNull();
    fireEvent.press(getByLabelText('Test-right'));
    expect(onRightPress).toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('renders with testID', () => {
    const { getByTestId } = render(<SheetHeader title="Test" testID="sheet-header" />, { wrapper });
    expect(getByTestId('sheet-header')).toBeTruthy();
  });
});
