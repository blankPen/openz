import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ThemeProvider } from '../src/ThemeProvider';
import { BottomSheet } from '../src/components/sheets/BottomSheet';

describe('BottomSheet', () => {
  test('visible=false 时不渲染 children', () => {
    const { queryByTestId } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={false} title="x" onClose={() => {}}>
          <Text testID="content">content</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    expect(queryByTestId('content')).toBeNull();
  });

  test('visible=true 渲染 title 与 children', () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={true} title="切换模型" onClose={() => {}}>
          <Text testID="content">content</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    expect(getByText('切换模型')).toBeTruthy();
    expect(getByTestId('content')).toBeTruthy();
  });

  test('点关闭按钮触发 onClose', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={true} title="x" onClose={onClose}>
          <View />
        </BottomSheet>
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
