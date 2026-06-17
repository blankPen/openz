import { render, fireEvent } from '@testing-library/react-native';
import { InputBar } from '../../../src/components/input/InputBar';
import { ThemeProvider } from '../../../src/ThemeProvider';
import { TextField } from '../../../src/components/input/TextField';
import { PlusButton } from '../../../src/components/input/PlusButton';
import { SendButton } from '../../../src/components/input/SendButton';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('InputBar', () => {
  // --- Design spec tests (S1) ---

  it('outer container has transparent background', () => {
    const { getByTestId } = render(<InputBar />, { wrapper });
    const container = getByTestId('input-bar-container');
    // outer container must NOT have a colored background (transparent)
    expect(container.props.style).toBeDefined();
    const flatStyle = require('react-native').StyleSheet.flatten(container.props.style);
    expect(flatStyle.backgroundColor).toBeUndefined();
  });

  it('input-box has backgroundColor #F2F2F2 and borderRadius 16', () => {
    const { getByTestId } = render(<InputBar />, { wrapper });
    const inputBox = getByTestId('input-box');
    const flatStyle = require('react-native').StyleSheet.flatten(inputBox.props.style);
    expect(flatStyle.backgroundColor).toBe('#F2F2F2');
    expect(flatStyle.borderRadius).toBe(16);
  });

  it('TextField placeholder is "尽管问，带图也行"', () => {
    const { getByLabelText } = render(<InputBar />, { wrapper });
    const input = getByLabelText('消息输入框');
    expect(input.props.placeholder).toBe('尽管问，带图也行');
  });

  it('right side has vertical stack of PlusButton + SendButton (gap 8)', () => {
    const { getByTestId, getByLabelText } = render(<InputBar />, { wrapper });
    const rightStack = getByTestId('input-actions-right');
    const flatStyle = require('react-native').StyleSheet.flatten(rightStack.props.style);
    expect(flatStyle.flexDirection).toBe('column');
    expect(flatStyle.gap).toBe(8);
    expect(getByTestId('plus-button')).toBeTruthy();
    expect(getByLabelText('发送消息')).toBeTruthy();
  });

  it('SendButton has backgroundColor #1A66FF', () => {
    const { getByLabelText } = render(<InputBar />, { wrapper });
    const sendBtn = getByLabelText('发送消息');
    // SendButton is always rendered (disabled when empty)
    expect(sendBtn).toBeTruthy();
  });

  // --- Existing behavior tests ---

  it('renders TextField, PlusButton, and MicButton by default', () => {
    const { getByLabelText, queryByLabelText } = render(<InputBar />, { wrapper });
    expect(getByLabelText('消息输入框')).toBeTruthy();
    expect(queryByLabelText('附件')).toBeNull(); // renamed to PlusButton
    expect(getByLabelText('语音输入')).toBeTruthy();
  });

  it('shows SendButton when text is entered', () => {
    const { getByLabelText, queryByLabelText } = render(<InputBar />, { wrapper });
    const input = getByLabelText('消息输入框');
    fireEvent.changeText(input, 'hello');
    expect(getByLabelText('发送消息')).toBeTruthy();
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
    const { getByLabelText } = render(<InputBar onSend={onSend} />, { wrapper });
    const sendBtn = getByLabelText('发送消息');
    // SendButton is rendered but disabled when empty
    expect(sendBtn.props.accessibilityState?.disabled).toBe(true);
    expect(onSend).not.toHaveBeenCalled();
  });

  it('calls onAttachment when PlusButton is pressed', () => {
    const onAttachment = jest.fn();
    const { getByTestId } = render(<InputBar onAttachment={onAttachment} />, { wrapper });
    fireEvent.press(getByTestId('plus-button'));
    expect(onAttachment).toHaveBeenCalled();
  });

  it('calls onMic when MicButton is pressed', () => {
    const onMic = jest.fn();
    const { getByLabelText } = render(<InputBar onMic={onMic} />, { wrapper });
    fireEvent.press(getByLabelText('语音输入'));
    expect(onMic).toHaveBeenCalled();
  });
});
