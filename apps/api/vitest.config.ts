import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['libs/**/*.test.ts', 'apps/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
  },
  resolve: {
    alias: {
      '@prism/database': resolve(__dirname, './libs/database/src/index.ts'),
      '@prism/shared': resolve(__dirname, './libs/shared/src/index.ts'),
      '@prism/modules/event-ops': resolve(__dirname, './libs/modules/event-ops/src/index.ts'),
    },
  },
});
