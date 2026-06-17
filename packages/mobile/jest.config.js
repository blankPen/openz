module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest-setup.ts'],
  // transformIgnorePatterns 需要兼容 pnpm 的 node_modules 嵌套结构。
  // 模式中增加 (\.pnpm/[^/]+/)?(node_modules/)?,以便在 pnpm 的
  // node_modules/.pnpm/<pkg>@ver/node_modules/<pkg> 路径下,仍能正确
  // 识别允许转译的包(react-native、@react-native、expo 等)。
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/[^/]+/)?(node_modules/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?|@expo-google-fonts|react-navigation|@react-navigation|@unimodules|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
};
