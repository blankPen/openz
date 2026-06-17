// 基础 token:圆角、间距、字号。颜色走 palette。
export const tokens = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  fontSize: { xs: 11, sm: 12, md: 14, lg: 15, xl: 17, xxl: 20 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type Tokens = typeof tokens;
