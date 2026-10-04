import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['libs/**/*.test.ts', 'src/**/*.test.ts', 'test/integration/**/*.test.ts'],
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
      '@prism/kernel/database': resolve(__dirname, './src/kernel/database/index.ts'),
      '@prism/kernel/shared': resolve(__dirname, './src/kernel/shared/index.ts'),
      '@prism/contexts/read-models/closeout': resolve(__dirname, './src/modules/read-models/closeout.ts'),
      '@prism/contexts/read-models/event-scope': resolve(__dirname, './src/modules/read-models/event-scope.ts'),
      '@prism/contexts/read-models/participant-facts': resolve(__dirname, './src/modules/read-models/participant-facts/index.ts'),
      '@prism/contexts/read-models/guest-events': resolve(__dirname, './src/modules/read-models/guest-events.ts'),
      '@prism/contexts/read-models': resolve(__dirname, './src/modules/read-models/index.ts'),
      '@prism/kernel/event-core': resolve(__dirname, './src/kernel/event-core/index.ts'),
      '@prism/kernel/access-control': resolve(__dirname, './src/kernel/access-control/index.ts'),
      '@prism/contexts/commercial/registration-supplier-reference': resolve(__dirname, './src/modules/commercial/registration-supplier-reference.ts'),
      '@prism/contexts/commercial': resolve(__dirname, './src/modules/commercial/index.ts'),
      '@prism/contexts/event-lifecycle/conforme-reminder-window': resolve(__dirname, './src/modules/event-lifecycle/conforme-reminder-window.ts'),
      '@prism/contexts/event-lifecycle/post-event-reference': resolve(__dirname, './src/modules/event-lifecycle/post-event-reference.ts'),
      '@prism/contexts/event-lifecycle/floorplan-reference': resolve(__dirname, './src/modules/event-lifecycle/floorplan-reference.ts'),
      '@prism/contexts/event-lifecycle/operations-reference': resolve(__dirname, './src/modules/event-lifecycle/operations-reference.ts'),
      '@prism/contexts/event-lifecycle': resolve(__dirname, './src/modules/event-lifecycle/index.ts'),
      '@prism/contexts/platform-ops': resolve(__dirname, './src/modules/platform-ops/index.ts'),
      '@prism/contexts/identity-access/coordinator-reference': resolve(__dirname, './src/modules/identity-access/coordinator-reference.ts'),
      '@prism/contexts/identity-access': resolve(__dirname, './src/modules/identity-access/index.ts'),
      '@prism/contexts/floorplan': resolve(__dirname, './src/modules/floorplan/index.ts'),
      '@prism/contexts/operations/live-ops-reference': resolve(__dirname, './src/modules/operations/live-ops-reference.ts'),
      '@prism/contexts/operations': resolve(__dirname, './src/modules/operations/index.ts'),
      '@prism/kernel/event-session': resolve(__dirname, './src/kernel/event-session/index.ts'),
      '@prism/kernel/health': resolve(__dirname, './src/kernel/health/index.ts'),
      '@prism/kernel/shared-kernel': resolve(__dirname, './src/kernel/shared-kernel/index.ts'),
      '@prism/contexts/live-ops/urgent-issue-reference': resolve(__dirname, './src/modules/live-ops/urgent-issue-reference.ts'),
      '@prism/contexts/live-ops': resolve(__dirname, './src/modules/live-ops/index.ts'),
    },
  },
});
