import { defineConfig } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { join } from 'node:path';
if (!process.env.BROWSER_RUN_DIRECTORY) throw new Error('Run browser acceptance through npm run test:browser (isolated stack required).');
export default defineConfig({
  testDir: '.', testMatch: '*.spec.mjs', fullyParallel: false, workers: 1, retries: 0, forbidOnly: Boolean(process.env.CI),
  timeout: 90_000, globalTimeout: 40 * 60_000, expect: { timeout: 15_000 },
  outputDir: join(process.env.BROWSER_RUN_DIRECTORY, 'results'),
  reporter: [['list'], ['html', { outputFolder: join(process.env.BROWSER_RUN_DIRECTORY, 'report'), open: 'never' }]],
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', actionTimeout: 15_000 },
  projects: [
    { name: 'desktop', use: projectDevice('desktop') },
    { name: 'mobile', use: projectDevice('mobile') },
    // 768px is the narrowest width that keeps the sidebar, so it leaves pages the least room. Route coverage only.
    { name: 'tablet', testMatch: 'page-coverage.spec.mjs', use: projectDevice('tablet') },
  ],
});
