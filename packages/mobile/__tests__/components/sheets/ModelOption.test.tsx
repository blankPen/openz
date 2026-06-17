import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../../src/ThemeProvider';
import { ModelOptionRow } from '../../../src/components/sheets/ModelOption';
import type { ModelOption } from '../../../src/types/chat';

const mockModel: ModelOption = {
  id: 'claude-sonnet-4-20250514',
  name: 'Claude Sonnet 4',
  description: '出色的编程能力，支持多模态，适合复杂任务',
  iconColor: '#FF6B6B',
  iconBg: '#FFF0F0',
  tag: '最新',
  tagColor: '#E6F7FF',
  isPro: false,
};

const mockProModel: ModelOption = {
  id: 'claude-opus-4-20250514',
  name: 'Claude Opus 4',
  description: '最高智能水平，适合高复杂度任务与深度推理',
  iconColor: '#1A66FF',
  iconBg: '#E6F0FF',
  tag: '稳定',
  tagColor: '#E6F7E6',
  isPro: true,
};

describe('ModelOptionRow', () => {
  test('renders model name and description', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockModel} />
      </ThemeProvider>,
    );
    expect(getByText('Claude Sonnet 4')).toBeTruthy();
    expect(getByText('出色的编程能力，支持多模态，适合复杂任务')).toBeTruthy();
  });

  test('renders tag when provided', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockModel} />
      </ThemeProvider>,
    );
    expect(getByText('最新')).toBeTruthy();
  });

  test('renders PRO badge when isPro is true', () => {
    const { getByText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockProModel} />
      </ThemeProvider>,
    );
    expect(getByText('PRO')).toBeTruthy();
  });

  test('does not render PRO badge when isPro is false', () => {
    const { queryByText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockModel} />
      </ThemeProvider>,
    );
    expect(queryByText('PRO')).toBeNull();
  });

  test('renders check icon when selected', () => {
    const { getByRole } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockModel} isSelected={true} />
      </ThemeProvider>,
    );
    const button = getByRole('button');
    expect(button.props.accessibilityState).toEqual({ selected: true });
  });

  test('onPress is called with model when pressed', () => {
    const onPress = jest.fn();
    const { getByLabelText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockModel} onPress={onPress} />
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('Claude Sonnet 4'));
    expect(onPress).toHaveBeenCalledWith(mockModel);
  });

  test('accessibility label includes model name and PRO', () => {
    const { getByLabelText } = render(
      <ThemeProvider initialMode="light">
        <ModelOptionRow model={mockProModel} />
      </ThemeProvider>,
    );
    expect(getByLabelText('Claude Opus 4 Pro')).toBeTruthy();
  });
});
