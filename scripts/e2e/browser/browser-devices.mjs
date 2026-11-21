import { devices } from '@playwright/test';

/**
 * The device each project emulates. Phones and tablets run on Chromium by default; BROWSER_WEBKIT=1 runs them on
 * WebKit as an iPhone and an iPad, so Safari's engine is covered on demand (after `npx playwright install webkit`).
 */
export function projectDevice(project, webkit = process.env.BROWSER_WEBKIT === '1') {
  if (project === 'desktop') return devices['Desktop Chrome'];
  if (project === 'mobile') return webkit ? devices['iPhone 14'] : devices['Pixel 7'];
  if (project === 'tablet') return webkit ? devices['iPad Mini'] : { ...devices['iPad Mini'], defaultBrowserType: 'chromium' };
  throw new Error(`Unknown browser project ${project}.`);
}
