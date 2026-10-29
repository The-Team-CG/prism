import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, devices } from '@playwright/test';
import { api, origins, password, persona, freshEvent, privacyIfNeeded, fillStable } from './helpers.mjs';
import { pageCoverageCases } from './page-coverage-cases.mjs';
import { selectClientRecords } from '../../../apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts';

test('all registered pages render across the four portals', async ({ browser }, info) => {
  test.setTimeout(15 * 60_000);
  const device = info.project.name === 'mobile' ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const records = [];
  const failures = [];
  const report = join(process.env.BROWSER_RUN_DIRECTORY, `page-coverage-${info.project.name}.json`);
  mkdirSync(process.env.BROWSER_RUN_DIRECTORY, { recursive: true });
  const saveReport = () => writeFileSync(report, JSON.stringify({ checkedAt: new Date().toISOString(), project: info.project.name, records }, null, 2));
  saveReport();
  const fixture = await freshEvent();
  await api('POST', `/events/${fixture.eventId}/ocular-visit/waive`, { reason: 'Synthetic page coverage venue fixture' });
  const supplierPrefix = `Pagination coverage ${info.project.name}`;
  for (let index = 0; index < 26; index += 1) {
    await api('POST', '/suppliers', { categoryId: 'supcat_digital_registration', name: `${supplierPrefix} ${String(index).padStart(2, '0')}` });
  }
  const draft = await api('POST', `/events/${fixture.eventId}/floorplans`, {
    name: 'Page coverage official layout', sourceType: 'blank', width: 1200, height: 800, gridSize: 20, pax: 120,
    objects: [{ id: 'coverage-table', kind: 'table', position: { x: 100, y: 100 }, size: { width: 80, height: 80 }, rotation: 0, zIndex: 1 }],
  });
  await api('POST', `/events/${fixture.eventId}/floorplans/${draft.id}/submit`);
  await api('POST', `/events/${fixture.eventId}/floorplans/${draft.id}/approve`);
  fixture.draftId = draft.id;
  const quoteRequests = await api('POST', `/events/${fixture.eventId}/quote-requests`, { categoryId: 'supcat_digital_registration', supplierIds: ['sup_xperto'], deadline: fixture.eventDate });
  fixture.quoteToken = quoteRequests[0].accessToken;
  const workspace = await api('GET', '/pmcm/dashboard');
  fixture.clientId = selectClientRecords(workspace.events, workspace.inquiries).find(client => client.inquiries.some(inquiry => inquiry.id === fixture.id))?.id;
  expect(fixture.clientId, 'Page coverage requires an existing client dossier').toBeTruthy();

  for (const app of ['client', 'supplier', 'event', 'guest']) {
    const actor = app === 'supplier' || app === 'event' ? await persona(browser, app === 'event' ? 'pmcm' : app, device) : { context: await browser.newContext(device) };
    const page = actor.page ?? await actor.context.newPage();
    try {
      if (app === 'client') {
        await page.goto(`${origins.client}/sign-in`);
        await fillStable(page.getByLabel('Email address'), fixture.email);
        await fillStable(page.getByLabel('Password', { exact: true }), password);
        await page.getByRole('button', { name: 'Sign in', exact: true }).click();
        await privacyIfNeeded(page);
      }
      if (app === 'guest') {
        const live = await api('GET', '/events/evt_uat_live_261024');
        expect(live, 'Guest page coverage requires a live event').toBeTruthy();
        const lobby = await api('POST', `/events/${live.id}/game-lobby`);
        fixture.guestLobbySlug = lobby.eventSlug;
        await page.goto(`${origins.guest}/open`);
        await fillStable(page.getByLabel('Event code', { exact: true }), live.guestAccessCode);
        await page.getByRole('button', { name: 'Preview event' }).click();
        await page.getByRole('button', { name: 'Continue', exact: true }).click();
        await page.goto(`${origins.guest}/games/events/${lobby.eventSlug}`);
        await page.getByRole('button', { name: /^Play / }).first().click();
        await expect(page).toHaveURL(/\/games\/session\/[^/]+$/);
        fixture.gameSessionId = new URL(page.url()).pathname.split('/').at(-1);
      }
      const cases = pageCoverageCases(app, fixture);
      console.log(`Page coverage ${info.project.name}: checking ${cases.length} ${app} routes`);
      for (const item of cases) {
        const errors = [];
        const badResponses = [];
        const onError = error => errors.push(error.message);
        const onResponse = response => {
          if (response.status() >= 500 || (item.path.startsWith('/dashboard') && response.status() >= 400 && response.url().includes('/api/'))) badResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
        };
        page.on('pageerror', onError);
        page.on('response', onResponse);
        try {
          const response = await page.goto(`${origins[app]}${item.path}`, { waitUntil: 'domcontentloaded' });
          await expect(page.locator('main')).toBeVisible();
          await expect.poll(async () => (await page.locator('main').innerText()).trim().length).toBeGreaterThan(20);
          await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
          const text = await page.locator('main').innerText();
          if (response?.status() >= 400) throw new Error(`Document HTTP ${response.status()}`);
          if (/Application error|Internal Server Error|This page could not be found|A client-side exception has occurred/i.test(text)) throw new Error('Page displayed a route or application failure');
          if (item.path.startsWith('/dashboard') && /could not load your|unable to load (the|your)|failed to load (the|your)|sign in again to continue/i.test(text)) throw new Error('Page displayed a data-loading failure');
          if (item.path.startsWith('/dashboard') && !new URL(page.url()).pathname.startsWith('/dashboard')) throw new Error('Signed-in page unexpectedly redirected out of its portal');
          if (errors.length || badResponses.length) throw new Error(JSON.stringify({ errors, badResponses }));
          records.push({ app, template: item.template, path: item.path.replaceAll(fixture.quoteToken, '[invitation]'), expectedState: item.state, result: 'passed' });
        } catch (error) {
          const failure = { app, template: item.template, path: item.path.replaceAll(fixture.quoteToken, '[invitation]'), error: error.message.replaceAll(fixture.quoteToken, '[invitation]') };
          records.push({ ...failure, result: 'failed' });
          failures.push(failure);
          console.log(`Page coverage ${info.project.name}: failed ${app} ${item.template}: ${failure.error.slice(0, 200)}`);
        } finally {
          page.off('pageerror', onError);
          page.off('response', onResponse);
          saveReport();
        }
      }
      console.log(`Page coverage ${info.project.name}: ${app} route sweep complete`);
      if (app === 'event') {
        try {
          await page.goto(`${origins.event}/dashboard/suppliers?q=${encodeURIComponent(supplierPrefix)}`);
          const rows = page.locator('tbody tr');
          await expect(rows).toHaveCount(25);
          const names = () => rows.locator('td:first-child').allTextContents().then(values => values.map(value => value.trim()));
          const firstPage = await names();
          await page.getByRole('button', { name: 'Next', exact: true }).click();
          await expect(rows).toHaveCount(1);
          const [lastRow] = await names();
          expect(firstPage).not.toContain(lastRow);
          await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
          await page.getByRole('button', { name: 'Previous', exact: true }).click();
          await expect(rows).toHaveCount(25);
          expect(await names()).toEqual(firstPage);
          await page.getByRole('button', { name: 'Next', exact: true }).click();
          await page.getByPlaceholder('Search suppliers', { exact: true }).fill(`${supplierPrefix} 00`);
          await expect(rows).toHaveCount(1);
          await expect(rows.first()).toContainText(`${supplierPrefix} 00`);
          await expect(page.getByRole('button', { name: 'Previous', exact: true })).toBeDisabled();
          await page.getByPlaceholder('Search suppliers', { exact: true }).fill(supplierPrefix);
          await page.locator('#supplier-page-size').selectOption('50');
          await expect(rows).toHaveCount(26);
          await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeDisabled();
          records.push({ app, template: 'supplier pagination controls', path: '/dashboard/suppliers', result: 'passed' });
        } catch (error) {
          const failure = { app, template: 'supplier pagination controls', path: '/dashboard/suppliers', error: error.message };
          records.push({ ...failure, result: 'failed' });
          failures.push(failure);
          console.log(`Page coverage ${info.project.name}: supplier pagination failed: ${error.message.slice(0, 200)}`);
        }
      }
    } finally {
      saveReport();
      await actor.context.close();
    }
  }
  saveReport();
  await info.attach('page coverage', { path: report, contentType: 'application/json' });
  expect(failures, 'Every registered route must render; inspect the attached coverage report').toEqual([]);
});
