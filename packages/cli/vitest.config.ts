import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@uran/shared': '/Users/pz/workspace/claude-code-assistant/packages/shared/src/types.ts',
    },
  },
});
