import { render } from '@testing-library/react-native';
import { HomeScreen } from '../../src/screens/HomeScreen';
import { ThemeProvider } from '../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('HomeScreen', () => {
  it('renders without error', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { root } = render(<HomeScreen />, { wrapper }) as any;
    expect(root).toBeTruthy();
  });
});
