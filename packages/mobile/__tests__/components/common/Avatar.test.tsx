import { render } from '@testing-library/react-native';
import { Avatar } from '../../../src/components/common/Avatar';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('Avatar', () => {
  it('renders with given label', () => {
    const { getByText } = render(<Avatar label="Z" />, { wrapper });
    expect(getByText('Z')).toBeTruthy();
  });

  it('renders with custom size', () => {
    const { getByText } = render(<Avatar label="A" size={48} />, { wrapper });
    expect(getByText('A')).toBeTruthy();
  });
});
