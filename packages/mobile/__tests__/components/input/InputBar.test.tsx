import { render, fireEvent } from '@testing-library/react-native';
import { InputBar } from '../../../src/components/input/InputBar';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('InputBar', () => {
  it('renders TextField, AttachmentButton, and MicButton by default', () => {
    const { getByLabelText } = render(<InputBar />, { wrapper });
    expect(getByLabelText('消息输入框')).toBeTruthy();
    expect(getByLabelText('附件')).toBeTruthy();
    expect(getByLabelText('语音输入')).toBeTruthy();
  });

  it('shows SendButton when text is entered', () => {
    const { getByLabelText, queryByLabelText } = render(<InputBar />, { wrapper });
    const input = getByLabelText('消息输入框');
    fireEvent.changeText(input, 'hello');
    expect(getByLabelText('发送消息')).toBeTruthy();
    expect(queryByLabelText('语音输入')).toBeNull();
  });

  it('calls onSend with trimmed text and clears input', () => {
    const onSend = jest.fn();
    const { getByLabelText } = render(<InputBar onSend={onSend} />, { wrapper });
    const input = getByLabelText('消息输入框');
    fireEvent.changeText(input, '  hello world  ');
    fireEvent.press(getByLabelText('发送消息'));
    expect(onSend).toHaveBeenCalledWith('hello world');
    expect(input.props.value).toBe('');
  });

  it('does not call onSend when text is empty', () => {
    const onSend = jest.fn();
    const { queryByLabelText } = render(<InputBar onSend={onSend} />, { wrapper });
    expect(queryByLabelText('发送消息')).toBeNull();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onAttachment when AttachmentButton is pressed', () => {
    const onAttachment = jest.fn();
    const { getByLabelText } = render(<InputBar onAttachment={onAttachment} />, { wrapper });
    fireEvent.press(getByLabelText('附件'));
    expect(onAttachment).toHaveBeenCalled();
  });

  it('calls onMic when MicButton is pressed', () => {
    const onMic = jest.fn();
    const { getByLabelText } = render(<InputBar onMic={onMic} />, { wrapper });
    fireEvent.press(getByLabelText('语音输入'));
    expect(onMic).toHaveBeenCalled();
  });
});
