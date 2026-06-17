// 浅色调色板,从设计稿 home.html :root 提取
export const lightPalette = {
  bg: '#FFFFFF',
  surface: '#F5F5F7',
  surface2: '#EDEDF0',
  border: '#E5E5EA',
  fg: '#1C1C1E',
  fg2: '#3C3C43',
  fg3: '#8E8E93',
  primary: '#1A66FF',
  primary2: '#1452CC',
  primarySoft: '#EAF1FF',
  danger: '#FF3B30',
  success: '#34C759',
} as const;

// Palette 仅描述键与值类型(string),不锁定具体十六进制值。
// 这样 darkPalette 才能在结构一致的前提下提供不同颜色。
export type Palette = { readonly [K in keyof typeof lightPalette]: string };
