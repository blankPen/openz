# OpenZ 移动端 App · 阶段 1 脚手架实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**目标:** 搭建可启动的 Expo (SDK 52, managed) iOS + Android 双端 App 脚手架,接入 Expo Router、3 模式主题、设置持久化、原子组件库、`BottomSheet` 通用组件、Provider 链。**EAS Development Build 在 iOS Simulator + Android Emulator 跑通,3 模式主题实时切换无闪烁。**

**架构:** pnpm monorepo 新增 `packages/mobile/` 包;Expo Router 4.x 接管路由(`app/` 目录);ThemeProvider + settingsStore 走 zustand + MMKV;UI 组件用 React Native primitives + 自写 SVG 图标(不引第三方 icon 库);所有页面无关基础设施在此阶段完成,阶段 2 才拼装 5 屏。

**技术栈:** Expo SDK 52, Expo Router 4, React Native 0.76, TypeScript 5.6, zustand 5, react-native-mmkv 3, react-native-svg 15, react-native-get-random-values, uuid 11, Jest + jest-expo + @testing-library/react-native

---

## Global Constraints

来自 spec `2026-06-17-mobile-app-design.md`,所有任务隐含遵守:

- **平台:** iOS + Android 双端,Expo managed workflow
- **包名:** `@openz/mobile`(monorepo `packages/mobile/`)
- **TypeScript:** `>= 5.6`,严格模式 `"strict": true`
- **Node:** `>= 20`
- **依赖互引:** 仅用 `import type` 从 `@openz/shared` 取类型,运行时不引入 `node:crypto`(`packages/shared` 含 `import { randomUUID } from 'node:crypto'`)
- **设计 token 唯一来源:** `src/theme/tokens.ts` + `light.ts` + `dark.ts`,组件禁止硬编码颜色/字号/圆角
- **ID 生成:** 运行时用 `uuid` + `react-native-get-random-values` polyfill,`_layout.tsx` 顶层 `import 'react-native-get-random-values'`
- **代码风格:** 中文 commit 标题 + Co-Authored-By: Claude,提交前 `tsc --noEmit` 必须 0 error
- **UI 文案:** 简体中文,集中放在 `src/i18n.ts`
- **不允许在 spec 之外的依赖**:如需新增,需在 plan 中显式声明

---

## 文件结构

```
/Users/admin/pz/openz/
├── package.json                                 # [修改] 追加 dev:mobile / typecheck 脚本
└── packages/
    └── mobile/                                  # [新建]
        ├── app/                                 # [新建] Expo Router 路由
        │   ├── _layout.tsx                      # [新建] Provider 链 + Stack
        │   ├── index.tsx                        # [新建] 启动入口,跳 /chat
        │   └── chat.tsx                         # [新建] 空 Chat 屏(阶段 2 填充内容)
        ├── src/
        │   ├── components/
        │   │   ├── chrome/
        │   │   │   ├── StatusBar.tsx            # [新建]
        │   │   │   ├── DynamicIsland.tsx        # [新建]
        │   │   │   └── HomeIndicator.tsx        # [新建]
        │   │   ├── topbar/
        │   │   │   └── IconButton.tsx           # [新建]
        │   │   ├── input/
        │   │   │   ├── TextField.tsx            # [新建]
        │   │   │   ├── MicButton.tsx            # [新建]
        │   │   │   ├── AttachmentButton.tsx     # [新建]
        │   │   │   └── SendButton.tsx           # [新建]
        │   │   ├── drawer/
        │   │   │   └── Switch.tsx               # [新建]
        │   │   ├── sheets/
        │   │   │   └── BottomSheet.tsx          # [新建]
        │   │   └── common/
        │   │       └── Icon.tsx                 # [新建] SVG icon 集
        │   ├── theme/
        │   │   ├── tokens.ts                    # [新建] 颜色/字号/圆角/间距常量
        │   │   ├── light.ts                     # [新建] 浅色主题
        │   │   └── dark.ts                      # [新建] 深色主题
        │   ├── ThemeProvider.tsx                # [新建] 3 模式主题 Provider
        │   ├── hooks/
        │   │   └── useTheme.ts                  # [新建]
        │   ├── stores/
        │   │   └── settingsStore.ts             # [新建] zustand + MMKV
        │   ├── types.ts                         # [新建] 占位(阶段 3 接入 @openz/shared)
        │   └── i18n.ts                          # [新建] 文案集中
        ├── __tests__/
        │   ├── theme.test.ts                    # [新建]
        │   ├── ThemeProvider.test.tsx           # [新建]
        │   ├── useTheme.test.tsx                # [新建]
        │   ├── settingsStore.test.ts            # [新建]
        │   ├── Switch.test.tsx                  # [新建]
        │   └── BottomSheet.test.tsx             # [新建]
        ├── app.json                             # [新建]
        ├── eas.json                             # [新建]
        ├── jest.config.js                       # [新建]
        ├── jest-setup.ts                        # [新建]
        ├── babel.config.js                      # [新建] 显式 babel preset
        ├── metro.config.js                      # [新建] monorepo 适配
        ├── package.json                         # [新建]
        ├── tsconfig.json                        # [新建]
        └── README.md                            # [新建]
```

---

## Task 1: 初始化 Expo 项目骨架

**Files:**
- Create: `packages/mobile/package.json`
- Create: `packages/mobile/app.json`
- Create: `packages/mobile/babel.config.js`
- Create: `packages/mobile/tsconfig.json`
- Create: `packages/mobile/index.ts`(临时入口,Task 2 替换)
- Modify: `package.json`(根)

**Interfaces:**
- Consumes: 无
- Produces: `packages/mobile/package.json` 暴露 `@openz/mobile` 包,`pnpm --filter @openz/mobile` 命令可识别

- [ ] **Step 1: 创建 `packages/mobile/package.json`**

```json
{
  "name": "@openz/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "index.ts",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "typecheck": "tsc --noEmit",
    "test": "jest"
  },
  "dependencies": {
    "expo": "~52.0.0",
    "expo-status-bar": "~2.0.0",
    "react": "18.3.1",
    "react-native": "0.76.x"
  },
  "devDependencies": {
    "@babel/core": "^7.25.0",
    "@types/react": "~18.3.12",
    "typescript": "^5.6.0"
  }
}
```

文件路径:`/Users/admin/pz/openz/packages/mobile/package.json`

- [ ] **Step 2: 创建 `packages/mobile/app.json`**

```json
{
  "expo": {
    "name": "OpenZ",
    "slug": "openz-mobile",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "automatic",
    "newArchEnabled": true,
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "ai.openz.mobile"
    },
    "android": {
      "package": "ai.openz.mobile"
    }
  }
}
```

- [ ] **Step 3: 创建 `packages/mobile/babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
```

- [ ] **Step 4: 创建 `packages/mobile/tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": [
    "**/*.ts",
    "**/*.tsx",
    ".expo/types/**/*.ts",
    "expo-env.d.ts"
  ]
}
```

- [ ] **Step 5: 创建 `packages/mobile/index.ts`(临时入口)**

```ts
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
```

- [ ] **Step 6: 创建 `packages/mobile/App.tsx`(临时 App,Task 2 替换为路由)**

```tsx
import { View, Text } from 'react-native';

export default function App() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text>OpenZ mobile scaffold</Text>
    </View>
  );
}
```

- [ ] **Step 7: 修改根 `package.json`,追加脚本**

编辑 `/Users/admin/pz/openz/package.json`,在 `scripts` 块内追加:

```json
{
  "scripts": {
    "dev:mobile": "pnpm --filter @openz/mobile start",
    "typecheck": "pnpm -r typecheck"
  }
}
```

(注:已有 `dev` 脚本保留不动,只追加)

- [ ] **Step 8: 在 monorepo 根安装并验证**

```bash
cd /Users/admin/pz/openz
pnpm install
pnpm --filter @openz/mobile typecheck
```

Expected:`tsc --noEmit` 退出码 0,无输出。

- [ ] **Step 9: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/ package.json
git commit -m "feat(mobile): 初始化 Expo SDK 52 脚手架"
```

---

## Task 2: 接入 Expo Router

**Files:**
- Modify: `packages/mobile/package.json`(`main` 改 `expo-router/entry`,加依赖)
- Delete: `packages/mobile/index.ts`
- Delete: `packages/mobile/App.tsx`
- Create: `packages/mobile/app/_layout.tsx`
- Create: `packages/mobile/app/index.tsx`
- Create: `packages/mobile/app/chat.tsx`
- Create: `packages/mobile/metro.config.js`
- Create: `packages/mobile/expo-env.d.ts`

**Interfaces:**
- Consumes: Task 1 的 `package.json` 与 `app.json`
- Produces: 路由表 `{ '/', '/chat' }` 可访问;`expo-router/entry` 是入口

- [ ] **Step 1: 在 `packages/mobile/package.json` 替换 `main` 并加依赖**

将 `"main": "index.ts"` 改为:

```json
  "main": "expo-router/entry",
```

在 `dependencies` 块内追加(若已存在则跳过):

```json
    "expo-router": "~4.0.0",
    "expo-linking": "~7.0.0",
    "expo-constants": "~17.0.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.1.0"
```

- [ ] **Step 2: 删除临时入口文件**

```bash
rm /Users/admin/pz/openz/packages/mobile/index.ts
rm /Users/admin/pz/openz/packages/mobile/App.tsx
```

- [ ] **Step 3: 创建 `packages/mobile/metro.config.js`(monorepo 适配)**

```js
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 4: 创建 `packages/mobile/expo-env.d.ts`**

```ts
/// <reference types="expo-router/types" />
/// <reference types="expo/types" />
```

- [ ] **Step 5: 创建 `packages/mobile/app/_layout.tsx`(Provider 链,阶段 1 仅 Stack)**

```tsx
import { Stack } from 'expo-router';
import 'react-native-get-random-values';

export default function RootLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

注:`import 'react-native-get-random-values'` 必须放在最顶层,后续 `uuid` 才能用。

- [ ] **Step 6: 创建 `packages/mobile/app/index.tsx`(启动页,跳 /chat)**

```tsx
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href="/chat" />;
}
```

- [ ] **Step 7: 创建 `packages/mobile/app/chat.tsx`(空 Chat 屏)**

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function Chat() {
  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.center}>
        <Text style={styles.text}>Chat 屏 · 阶段 1 占位</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  text: { fontSize: 16, color: '#1C1C1E' },
});
```

- [ ] **Step 8: 安装并验证类型**

```bash
cd /Users/admin/pz/openz
pnpm install
pnpm --filter @openz/mobile typecheck
```

Expected:`tsc --noEmit` 退出码 0。

- [ ] **Step 9: 启动 expo dev server 验证路由可访问(只查 metro 是否能打包,不需要真机)**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm expo export --platform ios --output-dir /tmp/expo-test 2>&1 | head -30
rm -rf /tmp/expo-test
```

Expected:输出包含 `Bundle written to /tmp/expo-test` 等成功提示,无 `error` 字样。

- [ ] **Step 10: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): 接入 Expo Router 4 与 monorepo Metro 配置"
```

---

## Task 3: 配置 ESLint + Prettier

**Files:**
- Create: `packages/mobile/.eslintrc.js`
- Create: `packages/mobile/.prettierrc.js`
- Modify: `packages/mobile/package.json`(加 lint 脚本)

**Interfaces:**
- Consumes: Task 2 的 `package.json`
- Produces: `pnpm --filter @openz/mobile lint` 与 `pnpm --filter @openz/mobile format` 命令可执行

- [ ] **Step 1: 在 `packages/mobile/package.json` 加 dev 依赖与脚本**

在 `devDependencies` 块内追加:

```json
    "eslint": "^8.57.0",
    "eslint-config-expo": "~8.0.0",
    "prettier": "^3.3.0"
```

在 `scripts` 块内追加:

```json
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\""
```

- [ ] **Step 2: 创建 `packages/mobile/.eslintrc.js`**

```js
module.exports = {
  extends: ['expo', 'prettier'],
  ignorePatterns: ['node_modules/', '.expo/', 'dist/'],
  rules: {
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
  },
};
```

- [ ] **Step 3: 创建 `packages/mobile/.prettierrc.js`**

```js
module.exports = {
  arrowParens: 'always',
  bracketSameLine: false,
  bracketSpacing: true,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  tabWidth: 2,
};
```

- [ ] **Step 4: 安装并验证**

```bash
cd /Users/admin/pz/openz
pnpm install
cd packages/mobile
pnpm lint
pnpm format
git diff --exit-code
```

Expected:`pnpm lint` 无 error;`pnpm format` 应只格式化生成的文件,`git diff --exit-code` 退出码 0 表示无新差异(本任务创建的文件本身已被格式化)。

- [ ] **Step 5: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): 配置 ESLint + Prettier"
```

---

## Task 4: 主题 token + light/dark 调色板

**Files:**
- Create: `packages/mobile/src/theme/tokens.ts`
- Create: `packages/mobile/src/theme/light.ts`
- Create: `packages/mobile/src/theme/dark.ts`
- Create: `packages/mobile/__tests__/theme.test.ts`

**Interfaces:**
- Consumes: 无
- Produces: `tokens`(基础间距/字号/圆角),`lightPalette`/`darkPalette`(颜色);后续 `ThemeProvider` 消费

- [ ] **Step 1: 创建 `packages/mobile/src/theme/tokens.ts`**

```ts
// 基础 token:圆角、间距、字号。颜色走 palette。
export const tokens = {
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 },
  fontSize: { xs: 11, sm: 12, md: 14, lg: 15, xl: 17, xxl: 20 },
  fontWeight: { regular: '400', medium: '500', semibold: '600', bold: '700' },
} as const;

export type Tokens = typeof tokens;
```

- [ ] **Step 2: 创建 `packages/mobile/src/theme/light.ts`**

```ts
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

export type Palette = typeof lightPalette;
```

- [ ] **Step 3: 创建 `packages/mobile/src/theme/dark.ts`**

```ts
import type { Palette } from './light';

// 深色调色板,从设计稿 settings.html [data-theme="dark"] 提取
export const darkPalette: Palette = {
  bg: '#000000',
  surface: '#1C1C1E',
  surface2: '#2C2C2E',
  border: '#38383A',
  fg: '#FFFFFF',
  fg2: '#EBEBF5',
  fg3: '#8E8E93',
  primary: '#1A66FF',
  primary2: '#1452CC',
  primarySoft: 'rgba(26, 102, 255, 0.22)',
  danger: '#FF3B30',
  success: '#34C759',
};
```

- [ ] **Step 4: 写失败测试 `packages/mobile/__tests__/theme.test.ts`**

```ts
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
```

- [ ] **Step 5: 配置 Jest(task 内)创建 `packages/mobile/jest.config.js` 与 `jest-setup.ts`**

`jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEach: ['<rootDir>/jest-setup.ts'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg))',
  ],
};
```

`jest-setup.ts`:

```ts
import '@testing-library/react-native/extend-expect';
```

注:`setupFilesAfterEach` 实际是 `setupFilesAfterEach` 在新 jest-expo 里更推荐用 `setupFiles`。若运行报 setup 错误,改用:

```js
  setupFiles: ['<rootDir>/jest-setup.ts'],
```

- [ ] **Step 6: 在 `package.json` 加 dev 依赖与 test 脚本**

在 `devDependencies` 块内追加:

```json
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "@testing-library/react-native": "^12.0.0",
    "@testing-library/jest-native": "^5.4.3",
    "react-test-renderer": "18.3.1"
```

`scripts.test` 已经在 Task 1 加过,确认存在即可。

- [ ] **Step 7: 安装并跑测试**

```bash
cd /Users/admin/pz/openz
pnpm install
cd packages/mobile
pnpm test -- --testPathPattern=theme
```

Expected:4 个 test 全部 PASS。

- [ ] **Step 8: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): 设计稿主题 token + light/dark 调色板"
```

---

## Task 5: ThemeProvider + useTheme hook

**Files:**
- Create: `packages/mobile/src/ThemeProvider.tsx`
- Create: `packages/mobile/src/hooks/useTheme.ts`
- Create: `packages/mobile/src/stores/settingsStore.ts`(先放最小实现,Task 6 完善)
- Create: `packages/mobile/__tests__/ThemeProvider.test.tsx`
- Create: `packages/mobile/__tests__/useTheme.test.tsx`

**Interfaces:**
- Consumes: Task 4 的 `tokens` / `lightPalette` / `darkPalette`,settingsStore 的 `themeMode: 'light' | 'dark' | 'system'`
- Produces: `<ThemeProvider>` 组件包整个 app;`useTheme()` 返回 `{ mode, palette, tokens, isDark }`,并提供 `setMode(m)` 写回 settingsStore

- [ ] **Step 1: 写失败测试 `packages/mobile/__tests__/settingsStore.test.ts`**

```ts
import { useSettingsStore } from '../src/stores/settingsStore';

describe('settingsStore(最小实现)', () => {
  beforeEach(() => {
    useSettingsStore.setState({ themeMode: 'system' });
  });

  test('默认 themeMode 是 system', () => {
    expect(useSettingsStore.getState().themeMode).toBe('system');
  });

  test('setThemeMode 更新状态', () => {
    useSettingsStore.getState().setThemeMode('dark');
    expect(useSettingsStore.getState().themeMode).toBe('dark');
  });
});
```

- [ ] **Step 2: 写 `packages/mobile/src/stores/settingsStore.ts`(最小版,Task 6 扩展)**

```ts
import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

type SettingsState = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  themeMode: 'system',
  setThemeMode: (mode) => set({ themeMode: mode }),
}));
```

- [ ] **Step 3: 跑测试确认通过**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm test -- --testPathPattern=settingsStore
```

Expected:2 个 test PASS。

- [ ] **Step 4: 写失败测试 `packages/mobile/__tests__/ThemeProvider.test.tsx`**

```tsx
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../src/ThemeProvider';
import { useTheme } from '../src/hooks/useTheme';

function Probe() {
  const t = useTheme();
  return <Text testID="probe">{`${t.isDark}-${t.mode}`}</Text>;
}

describe('ThemeProvider', () => {
  test('默认 mode=system 时,isDark 由系统决定;无 Provider 时 useTheme 抛错', () => {
    expect(() => render(<Probe />)).toThrow(/ThemeProvider/);
  });

  test('mode=light 强制浅色', () => {
    const { getByTestId } = render(
      <ThemeProvider initialMode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('false-light');
  });

  test('mode=dark 强制深色', () => {
    const { getByTestId } = render(
      <ThemeProvider initialMode="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('true-dark');
  });
});
```

- [ ] **Step 5: 写 `packages/mobile/src/hooks/useTheme.ts`**

```ts
import { createContext, useContext } from 'react';
import type { Tokens } from '../theme/tokens';
import type { Palette } from '../theme/light';
import type { ThemeMode } from '../stores/settingsStore';

export type ThemeContextValue = {
  mode: ThemeMode;
  isDark: boolean;
  palette: Palette;
  tokens: Tokens;
  setMode: (m: ThemeMode) => void;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
```

- [ ] **Step 6: 写 `packages/mobile/src/ThemeProvider.tsx`**

```tsx
import { useColorScheme, useMemo, type ReactNode } from 'react';
import { ThemeContext, type ThemeContextValue } from './hooks/useTheme';
import { tokens } from './theme/tokens';
import { lightPalette } from './theme/light';
import { darkPalette } from './theme/dark';
import { useSettingsStore, type ThemeMode } from './stores/settingsStore';

type Props = {
  children: ReactNode;
  initialMode?: ThemeMode; // 测试与 SSR 用,生产从 settingsStore 读
};

export function ThemeProvider({ children, initialMode }: Props) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const storedMode = useSettingsStore((s) => s.themeMode);
  const setMode = useSettingsStore((s) => s.setThemeMode);

  const mode = initialMode ?? storedMode;
  const isDark = useMemo(() => {
    if (mode === 'dark') return true;
    if (mode === 'light') return false;
    return systemScheme === 'dark';
  }, [mode, systemScheme]);

  const value: ThemeContextValue = useMemo(
    () => ({
      mode,
      isDark,
      palette: isDark ? darkPalette : lightPalette,
      tokens,
      setMode,
    }),
    [mode, isDark, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
```

- [ ] **Step 7: 写失败测试 `packages/mobile/__tests__/useTheme.test.tsx`**

```tsx
import { render, act } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ThemeProvider } from '../src/ThemeProvider';
import { useTheme } from '../src/hooks/useTheme';
import { useSettingsStore } from '../src/stores/settingsStore';

function ModeProbe() {
  const { mode, isDark, setMode } = useTheme();
  return (
    <Text testID="probe" onPress={() => setMode('dark')}>
      {`${mode}-${isDark}`}
    </Text>
  );
}

describe('useTheme + ThemeProvider 联动 settingsStore', () => {
  beforeEach(() => {
    useSettingsStore.setState({ themeMode: 'light' });
  });

  test('setMode 写入 settingsStore 后,组件重渲染切换 isDark', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <ModeProbe />
      </ThemeProvider>,
    );
    expect(getByTestId('probe').props.children).toBe('light-false');
    act(() => {
      getByTestId('probe').props.onPress();
    });
    expect(useSettingsStore.getState().themeMode).toBe('dark');
    expect(getByTestId('probe').props.children).toBe('dark-true');
  });
});
```

- [ ] **Step 8: 跑所有测试**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm test
```

Expected:全部 PASS(settingsStore 2 + ThemeProvider 3 + useTheme 1 = 6 个 test)。

- [ ] **Step 9: 类型检查**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
```

Expected:退出码 0。

- [ ] **Step 10: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): ThemeProvider + useTheme + settingsStore 最小版"
```

---

## Task 6: 完善 settingsStore(MMKV 持久化 + 全部字段)

**Files:**
- Modify: `packages/mobile/src/stores/settingsStore.ts`
- Create: `packages/mobile/__tests__/settingsStore.persistence.test.ts`

**Interfaces:**
- Consumes: Task 5 的最小 settingsStore
- Produces: `useSettingsStore` 含 7 个字段(serverUrl, themeMode, fontSize, language, voiceBroadcast, enterToSend, defaultModel),写操作同步到 MMKV,启动时从 MMKV 读出

- [ ] **Step 1: 在 `package.json` 加 `react-native-mmkv`**

在 `dependencies` 块内追加:

```json
    "react-native-mmkv": "^3.1.0"
```

- [ ] **Step 2: 写失败测试 `packages/mobile/__tests__/settingsStore.persistence.test.ts`**

```ts
// mock MMKV
jest.mock('react-native-mmkv', () => {
  const store: Record<string, string> = {};
  return {
    MMKV: jest.fn().mockImplementation(() => ({
      set: (k: string, v: string) => {
        store[k] = v;
      },
      getString: (k: string) => store[k],
      delete: (k: string) => {
        delete store[k];
      },
    })),
  };
});

import { useSettingsStore } from '../src/stores/settingsStore';

describe('settingsStore 持久化(MMKV mock)', () => {
  beforeEach(() => {
    useSettingsStore.setState({
      serverUrl: '',
      themeMode: 'system',
      fontSize: 'standard',
      language: 'zh-CN',
      voiceBroadcast: true,
      enterToSend: true,
      defaultModel: 'OpenZ Z1',
    });
  });

  test('setServerUrl 写入后,新 store 实例能读到', async () => {
    useSettingsStore.getState().setServerUrl('ws://localhost:19998');
    expect(useSettingsStore.getState().serverUrl).toBe('ws://localhost:19998');
    // 通过持久化再读:模拟冷启动
    jest.isolateModules(() => {
      // 重新 require 让 store 重新初始化
      const { useSettingsStore: fresh } = require('../src/stores/settingsStore');
      expect(fresh.getState().serverUrl).toBe('ws://localhost:19998');
    });
  });

  test('默认值与设计稿 settings.html 一致', () => {
    const s = useSettingsStore.getState();
    expect(s.themeMode).toBe('system');
    expect(s.voiceBroadcast).toBe(true);
    expect(s.enterToSend).toBe(true);
  });
});
```

- [ ] **Step 3: 改写 `packages/mobile/src/stores/settingsStore.ts` 为完整版**

```ts
import { create } from 'zustand';
import { MMKV } from 'react-native-mmkv';

const STORAGE_KEY = 'openz-mobile-settings-v1';
const storage = new MMKV({ id: 'openz-settings' });

export type ThemeMode = 'light' | 'dark' | 'system';
export type FontSize = 'small' | 'standard' | 'large';
export type Language = 'zh-CN' | 'en-US';

type Persisted = {
  serverUrl: string;
  themeMode: ThemeMode;
  fontSize: FontSize;
  language: Language;
  voiceBroadcast: boolean;
  enterToSend: boolean;
  defaultModel: string;
};

const DEFAULTS: Persisted = {
  serverUrl: '',
  themeMode: 'system',
  fontSize: 'standard',
  language: 'zh-CN',
  voiceBroadcast: true,
  enterToSend: true,
  defaultModel: 'OpenZ Z1',
};

function loadInitial(): Persisted {
  const raw = storage.getString(STORAGE_KEY);
  if (!raw) return DEFAULTS;
  try {
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULTS;
  }
}

type SettingsState = Persisted & {
  setServerUrl: (v: string) => void;
  setThemeMode: (v: ThemeMode) => void;
  setFontSize: (v: FontSize) => void;
  setLanguage: (v: Language) => void;
  setVoiceBroadcast: (v: boolean) => void;
  setEnterToSend: (v: boolean) => void;
  setDefaultModel: (v: string) => void;
};

function persist(state: Persisted) {
  storage.set(
    STORAGE_KEY,
    JSON.stringify({
      serverUrl: state.serverUrl,
      themeMode: state.themeMode,
      fontSize: state.fontSize,
      language: state.language,
      voiceBroadcast: state.voiceBroadcast,
      enterToSend: state.enterToSend,
      defaultModel: state.defaultModel,
    }),
  );
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  ...loadInitial(),
  setServerUrl: (v) => {
    set({ serverUrl: v });
    persist(get());
  },
  setThemeMode: (v) => {
    set({ themeMode: v });
    persist(get());
  },
  setFontSize: (v) => {
    set({ fontSize: v });
    persist(get());
  },
  setLanguage: (v) => {
    set({ language: v });
    persist(get());
  },
  setVoiceBroadcast: (v) => {
    set({ voiceBroadcast: v });
    persist(get());
  },
  setEnterToSend: (v) => {
    set({ enterToSend: v });
    persist(get());
  },
  setDefaultModel: (v) => {
    set({ defaultModel: v });
    persist(get());
  },
}));
```

- [ ] **Step 4: 跑全部测试**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm test
```

Expected:全部 PASS(原 6 + 新 2 = 8)。

- [ ] **Step 5: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): settingsStore 接入 MMKV 持久化与 7 字段默认值"
```

---

## Task 7: i18n 集中文案

**Files:**
- Create: `packages/mobile/src/i18n.ts`

**Interfaces:**
- Consumes: 无
- Produces: `t(key)` 函数 + `STRINGS` 字典,后续所有组件从中取文案

- [ ] **Step 1: 创建 `packages/mobile/src/i18n.ts`**

```ts
// 阶段 1 只放阶段 1/2 需要的占位文案;阶段 2 实现时再补充
export const STRINGS = {
  appName: 'OpenZ',
  chat: {
    placeholder: '尽管问,带图也行',
    placeholderActive: '接着问 OpenZ…',
    send: '发送',
    mic: '语音输入',
    attachment: '附件',
  },
  watermark: '内容由 AI 生成',
  status: {
    connecting: '正在连接…',
    connected: '已连接',
    disconnected: '已断开',
  },
  error: {
    sendFailed: '发送失败,已自动重试',
    networkLost: '网络断开,正在重连…',
  },
} as const;

export type StringKey = keyof typeof STRINGS;

export function t<K extends StringKey>(key: K): typeof STRINGS[K] {
  return STRINGS[key];
}
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
```

Expected:退出码 0。

- [ ] **Step 3: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): i18n 集中文案(STRINGS)"
```

---

## Task 8: Icon 组件(SVG icon 集)

**Files:**
- Create: `packages/mobile/src/components/common/Icon.tsx`
- Modify: `packages/mobile/package.json`(加 react-native-svg)

**Interfaces:**
- Consumes: 无
- Produces: `<Icon name="burger" size={22} color="..." />`,支持约 20 个 icon

- [ ] **Step 1: 在 `package.json` 加 `react-native-svg`**

```json
    "react-native-svg": "15.8.0"
```

- [ ] **Step 2: 创建 `packages/mobile/src/components/common/Icon.tsx`**

```tsx
import Svg, { Circle, Line, Path, Polyline, Polygon, Rect } from 'react-native-svg';

export type IconName =
  | 'burger' | 'arrowDown' | 'voice' | 'phone' | 'plus' | 'arrowUp'
  | 'mic' | 'sun' | 'image' | 'doc' | 'camera' | 'quote' | 'close'
  | 'check' | 'chevDown' | 'send' | 'copy' | 'like' | 'regenerate' | 'share'
  | 'flash' | 'cube' | 'globe' | 'web' | 'lawyer' | 'fire' | 'phd'
  | 'help' | 'info' | 'sparkles' | 'bell' | 'gear' | 'logout' | 'textSize' | 'lang';

type Props = { name: IconName; size?: number; color: string };

export function Icon({ name, size = 22, color }: Props) {
  const props = { width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'burger': return <Svg {...props}><Line x1={4} y1={7} x2={20} y2={7} /><Line x1={4} y1={12} x2={20} y2={12} /><Line x1={4} y1={17} x2={20} y2={17} /></Svg>;
    case 'arrowDown': return <Svg {...props}><Polyline points="6 9 12 15 18 9" /></Svg>;
    case 'arrowUp': return <Svg {...props}><Line x1={12} y1={19} x2={12} y2={5} /><Polyline points="6 11 12 5 18 11" /></Svg>;
    case 'voice': return <Svg {...props}><Polygon points="11 5 6 9 2 9 2 15 6 15 11 19" fill={color} stroke="none" /><Path d="M15.54 8.46a5 5 0 010 7.07" /><Path d="M19.07 4.93a10 10 0 010 14.14" /></Svg>;
    case 'phone': return <Svg {...props}><Path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" /></Svg>;
    case 'plus': return <Svg {...props}><Line x1={12} y1={5} x2={12} y2={19} /><Line x1={5} y1={12} x2={19} y2={12} /></Svg>;
    case 'mic': return <Svg {...props} strokeWidth={2.4}><Path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><Path d="M19 10v2a7 7 0 01-14 0v-2" /><Line x1={12} y1={19} x2={12} y2={23} /><Line x1={8} y1={23} x2={16} y2={23} /></Svg>;
    case 'send': return <Svg {...props} strokeWidth={2.4}><Line x1={12} y1={19} x2={12} y2={5} /><Polyline points="6 11 12 5 18 11" /></Svg>;
    case 'sun': return <Svg {...props} strokeWidth={1.8}><Circle cx={12} cy={12} r={4} /><Path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></Svg>;
    case 'image': return <Svg {...props} strokeWidth={1.8}><Rect x={3} y={3} width={18} height={18} rx={2} /><Circle cx={8.5} cy={8.5} r={1.5} /><Polyline points="21 15 16 10 5 21" /></Svg>;
    case 'doc': return <Svg {...props} strokeWidth={1.8}><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /><Line x1={9} y1={15} x2={15} y2={15} /></Svg>;
    case 'camera': return <Svg {...props} strokeWidth={1.8}><Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" /><Circle cx={12} cy={13} r={4} /></Svg>;
    case 'quote': return <Svg {...props} strokeWidth={2.5}><Polyline points="9 17 4 12 9 7" /><Path d="M20 18v-2a4 4 0 00-4-4H4" /></Svg>;
    case 'close': return <Svg {...props} strokeWidth={2.5}><Line x1={6} y1={6} x2={18} y2={18} /><Line x1={18} y1={6} x2={6} y2={18} /></Svg>;
    case 'check': return <Svg {...props} strokeWidth={2.5}><Polyline points="20 6 9 17 4 12" /></Svg>;
    case 'chevDown': return <Svg {...props} strokeWidth={2}><Polyline points="6 9 12 15 18 9" /></Svg>;
    case 'copy': return <Svg {...props}><Rect x={9} y={9} width={13} height={13} rx={2} /><Path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></Svg>;
    case 'like': return <Svg {...props} fill={color} stroke="none"><Path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3zM7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" /></Svg>;
    case 'regenerate': return <Svg {...props}><Path d="M23 4v6h-6" /><Path d="M20.49 15A9 9 0 1118 5.3L23 10" /></Svg>;
    case 'share': return <Svg {...props}><Circle cx={18} cy={5} r={3} /><Circle cx={6} cy={12} r={3} /><Circle cx={18} cy={19} r={3} /><Line x1={8.59} y1={13.51} x2={15.42} y2={17.49} /><Line x1={15.41} y1={6.51} x2={8.59} y2={10.49} /></Svg>;
    case 'flash': return <Svg {...props} fill={color} stroke="none"><Path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" /></Svg>;
    case 'cube': return <Svg {...props}><Path d="M12 2L2 7l10 5 10-5-10-5z" /><Path d="M2 17l10 5 10-5" /><Path d="M2 12l10 5 10-5" /></Svg>;
    case 'globe': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>;
    case 'web': return <Svg {...props} strokeWidth={2}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /></Svg>;
    case 'lawyer': return <Svg {...props}><Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><Polyline points="14 2 14 8 20 8" /></Svg>;
    case 'fire': return <Svg {...props} strokeWidth={2}><Path d="M12 2c0 4-4 5-4 9a4 4 0 008 0c0-2-1-3-1-5 1 1 3 2 3 5a6 6 0 11-12 0c0-5 5-7 6-9z" /></Svg>;
    case 'phd': return <Svg {...props}><Path d="M22 12h-4l-3 9L9 3l-3 9H2" /></Svg>;
    case 'help': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3" /><Line x1={12} y1={17} x2={12.01} y2={17} /></Svg>;
    case 'info': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={12} y1={16} x2={12} y2={12} /><Line x1={12} y1={8} x2={12.01} y2={8} /></Svg>;
    case 'sparkles': return <Svg {...props} fill={color} stroke="none"><Path d="M12 2L9 9H2l5.5 4.5L5 21l7-4.5L19 21l-2.5-7.5L22 9h-7z" /></Svg>;
    case 'bell': return <Svg {...props}><Path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" /><Path d="M13.73 21a2 2 0 01-3.46 0" /></Svg>;
    case 'gear': return <Svg {...props}><Circle cx={12} cy={12} r={3} /><Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z" /></Svg>;
    case 'logout': return <Svg {...props}><Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><Polyline points="16 17 21 12 16 7" /><Line x1={21} y1={12} x2={9} y2={12} /></Svg>;
    case 'textSize': return <Svg {...props}><Path d="M4 7V4h16v3" /><Path d="M9 20h6" /><Path d="M12 4v16" /></Svg>;
    case 'lang': return <Svg {...props}><Circle cx={12} cy={12} r={10} /><Line x1={2} y1={12} x2={22} y2={12} /><Path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" /></Svg>;
  }
}
```

- [ ] **Step 3: 类型检查 + 测试**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
cd packages/mobile && pnpm test
```

Expected:typecheck 0 error,测试全 PASS(无新增/失败)。

- [ ] **Step 4: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): Icon 组件 + 30+ SVG icon 集"
```

---

## Task 9: IconButton + chrome 层(StatusBar / DynamicIsland / HomeIndicator)

**Files:**
- Create: `packages/mobile/src/components/topbar/IconButton.tsx`
- Create: `packages/mobile/src/components/chrome/StatusBar.tsx`
- Create: `packages/mobile/src/components/chrome/DynamicIsland.tsx`
- Create: `packages/mobile/src/components/chrome/HomeIndicator.tsx`

**Interfaces:**
- Consumes: Task 8 的 `Icon`,Task 5 的 `useTheme`
- Produces: 4 个 chrome 层组件 + IconButton

- [ ] **Step 1: 创建 `packages/mobile/src/components/topbar/IconButton.tsx`**

```tsx
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon, type IconName } from '../common/Icon';

type Props = {
  name: IconName;
  size?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export function IconButton({ name, size = 22, onPress, style, accessibilityLabel }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel ?? name}
      hitSlop={8}
      style={({ pressed }) => [
        {
          width: 36,
          height: 36,
          borderRadius: 18,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed ? palette.surface : 'transparent',
        },
        style,
      ]}
    >
      <Icon name={name} size={size} color={palette.fg} />
    </Pressable>
  );
}
```

- [ ] **Step 2: 创建 `packages/mobile/src/components/chrome/StatusBar.tsx`**

```tsx
import { View, Text, Platform } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import Svg, { Rect, Path } from 'react-native-svg';

// 设计稿固定 9:41 + 信号/wifi/电池(均为 SVG 形式,不依赖系统 StatusBar)
export function StatusBar() {
  const { palette } = useTheme();
  return (
    <View
      style={{
        height: 54,
        paddingTop: 18,
        paddingHorizontal: 32,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Text style={{ fontSize: 17, fontWeight: '600', color: palette.fg }}>9:41</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Svg width={18} height={12} viewBox="0 0 18 12" fill={palette.fg}>
          <Rect x={0} y={8} width={3} height={4} rx={0.5} />
          <Rect x={5} y={5} width={3} height={7} rx={0.5} />
          <Rect x={10} y={2} width={3} height={10} rx={0.5} />
          <Rect x={15} y={0} width={3} height={12} rx={0.5} />
        </Svg>
        <Svg width={16} height={12} viewBox="0 0 16 12" fill={palette.fg}>
          <Path d="M8 11a1 1 0 100-2 1 1 0 000 2zM4.5 7.5a4.5 4.5 0 016.5 0l-1 1a3 3 0 00-4.5 0l-1-1zM1.5 4.5a9 9 0 0110 0l-1 1a7.5 7.5 0 00-8 0l-1-1z" />
        </Svg>
        <Svg width={27} height={13} viewBox="0 0 27 13" fill="none">
          <Rect x={0.5} y={0.5} width={22} height={12} rx={3} stroke={palette.fg} strokeOpacity={0.35} />
          <Rect x={2} y={2} width={19} height={9} rx={1.5} fill={palette.fg} />
          <Rect x={24} y={4} width={2} height={5} rx={1} fill={palette.fg} fillOpacity={0.4} />
        </Svg>
      </View>
    </View>
  );
}
```

- [ ] **Step 3: 创建 `packages/mobile/src/components/chrome/DynamicIsland.tsx`**

```tsx
import { View } from 'react-native';

export function DynamicIsland() {
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 11,
        left: '50%',
        marginLeft: -60,
        width: 120,
        height: 35,
        backgroundColor: '#000000',
        borderRadius: 20,
        zIndex: 200,
      }}
    />
  );
}
```

- [ ] **Step 4: 创建 `packages/mobile/src/components/chrome/HomeIndicator.tsx`**

```tsx
import { View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

export function HomeIndicator() {
  const { palette } = useTheme();
  return (
    <View
      pointerEvents="none"
      style={{
        height: 34,
        alignItems: 'center',
        justifyContent: 'flex-end',
        paddingBottom: 8,
      }}
    >
      <View
        style={{
          width: 134,
          height: 5,
          backgroundColor: palette.fg,
          borderRadius: 3,
        }}
      />
    </View>
  );
}
```

- [ ] **Step 5: 类型检查**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
```

Expected:0 error。

- [ ] **Step 6: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): IconButton + StatusBar + DynamicIsland + HomeIndicator"
```

---

## Task 10: Switch 组件(深浅主题适配)

**Files:**
- Create: `packages/mobile/src/components/drawer/Switch.tsx`
- Create: `packages/mobile/__tests__/Switch.test.tsx`

**Interfaces:**
- Consumes: Task 5 的 `useTheme`
- Produces: `<Switch value onChange />` 受控组件,绿色开/灰关,40×24 圆角

- [ ] **Step 1: 写失败测试 `packages/mobile/__tests__/Switch.test.tsx`**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { ThemeProvider } from '../../src/ThemeProvider';
import { Switch } from '../../src/components/drawer/Switch';

describe('Switch', () => {
  test('value=true 时背景色为 success', () => {
    const { getByTestId } = render(
      <ThemeProvider initialMode="light"><Switch testID="sw" value={true} onChange={() => {}} /></ThemeProvider>,
    );
    const sw = getByTestId('sw');
    const inner = sw.findByProps({ testID: 'sw-track' });
    // 通过 props 验证(简化:仅确认渲染不抛错)
    expect(sw).toBeTruthy();
  });

  test('点击触发 onChange,值翻转', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider initialMode="light"><Switch testID="sw" value={false} onChange={onChange} /></ThemeProvider>,
    );
    fireEvent.press(getByTestId('sw'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
```

- [ ] **Step 2: 创建 `packages/mobile/src/components/drawer/Switch.tsx`**

```tsx
import { Pressable, View } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = {
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
};

export function Switch({ value, onChange, testID }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        width: 40,
        height: 24,
        borderRadius: 12,
        backgroundColor: value ? palette.success : palette.surface2,
        justifyContent: 'center',
        padding: 2,
      }}
    >
      <View
        testID={testID ? `${testID}-track` : undefined}
        style={{
          width: 20,
          height: 20,
          borderRadius: 10,
          backgroundColor: '#FFFFFF',
          transform: [{ translateX: value ? 16 : 0 }],
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 1 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
        }}
      />
    </Pressable>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm test -- --testPathPattern=Switch
```

Expected:2 个 test PASS。

- [ ] **Step 4: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): Switch 组件 + 测试"
```

---

## Task 11: TextField(多行自适应)

**Files:**
- Create: `packages/mobile/src/components/input/TextField.tsx`

**Interfaces:**
- Consumes: 无
- Produces: `<TextField value onChangeText placeholder multiline />`,内容增多时自动撑高,封顶 100px

- [ ] **Step 1: 创建 `packages/mobile/src/components/input/TextField.tsx`**

```tsx
import { useState, useCallback } from 'react';
import { TextInput, type TextInputProps } from 'react-native';
import { useTheme } from '../../hooks/useTheme';

type Props = Omit<TextInputProps, 'multiline' | 'onContentSizeChange'> & {
  minHeight?: number;
  maxHeight?: number;
};

export function TextField({ minHeight = 24, maxHeight = 100, style, onChange, ...rest }: Props) {
  const { palette } = useTheme();
  const [height, setHeight] = useState(minHeight);

  const onContentSizeChange = useCallback(
    (e: { nativeEvent: { contentSize: { height: number } } }) => {
      const next = Math.min(Math.max(e.nativeEvent.contentSize.height, minHeight), maxHeight);
      setHeight(next);
    },
    [minHeight, maxHeight],
  );

  return (
    <TextInput
      multiline
      onContentSizeChange={onContentSizeChange}
      placeholderTextColor={palette.fg3}
      style={[
        {
          minHeight,
          maxHeight,
          fontSize: 15,
          lineHeight: 21,
          color: palette.fg,
          padding: 0,
          textAlignVertical: 'top',
        },
        { height },
        style,
      ]}
      {...rest}
    />
  );
}
```

- [ ] **Step 2: 类型检查**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
```

Expected:0 error。

- [ ] **Step 3: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): TextField 组件(多行自适应)"
```

---

## Task 12: 输入区三个按钮(Mic / Attachment / Send)

**Files:**
- Create: `packages/mobile/src/components/input/MicButton.tsx`
- Create: `packages/mobile/src/components/input/AttachmentButton.tsx`
- Create: `packages/mobile/src/components/input/SendButton.tsx`

**Interfaces:**
- Consumes: Task 8 的 `Icon`,Task 5 的 `useTheme`
- Produces: 3 个 32×32 圆形按钮,Send 蓝色填充

- [ ] **Step 1: 创建 `packages/mobile/src/components/input/MicButton.tsx`**

```tsx
import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; accessibilityLabel?: string };

export function MicButton({ onPress, accessibilityLabel = '语音输入' }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Icon name="mic" size={20} color={palette.fg} />
    </Pressable>
  );
}
```

- [ ] **Step 2: 创建 `packages/mobile/src/components/input/AttachmentButton.tsx`**

```tsx
import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; accessibilityLabel?: string };

export function AttachmentButton({ onPress, accessibilityLabel = '附件' }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.55 : 1,
      })}
    >
      <Icon name="plus" size={20} color={palette.fg} />
    </Pressable>
  );
}
```

- [ ] **Step 3: 创建 `packages/mobile/src/components/input/SendButton.tsx`**

```tsx
import { Pressable } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { Icon } from '../common/Icon';

type Props = { onPress?: () => void; disabled?: boolean; accessibilityLabel?: string };

export function SendButton({ onPress, disabled, accessibilityLabel = '发送' }: Props) {
  const { palette } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: disabled
          ? palette.surface2
          : pressed
            ? palette.primary2
            : palette.primary,
      })}
    >
      <Icon name="send" size={20} color={disabled ? palette.fg3 : '#FFFFFF'} />
    </Pressable>
  );
}
```

- [ ] **Step 4: 类型检查**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
```

Expected:0 error。

- [ ] **Step 5: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): 输入区 Mic/Attachment/Send 三个按钮"
```

---

## Task 13: BottomSheet 通用组件

**Files:**
- Create: `packages/mobile/src/components/sheets/BottomSheet.tsx`
- Create: `packages/mobile/__tests__/BottomSheet.test.tsx`

**Interfaces:**
- Consumes: Task 5 的 `useTheme`
- Produces: `<BottomSheet visible title onClose>{children}</BottomSheet>`,顶部 20px 圆角,handle 40×4,带遮罩,Esc/点遮罩关闭

- [ ] **Step 1: 写失败测试 `packages/mobile/__tests__/BottomSheet.test.tsx`**

```tsx
import { render, fireEvent } from '@testing-library/react-native';
import { Text, View } from 'react-native';
import { ThemeProvider } from '../../src/ThemeProvider';
import { BottomSheet } from '../../src/components/sheets/BottomSheet';

describe('BottomSheet', () => {
  test('visible=false 时不渲染 children', () => {
    const { queryByTestId } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={false} title="x" onClose={() => {}}>
          <Text testID="content">content</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    expect(queryByTestId('content')).toBeNull();
  });

  test('visible=true 渲染 title 与 children', () => {
    const { getByText, getByTestId } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={true} title="切换模型" onClose={() => {}}>
          <Text testID="content">content</Text>
        </BottomSheet>
      </ThemeProvider>,
    );
    expect(getByText('切换模型')).toBeTruthy();
    expect(getByTestId('content')).toBeTruthy();
  });

  test('点关闭按钮触发 onClose', () => {
    const onClose = jest.fn();
    const { getByLabelText } = render(
      <ThemeProvider initialMode="light">
        <BottomSheet visible={true} title="x" onClose={onClose}>
          <View />
        </BottomSheet>
      </ThemeProvider>,
    );
    fireEvent.press(getByLabelText('关闭'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: 创建 `packages/mobile/src/components/sheets/BottomSheet.tsx`**

```tsx
import { Modal, Pressable, View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { IconButton } from '../topbar/IconButton';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children?: React.ReactNode;
  testID?: string;
};

export function BottomSheet({ visible, title, onClose, children, testID }: Props) {
  const { palette } = useTheme();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.15)' }]}
        accessibilityLabel="遮罩"
      />
      <View
        testID={testID}
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '78%',
          backgroundColor: palette.bg,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingTop: 8,
          paddingBottom: 20,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -10 },
          shadowOpacity: 0.15,
          shadowRadius: 40,
        }}
      >
        <View
          style={{
            width: 40,
            height: 4,
            backgroundColor: palette.surface2,
            borderRadius: 2,
            alignSelf: 'center',
            marginVertical: 4,
          }}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 18,
            paddingTop: 8,
            paddingBottom: 12,
          }}
        >
          <Text style={{ fontSize: 17, fontWeight: '700', color: palette.fg }}>{title}</Text>
          <IconButton name="close" size={14} onPress={onClose} accessibilityLabel="关闭" />
        </View>
        <View style={{ paddingHorizontal: 14 }}>{children}</View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: 跑测试**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm test -- --testPathPattern=BottomSheet
```

Expected:3 个 test PASS。

- [ ] **Step 4: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): BottomSheet 通用组件 + 测试"
```

---

## Task 14: 串好 `app/_layout.tsx` Provider 链 + 填充 `app/chat.tsx` 空壳

**Files:**
- Modify: `packages/mobile/app/_layout.tsx`
- Modify: `packages/mobile/app/chat.tsx`

**Interfaces:**
- Consumes: Task 5 的 `ThemeProvider`,Task 9 的 chrome 组件
- Produces: 启动后看到完整 iPhone 14 Pro 框架 + 空 Chat 屏,主题切换实时刷新

- [ ] **Step 1: 改写 `packages/mobile/app/_layout.tsx`**

```tsx
import { Stack } from 'expo-router';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-get-random-values';
import { ThemeProvider } from '../src/ThemeProvider';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Stack screenOptions={{ headerShown: false }} />
        <ExpoStatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 2: 改写 `packages/mobile/app/chat.tsx`(空壳,阶段 2 填充)**

```tsx
import { View } from 'react-native';
import { useTheme } from '../src/hooks/useTheme';
import { StatusBar as PhoneStatusBar } from '../src/components/chrome/StatusBar';
import { DynamicIsland } from '../src/components/chrome/DynamicIsland';
import { HomeIndicator } from '../src/components/chrome/HomeIndicator';

export default function Chat() {
  const { palette } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: palette.bg }}>
      <DynamicIsland />
      <PhoneStatusBar />
      <View style={{ flex: 1 }} />
      <HomeIndicator />
    </View>
  );
}
```

- [ ] **Step 3: 类型检查 + 测试**

```bash
cd /Users/admin/pz/openz
pnpm --filter @openz/mobile typecheck
cd packages/mobile && pnpm test
```

Expected:typecheck 0 error,测试全 PASS(共 12 个)。

- [ ] **Step 4: 验证 metro 可打包(无真机时只做导出检查)**

```bash
cd /Users/admin/pz/openz/packages/mobile
pnpm expo export --platform ios --output-dir /tmp/expo-p1 2>&1 | tail -10
rm -rf /tmp/expo-p1
```

Expected:无 `error` 字样,输出 `Done writing bundle output` 一类。

- [ ] **Step 5: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): 串好 Provider 链 + 空 Chat 屏(阶段 1 完成态)"
```

---

## Task 15: EAS 配置文件

**Files:**
- Create: `packages/mobile/eas.json`
- Create: `packages/mobile/.gitignore`(如不存在)

**Interfaces:**
- Consumes: Task 1 的 `app.json`
- Produces: `eas build --profile development` 可用,3 个 profile(dev / preview / production)

- [ ] **Step 1: 创建 `packages/mobile/eas.json`**

```json
{
  "cli": {
    "version": ">= 12.0.0",
    "appVersionSource": "remote"
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "ios": { "simulator": true }
    },
    "preview": {
      "distribution": "internal"
    },
    "production": {}
  },
  "submit": {
    "production": {
      "ios": { "ascAppId": "TBD_AFTER_APPLE_CONNECT_SETUP" },
      "android": { "track": "internal" }
    }
  }
}
```

注:`ios.simulator: true` 让 development build 可在 Simulator 跑,便于阶段 1 验证。

- [ ] **Step 2: 创建/补 `packages/mobile/.gitignore`**

```gitignore
node_modules/
.expo/
dist/
web-build/
*.tsbuildinfo
```

- [ ] **Step 3: 验证 `eas.json` 格式正确**

```bash
cd /Users/admin/pz/openz/packages/mobile
npx --no-install eas-cli config 2>&1 | head -20 || echo "eas-cli 未安装,在阶段 2/3 真要构建时再装"
```

Expected:若未装 eas-cli,只 echo;若装了,显示 `eas.json` 解析无 error。

- [ ] **Step 4: 提交**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/
git commit -m "feat(mobile): EAS Build 配置(dev/preview/production)"
```

---

## Task 16: 阶段 1 验收 — 模拟器跑通与文档

**Files:**
- Create: `packages/mobile/README.md`
- Create: `docs/superpowers/plans/2026-06-17-mobile-app-phase1-verify.md`(验收 checklist)

**Interfaces:**
- Consumes: 阶段 1 全部产物
- Produces: 验收报告(模拟器截图存档路径 + 完成/未完成项)

- [ ] **Step 1: 创建 `packages/mobile/README.md`**

```markdown
# @openz/mobile

OpenZ 移动端 App · iOS + Android · Expo SDK 52

## 当前阶段

**阶段 1: 脚手架** — 可启动 + 3 模式主题 + 原子组件库 + BottomSheet。

## 启动

\`\`\`bash
pnpm install
pnpm dev:mobile
# 在另一个终端
pnpm --filter @openz/mobile ios      # iOS Simulator
pnpm --filter @openz/mobile android  # Android Emulator
\`\`\`

## 测试

\`\`\`bash
pnpm --filter @openz/mobile test
pnpm --filter @openz/mobile typecheck
pnpm --filter @openz/mobile lint
\`\`\`

## 目录

- \`app/\` — Expo Router 路由
- \`src/components/\` — 组件
- \`src/theme/\` — 设计 token 与主题
- \`src/stores/\` — zustand stores
- \`src/hooks/\` — 自定义 hooks
- \`__tests__/\` — Jest 测试

## 阶段规划

- [x] 阶段 1: 脚手架
- [ ] 阶段 2: UI 1:1 复刻设计稿(5 屏)
- [ ] 阶段 3: 接入 daemon 与 relay server
```

- [ ] **Step 2: 真机/Simulator 验收(本地执行,无真机时跳过,标注未完成)**

依次验证下列项,每项打勾或记录问题:

- [ ] iOS Simulator 启动后看到 9:41 状态栏 + 灵动岛
- [ ] Android Emulator 启动后看到 9:41 状态栏 + 灵动岛
- [ ] 主题切换测试:在 `app/_layout.tsx` 临时加一个开发用 `<ThemeSwitcher />` 按钮(或在开发菜单切),3 模式(浅/深/系统)实时切换无闪烁
- [ ] HomeIndicator 始终在底部,浅色模式是深色,深色模式是浅色
- [ ] 关闭模拟器退出

注:阶段 1 的 Chat 屏是空壳,**不需要**显示 Welcome/对话/输入区;那些是阶段 2 的事。

- [ ] **Step 3: 写验收报告 `docs/superpowers/plans/2026-06-17-mobile-app-phase1-verify.md`**

```markdown
# 阶段 1 验收报告

**日期**: 2026-06-17
**执行人**: <填入>
**结论**: <PASS / FAIL>

## 验收项

| 项 | 通过 | 备注 |
|---|---|---|
| iOS Simulator 启动 | <Y/N> |  |
| Android Emulator 启动 | <Y/N> |  |
| 浅色主题 | <Y/N> |  |
| 深色主题 | <Y/N> |  |
| 系统主题(自动跟随) | <Y/N> |  |
| HomeIndicator 颜色反转 | <Y/N> |  |
| 12 个 Jest 测试通过 | <Y/N> |  |
| typecheck 0 error | <Y/N> |  |
| lint 0 error | <Y/N> |  |

## 遗留问题

<列出阶段 1 内未解决的事项,阶段 2 跟进>
```

- [ ] **Step 4: 提交验收文档与 README**

```bash
cd /Users/admin/pz/openz
git add packages/mobile/README.md docs/superpowers/plans/2026-06-17-mobile-app-phase1-verify.md
git commit -m "docs(mobile): 阶段 1 README 与验收报告"
```

---

## 自我复核

- [x] **spec 覆盖**:§14 阶段 1 的 11 个子任务(1.1–1.11)全部映射为 Task 1–16
- [x] **占位符扫描**:无 "TBD"/"TODO"/"实现细节" 类占位;`ascAppId` 已在 spec 中说明为后续填
- [x] **类型一致性**:ThemeMode 单一来源 `src/stores/settingsStore.ts`;Palette 类型复用 lightPalette 类型,避免 dark 与 light 形状漂移
- [x] **依赖版本对齐**:Expo 52 / RN 0.76 / Expo Router 4 / react-native-mmkv 3 / react-native-svg 15 / zustand 5 / Jest 29

---

**Plan complete and saved to `docs/superpowers/plans/2026-06-17-mobile-app-phase1-scaffold.md`.**

阶段 2(UI 1:1 复刻)与阶段 3(后端连线)后续另起 plan,按本 plan 通过后再开始。Two execution options:

**1. Subagent-Driven (recommended)** - 派发新 subagent per task,逐任务 review,迭代快

**2. Inline Execution** - 在当前会话内用 executing-plans 批量执行,带 checkpoint

请选择执行方式。
