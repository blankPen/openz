import { tokens } from '../src/theme/tokens';
import { lightPalette } from '../src/theme/light';
import { darkPalette } from '../src/theme/dark';

describe('theme', () => {
  test('tokens 包含设计稿要求的所有 key', () => {
    expect(tokens.radius).toEqual({ sm: 8, md: 12, lg: 16, xl: 20 });
    expect(tokens.fontSize).toHaveProperty('xxl', 20);
  });

  test('lightPalette 是只读对象,键名与设计稿一致', () => {
    expect(Object.keys(lightPalette).sort()).toEqual(
      ['bg', 'border', 'danger', 'fg', 'fg2', 'fg3', 'primary', 'primary2', 'primarySoft', 'success', 'surface', 'surface2'].sort(),
    );
  });

  test('darkPalette 与 lightPalette 形状完全一致(便于 ThemeProvider 消费)', () => {
    expect(Object.keys(darkPalette).sort()).toEqual(Object.keys(lightPalette).sort());
  });

  test('dark 与 light 的 bg/fg 必须相反', () => {
    expect(lightPalette.bg).toBe('#FFFFFF');
    expect(darkPalette.bg).toBe('#000000');
    expect(lightPalette.fg).toBe('#1C1C1E');
    expect(darkPalette.fg).toBe('#FFFFFF');
  });
});
