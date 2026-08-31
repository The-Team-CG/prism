import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['libs/**/*.test.ts', 'apps/**/*.test.ts'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'html'],
      reportsDirectory: './coverage',
      // Practice bar (looser than industry 80%): raise toward 80/80/80/75 over time.
      thresholds: {
        lines: 50,
        statements: 50,
        functions: 50,
        branches: 40,
      },
    },
  },
  resolve: {
    alias: {
      '@prism/database': resolve(__dirname, './libs/database/src/index.ts'),
      '@prism/shared': resolve(__dirname, './libs/shared/src/index.ts'),
      '@prism/modules/sample-compatibility': resolve(__dirname, './libs/modules/sample-compatibility/src/index.ts'),
      '@prism/modules/event-read-models': resolve(__dirname, './libs/modules/event-read-models/src/index.ts'),
      '@prism/modules/closure-ops': resolve(__dirname, './libs/modules/closure-ops/src/index.ts'),
      '@prism/modules/event-core': resolve(__dirname, './libs/modules/event-core/src/index.ts'),
      '@prism/modules/trust-ops': resolve(__dirname, './libs/modules/trust-ops/src/index.ts'),
      '@prism/modules/notification-ops': resolve(__dirname, './libs/modules/notification-ops/src/index.ts'),
      '@prism/modules/access-control': resolve(__dirname, './libs/modules/access-control/src/index.ts'),
      '@prism/modules/ai-governance': resolve(__dirname, './libs/modules/ai-governance/src/index.ts'),
      '@prism/modules/supplier-ops': resolve(__dirname, './libs/modules/supplier-ops/src/index.ts'),
      '@prism/modules/finance-ops': resolve(__dirname, './libs/modules/finance-ops/src/index.ts'),
      '@prism/modules/file-ops': resolve(__dirname, './libs/modules/file-ops/src/index.ts'),
      '@prism/modules/inquiry-onboarding': resolve(__dirname, './libs/modules/inquiry-onboarding/src/index.ts'),
      '@prism/modules/commercial-ops': resolve(__dirname, './libs/modules/commercial-ops/src/index.ts'),
      '@prism/modules/compliance-ops': resolve(__dirname, './libs/modules/compliance-ops/src/index.ts'),
      '@prism/contexts/floorplan': resolve(__dirname, './libs/contexts/floorplan/src/index.ts'),
      '@prism/contexts/operations': resolve(__dirname, './libs/contexts/operations/src/index.ts'),
      '@prism/modules/identity-ops': resolve(__dirname, './libs/modules/identity-ops/src/index.ts'),
      '@prism/modules/event-session': resolve(__dirname, './libs/modules/event-session/src/index.ts'),
      '@prism/contexts/live-ops': resolve(__dirname, './libs/contexts/live-ops/src/index.ts'),
    },
  },
});
