import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { api, origins, persona } from './helpers.mjs';
import { CLIENT_DOSSIER_VIEWS, EVENT_WORKSPACE_ROUTE_TABS, SECTION_ROUTE_ITEMS } from '../../../apps/event/src/features/event-dashboard/shell/model/event-dashboard-routing.ts';
import { selectClientRecords } from '../../../apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts';

/**
 * Screenshots of the seeded five-year history as each fixture account sees it: Ana (client), XPERTO (supplier),
 * PMCM and Marco (coordinator). Runs only with BROWSER_SEED_HISTORY=1 and BROWSER_SCREENSHOTS=1; the page-coverage
 * sweep signs in fresh actors, so this is where years of data appear. Event ids follow the history profile
 * (evt_hist_241 is today's live event for Ana; 005 archived, 195 planning, 188 closing out).
 */
const enabled = process.env.BROWSER_SEED_HISTORY === '1' && process.env.BROWSER_SCREENSHOTS === '1';

const ROUTES = {
  client: ['/dashboard', '/dashboard/events', '/dashboard/events/completed', '/dashboard/events/upcoming', '/dashboard/calendar', '/dashboard/billing', '/dashboard/files', '/dashboard/events/evt_hist_241/overview', '/dashboard/events/evt_hist_005/summary', '/dashboard/notifications'],
  supplier: ['/dashboard', '/dashboard/requests', '/dashboard/bookings', '/dashboard/calendar', '/dashboard/payments', '/dashboard/notifications'],
  // Every PMCM screen: sections and their sub-views, Ana's client profile ({client} resolves at run time), the
  // planning event's workspace tabs, today's live event, one closing out and one archived.
  pmcm: [
    '/dashboard', '/dashboard/inquiries', '/dashboard/events', '/dashboard/calendar', '/dashboard/messages', '/dashboard/notifications', '/dashboard/files',
    '/dashboard/clients', ...CLIENT_DOSSIER_VIEWS.map(({ view }) => (view === 'overview' ? '/dashboard/clients/{client}' : `/dashboard/clients/{client}/${view}`)),
    '/dashboard/suppliers', ...Object.keys(SECTION_ROUTE_ITEMS.suppliers).filter(view => view !== 'all').map(view => `/dashboard/suppliers/${view}`),
    '/dashboard/team', ...Object.keys(SECTION_ROUTE_ITEMS.team).filter(view => view !== 'all').map(view => `/dashboard/team/${view}`),
    '/dashboard/finance', '/dashboard/finance/receipts', '/dashboard/finance/payment-details',
    ...Object.keys(EVENT_WORKSPACE_ROUTE_TABS).map(view => `/dashboard/events/evt_hist_195/${view}`),
    ...['overview', 'live-ops', 'run-sheet', 'registration', 'coordinators', 'messages'].map(view => `/dashboard/events/evt_hist_241/${view}`),
    '/dashboard/events/evt_hist_188/closure', '/dashboard/events/evt_hist_188/billing', '/dashboard/events/evt_hist_005/overview', '/dashboard/events/evt_hist_005/closure',
    '/dashboard/audit', '/dashboard/privacy', '/dashboard/account', '/dashboard/settings',
  ],
  coordinator: [
    '/dashboard', '/dashboard?view=tasks', '/dashboard?view=issues', '/dashboard?view=run-sheet', '/dashboard?view=calendar', '/dashboard?view=assignments',
    '/dashboard?view=registration', '/dashboard?view=notifications', '/dashboard?view=messages', '/dashboard?view=account',
  ],
};
const ORIGIN = { client: 'client', supplier: 'supplier', pmcm: 'event', coordinator: 'event' };

for (const role of Object.keys(ROUTES)) test(`history gallery: ${role}`, async ({ browser }, info) => {
  test.skip(!enabled, 'Set BROWSER_SEED_HISTORY=1 and BROWSER_SCREENSHOTS=1 for the history gallery');
  test.setTimeout(10 * 60_000);
  const { context, page } = await persona(browser, role, info.project.use);
  const directory = join(process.env.BROWSER_RUN_DIRECTORY, 'screenshots', info.project.name, `history-${role}`);
  mkdirSync(directory, { recursive: true });
  const capture = async (filename) => {
    await page.evaluate(() => window.scrollTo({ top: 0, left: 0, behavior: 'instant' }));
    await page.screenshot({ path: join(directory, filename), fullPage: true, animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
  };
  try {
    let routes = process.env.BROWSER_GALLERY_CALENDAR_ONLY === '1' ? ROUTES[role].filter(path => path.includes('calendar')) : ROUTES[role];
    if (routes.some(path => path.includes('{client}'))) {
      const workspace = await api('GET', '/pmcm/reference');
      const client = selectClientRecords(workspace.events, workspace.inquiries).find(record => record.inquiries.some(inquiry => inquiry.email === 'ana@ayala.test'));
      expect(client, "The history gallery needs Ana's client profile").toBeTruthy();
      routes = routes.map(path => path.replace('{client}', client.id));
    }
    for (const [index, path] of routes.entries()) {
      await page.goto(`${origins[ORIGIN[role]]}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
      // The coordinator's event data loads after the page; wait for it so the capture shows the work, not a skeleton.
      if (role === 'coordinator') await page.getByText('Loading your tasks, issues and check-ins').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
      if (path.includes('calendar')) {
        // The history coordinator's opening date has only an event date, so it also uses the month overview.
        const openingView = 'Month';
        await expect(page.getByRole('button', { name: `Calendar view: ${openingView}`, exact: true })).toBeVisible();
        // Titled "Overdue and up next" or "Up next"; phones start it closed unless something is overdue.
        const highlights = page.getByRole('region', { name: /up next$/i });
        const showHighlights = page.getByRole('button', { name: /^Show .*up next$/ });
        if (!(await highlights.isVisible())) await showHighlights.click();
        await expect(highlights).toBeVisible();
        const highlightCards = highlights.getByRole('button');
        expect(await highlightCards.count()).toBeLessThanOrEqual(3);
        const title = await highlightCards.first().locator('span.text-sm').first().textContent();
        await highlightCards.first().click();
        await expect(page.getByRole('dialog').getByRole('heading', { name: title, exact: true })).toBeVisible();
        await expect(page.getByRole('dialog').locator('[data-slot="sheet-footer"]').getByRole('link').or(page.getByRole('dialog').locator('[data-slot="sheet-footer"]').getByRole('button')).first()).toBeVisible();
        await page.keyboard.press('Escape');
        await capture('calendar-highlights.png');
        await page.getByRole('button', { name: /^Hide .*up next$/ }).click();
        await expect(highlights).toBeHidden();
        if (info.project.name === 'desktop') await showHighlights.click();
        const search = page.getByRole('searchbox', { name: 'Search schedule' });
        await search.fill('no-matching-calendar-entry-9c03');
        await expect(page.getByRole('status')).toContainText('No matching entries');
        await expect(highlights).toBeHidden();
        await search.clear();
        await page.getByRole('button', { name: 'Filter schedule', exact: true }).click();
        await page.getByRole('button', { name: 'Timed entries', exact: true }).click();
        await expect(page.getByRole('button', { name: 'Timed entries', exact: true })).toHaveAttribute('aria-pressed', 'true');
        await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
        const categories = page.getByRole('group', { name: 'Schedule categories' }).getByRole('button');
        if (await categories.count() > 1) {
          await categories.nth(1).click();
          await expect(categories.nth(1)).toHaveAttribute('aria-pressed', 'true');
          await categories.first().click();
        }
        if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await capture('calendar-filters.png');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: 'Manila time', exact: true }).click();
        await expect(page.getByText('Asia/Manila · UTC+08:00')).toBeVisible();
        await capture('calendar-timezone.png');
        await page.keyboard.press('Escape');
        await page.getByRole('button', { name: `Calendar view: ${openingView}`, exact: true }).click();
        await page.getByRole('menuitem', { name: /^Week/ }).click();
        await capture('calendar-week.png');
        await page.getByRole('button', { name: 'Calendar view: Week', exact: true }).click();
        await page.getByRole('menuitem', { name: /^Day/ }).click();
        const agenda = page.getByRole('region', { name: 'Daily agenda' });
        // The agenda checks need entries on the opening day; PMCM's history calendar has none today, so it only
        // captures the day view.
        if (role !== 'coordinator') await capture('calendar-day.png');
        else {
          await expect(agenda).toBeVisible();
          await expect(agenda.getByRole('listitem').first()).toBeVisible();
          await expect(page.getByRole('button', { name: 'Agenda', exact: true })).toHaveAttribute('aria-pressed', 'true');
          await capture('calendar-day-agenda.png');
          await agenda.getByRole('button').first().click();
          await expect(page.getByRole('dialog').locator('[data-slot="sheet-footer"]')).toBeVisible();
          await page.keyboard.press('Escape');
          const selectedDate = await agenda.getAttribute('data-date');
          await page.getByRole('button', { name: 'Next day', exact: true }).click();
          const nextDate = new Date(`${selectedDate}T00:00:00Z`);
          nextDate.setUTCDate(nextDate.getUTCDate() + 1);
          await expect(agenda).toHaveAttribute('data-date', nextDate.toISOString().slice(0, 10));
          await page.getByRole('button', { name: 'Previous day', exact: true }).click();
          await expect(agenda).toHaveAttribute('data-date', selectedDate);
          await page.getByRole('button', { name: 'Time grid', exact: true }).click();
          await expect(agenda).toBeHidden();
          await expect(page.locator(`[role="gridcell"][data-date="${selectedDate}"]`)).toBeVisible();
          await capture('calendar-day-time-grid.png');
          if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
          await page.getByRole('button', { name: 'Agenda', exact: true }).click();
          await expect(agenda).toBeVisible();
        }
        await page.getByRole('button', { name: 'Calendar view: Day', exact: true }).click();
        await page.getByRole('menuitem', { name: new RegExp(`^${openingView}`) }).click();
        if (info.project.name === 'mobile') expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      }
      const name = path.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'home';
      await capture(`${String(index + 1).padStart(2, '0')}-${name}.png`);
      await expect(page.locator('main')).not.toContainText(/Application error|Internal Server Error|This page could not be found/);
    }
    if (role === 'coordinator' && process.env.BROWSER_GALLERY_CALENDAR_ONLY !== '1') {
      // The quick report, opened from the floating button on a phone and the top bar on a desktop.
      await page.goto(`${origins.event}/dashboard`, { waitUntil: 'domcontentloaded' });
      await page.getByText('Loading your tasks, issues and check-ins').waitFor({ state: 'detached', timeout: 20_000 }).catch(() => {});
      await page.getByRole('button', { name: 'Report an issue' }).filter({ visible: true }).first().click();
      const report = page.getByRole('dialog', { name: 'Report an issue' });
      await report.getByRole('button', { name: 'Supplier' }).click();
      await page.screenshot({ path: join(directory, 'report-issue-panel.png'), animations: 'disabled', style: 'nextjs-portal { visibility: hidden; }' });
    }
  } finally {
    await context.close();
  }
});
