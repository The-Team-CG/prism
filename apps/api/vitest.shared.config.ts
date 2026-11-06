import { defineConfig } from 'vitest/config';
import base from './vitest.config';
import { sharedPolicyTests } from './test/shared-policy-tests';

// Only reviewed pure policy tests may share their imported module state.
export default defineConfig({
  ...base,
  test: {
    ...base.test,
    projects: [],
    isolate: false,
    include: sharedPolicyTests,
    setupFiles: ['./test/shared-module-setup.ts'],
    sequence: { shuffle: true },
  },
});
