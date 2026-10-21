import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@prism/types': path.resolve(__dirname, '../../packages/types/src'),
      '@prism/ui': path.resolve(__dirname, '../../packages/ui/src'),
      '@prism/api-client': path.resolve(__dirname, '../../packages/api-client/src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      exclude: ['**/components/ui/**', '**/features/pmcm-kit/**', '**/views/**', '**/*cockpit*'],
      thresholds: { lines: 50, statements: 50, functions: 50, branches: 40 },
    },
  },
})
