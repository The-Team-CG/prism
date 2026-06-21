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
      '@prism/modules/file-ops': resolve(__dirname, './libs/modules/file-ops/src/index.ts'),
      '@prism/modules/inquiry-onboarding': resolve(__dirname, './libs/modules/inquiry-onboarding/src/index.ts'),
      '@prism/modules/commercial-ops': resolve(__dirname, './libs/modules/commercial-ops/src/index.ts'),
      '@prism/modules/compliance-ops': resolve(__dirname, './libs/modules/compliance-ops/src/index.ts'),
      '@prism/modules/floorplan': resolve(__dirname, './libs/modules/floorplan/src/index.ts'),
      '@prism/modules/guest-ops': resolve(__dirname, './libs/modules/guest-ops/src/index.ts'),
    },
  },
});
