import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { origins, persona } from './helpers.mjs';

/**
 * Screenshots of the seeded five-year history as each fixture account sees it: Ana (client), XPERTO (supplier),
 * PMCM and Marco (coordinator). Runs only with BROWSER_SEED_HISTORY=1 and BROWSER_SCREENSHOTS=1; the page-coverage
 * sweep signs in fresh actors, so this is where years of data appear. Event ids follow the history profile
 * (evt_hist_241 is today's live event for Ana; 005 archived, 195 planning, 188 closing out).
 */
const enabled = process.env.BROWSER_SEED_HISTORY === '1' && process.env.BROWSER_SCREENSHOTS === '1';

const ROUTES = {
  client: ['/dashboard', '/dashboard/events', '/dashboard/events/completed', '/dashboard/events/upcoming', '/dashboard/calendar', '/dashboard/billing', '/dashboard/billing/receipts', '/dashboard/approvals', '/dashboard/events/evt_hist_241/overview', '/dashboard/events/evt_hist_005/summary', '/dashboard/notifications'],
  supplier: ['/dashboard', '/dashboard/requests', '/dashboard/bookings', '/dashboard/calendar', '/dashboard/payments', '/dashboard/notifications'],
  pmcm: [
    '/dashboard', '/dashboard/events', '/dashboard/inquiries', '/dashboard/calendar', '/dashboard/finance', '/dashboard/clients', '/dashboard/suppliers', '/dashboard/team',
    '/dashboard/events/evt_hist_241/overview', '/dashboard/events/evt_hist_241/live-ops', '/dashboard/events/evt_hist_195/billing', '/dashboard/events/evt_hist_195/suppliers',
    '/dashboard/events/evt_hist_188/closure', '/dashboard/events/evt_hist_005/overview', '/dashboard/settings',
  ],
  coordinator: ['/dashboard', '/dashboard?view=tasks', '/dashboard?view=calendar', '/dashboard?view=assignments', '/dashboard?view=notifications'],
};
const ORIGIN = { client: 'client', supplier: 'supplier', pmcm: 'event', coordinator: 'event' };

for (const role of Object.keys(ROUTES)) test(`history gallery: ${role}`, async ({ browser }, info) => {
  test.skip(!enabled, 'Set BROWSER_SEED_HISTORY=1 and BROWSER_SCREENSHOTS=1 for the history gallery');
  test.setTimeout(10 * 60_000);
  const { context, page } = await persona(browser, role, info.project.use);
  const directory = join(process.env.BROWSER_RUN_DIRECTORY, 'screenshots', info.project.name, `history-${role}`);
  mkdirSync(directory, { recursive: true });
  try {
    for (const [index, path] of ROUTES[role].entries()) {
      await page.goto(`${origins[ORIGIN[role]]}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      if (path === '/dashboard/calendar') {
        await expect(page.getByRole('button', { name: 'Calendar view: Week', exact: true })).toBeVisible();
        const search = page.getByRole('searchbox', { name: 'Search schedule' });
        await search.fill('no-matching-calendar-entry-9c03');
        await expect(page.getByRole('status')).toContainText('No matching entries');
        await search.clear();
        await page.getByRole('button', { name: 'Filter schedule timing' }).click();
        await page.getByRole('menuitem', { name: 'Timed entries', exact: true }).click();
        await page.getByRole('button', { name: 'Filter schedule timing' }).click();
        await page.getByRole('menuitem', { name: 'All entries', exact: true }).click();
        const categories = page.getByRole('group', { name: 'Schedule categories' }).getByRole('button');
        if (await categories.count() > 1) {
          await categories.nth(1).click();
          await expect(categories.nth(1)).toHaveAttribute('aria-pressed', 'true');
          await categories.first().click();
        }
        if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      const name = path.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'home';
      await page.screenshot({ path: join(directory, `${String(index + 1).padStart(2, '0')}-${name}.png`), fullPage: true });
      await expect(page.locator('main')).not.toContainText(/Application error|Internal Server Error|This page could not be found/);
    }
  } finally {
    await context.close();
  }
});
