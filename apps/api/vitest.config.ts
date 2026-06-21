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
      '@prism/modules/event-core': resolve(__dirname, './libs/modules/event-core/src/index.ts'),
      '@prism/modules/trust-ops': resolve(__dirname, './libs/modules/trust-ops/src/index.ts'),
      '@prism/modules/notification-ops': resolve(__dirname, './libs/modules/notification-ops/src/index.ts'),
      '@prism/modules/access-control': resolve(__dirname, './libs/modules/access-control/src/index.ts'),
      '@prism/modules/supplier-ops': resolve(__dirname, './libs/modules/supplier-ops/src/index.ts'),
      '@prism/modules/finance-ops': resolve(__dirname, './libs/modules/finance-ops/src/index.ts'),
    },
  },
});
