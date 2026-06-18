import { render } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { WelcomeSection } from '../../../src/components/home/WelcomeSection';
import { ThemeProvider } from '../../../src/ThemeProvider';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider initialMode="light">{children}</ThemeProvider>
);

describe('WelcomeSection', () => {
  it('renders with column layout and center alignment', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const container = getByTestId('welcome-section');
    const style = container.props.style;
    // Find the inner style array - flatten it to check
    const flatStyle = Array.isArray(style) ? style.flat().filter(Boolean) : [style];
    const innerStyle = flatStyle.find((s: any) => s && s.flexDirection !== undefined);
    expect(innerStyle).toBeDefined();
    expect(innerStyle.flexDirection).toBe('column');
    expect(innerStyle.alignItems).toBe('center');
  });

  it('has correct padding: 28px horizontal, 16px bottom', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const container = getByTestId('welcome-section');
    const style = container.props.style;
    const flatStyle = Array.isArray(style) ? style.flat().filter(Boolean) : [style];
    const innerStyle = flatStyle.find((s: any) => s && s.paddingHorizontal !== undefined);
    expect(innerStyle).toBeDefined();
    expect(innerStyle.paddingHorizontal).toBe(28);
    expect(innerStyle.paddingBottom).toBe(16);
  });

  it('renders avatar as first child with 64x64 size', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const container = getByTestId('welcome-section');
    // Avatar is the first child - a View with Avatar label
    const avatarView = container.findAllByType(View)[0];
    expect(avatarView).toBeDefined();
    const style = avatarView.props.style;
    const flatStyle = Array.isArray(style) ? style.flat().filter(Boolean) : [style];
    const sizeStyle = flatStyle.find((s: any) => s && s.width !== undefined);
    expect(sizeStyle).toBeDefined();
    expect(sizeStyle.width).toBe(64);
    expect(sizeStyle.height).toBe(64);
  });

  it('renders greeting text with correct format', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const greeting = getByTestId('welcome-greeting');
    expect(greeting).toBeTruthy();
    // The greeting should contain the full text structure
    const textContent = greeting.props.children;
    // textContent is an array of mixed strings and nested Text elements
    // Check that it starts with greeting format
    const fullText = typeof textContent === 'string'
      ? textContent
      : textContent.map((c: any) => typeof c === 'string' ? c : c.props?.children).join('');
    expect(fullText).toContain('嗨');
    expect(fullText).toContain('Zhang San');
    expect(fullText).toContain('今天要和');
    expect(fullText).toContain('一起做点什么？');
  });

  it('renders accent text "OpenAI" with primary color', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const greeting = getByTestId('welcome-greeting');
    const textContent = greeting.props.children;
    // Find the nested Text element with OpenAI
    const findOpenAI = (content: any): any => {
      if (Array.isArray(content)) {
        for (const c of content) {
          const found = findOpenAI(c);
          if (found) return found;
        }
      } else if (typeof content === 'object' && content?.props?.children === 'OpenZ') {
        return content;
      }
      return null;
    };
    const openAIText = findOpenAI(textContent);
    expect(openAIText).toBeTruthy();
    expect(openAIText.props.style).toBeDefined();
    // The color should reference palette.primary
    const style = openAIText.props.style;
    const flatStyle = Array.isArray(style) ? style.flat() : [style];
    const colorStyle = flatStyle.find((s: any) => s && s.color !== undefined);
    expect(colorStyle).toBeDefined();
    expect(colorStyle.color).toBeDefined();
  });

  it('has correct fontSize and lineHeight on greeting', () => {
    const { getByTestId } = render(<WelcomeSection name="Zhang San" />, { wrapper });
    const greeting = getByTestId('welcome-greeting');
    const style = greeting.props.style;
    const flatStyle = Array.isArray(style) ? style.flat() : [style];
    const innerStyle = flatStyle.find((s: any) => s && s.fontSize !== undefined);
    expect(innerStyle).toBeDefined();
    expect(innerStyle.fontSize).toBe(20);
    expect(innerStyle.lineHeight).toBe(29); // 20 * 1.45 ≈ 29
  });
});
