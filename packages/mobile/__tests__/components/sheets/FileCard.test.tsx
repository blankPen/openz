import { render } from '@testing-library/react-native';
import { FileCard } from '../../../src/components/sheets/FileCard';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('FileCard', () => {
  it('renders file name and path', () => {
    const { getByText } = render(
      <FileCard name="example.ts" path="/src/utils/example.ts" />,
      { wrapper }
    );
    expect(getByText('example.ts')).toBeTruthy();
    expect(getByText('/src/utils/example.ts')).toBeTruthy();
  });

  it('renders size when provided', () => {
    const { getByText } = render(
      <FileCard name="example.ts" path="/src/utils/example.ts" size="1.2KB" />,
      { wrapper }
    );
    expect(getByText('1.2KB')).toBeTruthy();
  });

  it('renders without size when not provided', () => {
    const { queryByText, getByText } = render(
      <FileCard name="example.ts" path="/src/utils/example.ts" />,
      { wrapper }
    );
    expect(getByText('example.ts')).toBeTruthy();
    expect(queryByText('1.2KB')).toBeNull();
  });
});
