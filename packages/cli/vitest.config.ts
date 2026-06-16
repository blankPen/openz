import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@openz/shared': '/Users/pz/multica_workspaces/c22c5bba-a208-4287-b111-c8eb91db5f07/b4ff73a7/workdir/openz/packages/shared/src/types.ts',
    },
  },
});
