import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { WelcomeSection } from '../../../src/components/home/WelcomeSection';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('WelcomeSection', () => {
  it('renders the name', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    expect(getByTestId('welcome-name')).toBeTruthy();
  });

  it('renders avatar with first character of name', () => {
    const { getByText } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    // Avatar label is the first char uppercased
    expect(getByText('Z')).toBeTruthy();
  });

  it('renders subtitle when provided', () => {
    const { getByTestId } = render(
      <WelcomeSection name="Zhang San" subtitle="Software Engineer" />,
      { wrapper },
    );
    expect(getByTestId('welcome-subtitle')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    const { queryByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    expect(queryByTestId('welcome-subtitle')).toBeNull();
  });

  it('uppercases avatar label even if name is lowercase', () => {
    const { getByText } = render(<WelcomeSection name="alice" />, { wrapper });
    expect(getByText('A')).toBeTruthy();
  });
});
