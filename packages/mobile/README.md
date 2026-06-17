# @openz/mobile

OpenZ 移动端 App · iOS + Android · Expo SDK 52

## 当前阶段

**阶段 1: 脚手架** — 可启动 + 3 模式主题 + 原子组件库 + BottomSheet。

## 启动

```bash
pnpm install
pnpm dev:mobile
# 在另一个终端
pnpm --filter @openz/mobile ios      # iOS Simulator
pnpm --filter @openz/mobile android  # Android Emulator
```

## 测试

```bash
pnpm --filter @openz/mobile test
pnpm --filter @openz/mobile typecheck
pnpm --filter @openz/mobile lint
```

## 目录

- `app/` — Expo Router 路由
- `src/components/` — 组件
- `src/theme/` — 设计 token 与主题
- `src/stores/` — zustand stores
- `src/hooks/` — 自定义 hooks
- `__tests__/` — Jest 测试

## 阶段规划

- [x] 阶段 1: 脚手架
- [ ] 阶段 2: UI 1:1 复刻设计稿(5 屏)
- [ ] 阶段 3: 接入 daemon 与 relay server