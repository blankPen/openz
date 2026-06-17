import { render, fireEvent } from '@testing-library/react-native';
import { Pill } from '../../../src/components/common/Pill';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('Pill', () => {
  it('renders name and meta', () => {
    const { getByText } = render(<Pill name="OpenZ" meta="Z1 思考" />, { wrapper });
    expect(getByText('OpenZ')).toBeTruthy();
    expect(getByText('Z1 思考')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Pill name="OpenZ" onPress={onPress} />, { wrapper });
    fireEvent.press(getByText('OpenZ'));
    expect(onPress).toHaveBeenCalled();
  });
});
