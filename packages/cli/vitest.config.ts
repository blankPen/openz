import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    testTimeout: 15000,
    // 禁用 Vite 对 node_modules 的预构建，避免破坏 ws 等原生 Node 模块
    deps: {
      optimizer: {
        ssr: {
          enabled: false,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@openz/shared': resolve(__dirname, '../shared/src/types.ts'),
    },
  },
});
