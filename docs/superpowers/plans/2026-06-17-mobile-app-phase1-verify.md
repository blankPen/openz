# 阶段 1 验收报告

**日期**: 2026-06-17
**执行人**: Claude (自动化验收)
**结论**: PASS(条件性 — Simulator/Emulator 项在当前环境无法执行,已标注跳过)

## 环境说明

本验收在 macOS 命令行环境中执行,**未安装 iOS Simulator / Android Emulator**。故真机/Simulator 视觉验收项标记为 "Skipped",自动化项(test / typecheck / lint)均已通过。

## 验收项

| 项 | 通过 | 备注 |
|---|---|---|
| iOS Simulator 启动 | Skipped | 无 Simulator 环境,跳过 |
| Android Emulator 启动 | Skipped | 无 Emulator 环境,跳过 |
| 浅色主题 | Skipped | 无视觉环境;静态分析:`src/theme/light.ts` 已定义浅色 palette |
| 深色主题 | Skipped | 无视觉环境;静态分析:`src/theme/dark.ts` 已定义深色 palette |
| 系统主题(自动跟随) | Skipped | 无视觉环境;`settingsStore.themeMode` 支持 `light`/`dark`/`system` 三值,ThemeProvider 通过 `useColorScheme()` 响应 |
| HomeIndicator 颜色反转 | Skipped | 无视觉环境;`src/components/chrome/HomeIndicator.tsx` 根据 `theme.mode` 反转颜色,代码已确认 |
| 17 个 Jest 测试通过 | Y | 17/17 passed,7 suites,Time 1.19s |
| typecheck 0 error | Y | `tsc --noEmit` 0 errors |
| lint 0 error | Y | 0 errors,3 warnings(unused `onChange`/`import/first`,阶段 2 整改) |

## 自动化验收证据

### Jest
```
Test Suites: 7 passed, 7 total
Tests:       17 passed, 17 total
Snapshots:   0 total
Time:        1.19 s
Ran all test suites.
```

### typecheck
```
> @openz/mobile@0.1.0 typecheck
> tsc --noEmit
```
无输出 = 0 errors。

### lint
```
3 problems (0 errors, 3 warnings)
```
0 errors,3 warnings 均为非阻断 warning(阶段 2 清理)。

## 阶段 1 交付清单

- [x] Expo SDK 52 项目骨架(Task 1)
- [x] Expo Router 4 + monorepo Metro(Task 2)
- [x] ESLint + Prettier(Task 3)
- [x] 设计 token + 浅/深 palette(Task 4)
- [x] ThemeProvider + useTheme + settingsStore(Task 5–6)
- [x] MMKV 持久化与 7 字段默认值(Task 6)
- [x] i18n 集中文案(Task 7)
- [x] Icon 组件 + 30+ SVG icon 集(Task 8)
- [x] IconButton + StatusBar + DynamicIsland + HomeIndicator(Task 9)
- [x] Switch 组件(Task 10)
- [x] TextField 组件(Task 11)
- [x] 输入区 Mic/Attachment/Send 三按钮(Task 12)
- [x] BottomSheet 通用组件(Task 13)
- [x] Provider 链 + 空 Chat 屏(Task 14)
- [x] EAS Build 配置 dev/preview/production(Task 15)
- [x] README + 验收报告(Task 16)

## 遗留问题

1. **Simulator/Emulator 真机验收未执行** — 当前环境为无 GUI 容器,无法启动 iOS Simulator 或 Android Emulator。阶段 2 启动时需在开发机上执行视觉验收。
2. **lint warning 3 处** — `TextField.tsx` 未使用 `onChange`、`settingsStore.persistence.test.ts` import 顺序。阶段 2 整改。
3. **Chat 屏是空壳** — 当前 `/chat` 路由只渲染 chrome 层(状态栏 + 灵动岛 + 输入区 + HomeIndicator),不显示消息历史/欢迎语/输入交互,这是设计意图(阶段 2 范围)。
4. **ascAppId 未填** — `eas.json` 中 `submit.production.ios.ascAppId` 留空,需 Apple Developer 账号创建 App 后回填,EAS Build 不会因此失败,但 submit 阶段需要。
5. **Provider 链中 MMKV 单例** — `MMKV` 实例在 `settingsStore.ts` 模块加载时创建,SSR/Jest 环境需 mock(测试中已 mock)。

## 阶段 2 启动前检查

- [ ] 在 macOS 开发机上执行 `pnpm dev:mobile` + iOS Simulator,补齐视觉验收
- [ ] 修复 3 处 lint warning
- [ ] 确认 `app.json` 中 `ascAppId` 占位策略
- [ ] 阶段 2 plan:5 屏 UI 1:1 复刻(Home/Welcome/Chat/Settings/Sheet)