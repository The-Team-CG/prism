import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect } from '@playwright/test';
import { api, origins, password, persona, freshEvent, privacyIfNeeded, fillStable, fitsViewport, pageWidths } from './helpers.mjs';
import { pageCoverageCases } from './page-coverage-cases.mjs';
import { assertPageCoverageComplete, pageCoverageApps } from './page-coverage-report.mjs';
import { phoneNavigationGaps, phoneOverflowReport, phoneViewport } from './phone-coverage.mjs';
import { projectDevice } from './browser-devices.mjs';
import { selectClientRecords } from '../../../apps/event/src/features/event-dashboard/shell/model/event-dashboard-selectors.ts';


/** BROWSER_SCREENSHOTS=1 keeps a full-page screenshot of every route in the private run directory. */
async function screenshot(page, project, app, path, failed, order) {
  if (process.env.BROWSER_SCREENSHOTS !== '1') return;
  const directory = join(process.env.BROWSER_RUN_DIRECTORY, 'screenshots', project, app);
  mkdirSync(directory, { recursive: true });
  const name = path.replace(/^\//, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'home';
  // Numbered in visit order, so routes sharing a path keep their own screenshot.
  await page.screenshot({ path: join(directory, `${failed ? 'FAILED-' : ''}${String(order).padStart(3, '0')}-${name}.png`), fullPage: true }).catch(() => {});
}

async function sidebarDestinationIds(page) {
  // The reference sidebar is hidden on phones. Open its responsive drawer to inventory the current route's
  // destinations, then compare their stable IDs with what the phone shell exposes.
  if (!(await page.locator('[data-sidebar="trigger"]').count())) throw new Error('A page with a phone bar must keep its sidebar drawer for comparison');
  const sidebar = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
  // A click that lands before the page hydrates is lost, so it is sent again until the drawer opens.
  await expect(async () => {
    if (!(await sidebar.isVisible())) await page.locator('[data-sidebar="trigger"]').dispatchEvent('click');
    await expect(sidebar).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 15_000 });
  const ids = await sidebar.locator('[data-nav-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-nav-id')));
  await sidebar.locator(':scope > button').last().evaluate(button => button.click());
  await expect(sidebar).toBeHidden();
  const destinations = ids.filter(Boolean);
  if (!destinations.length) throw new Error('The sidebar drawer listed no destinations to compare with the phone bar');
  return destinations;
}

async function assertPhoneNavigation(page, app, path) {
  const bottomBar = page.locator('nav[aria-label="Main"]');
  if (!(await bottomBar.count())) return { applicable: false, missingDestinations: [] };
  const sidebarIds = await sidebarDestinationIds(page);
  const tabIds = await bottomBar.locator('[data-nav-id]').evaluateAll(elements => elements.flatMap(element => [
    element.getAttribute('data-nav-id'),
    ...(element.getAttribute('data-nav-covers') ?? '').split(/\s+/),
  ]));
  const headerIds = await page.locator('header [data-nav-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-nav-id')));
  const more = bottomBar.getByRole('button', { name: /^More(?:,|$)/ });
  let moreIds = [];
  if (await more.count()) {
    // Open through the button handler so this check can inventory destinations without navigating away.
    await more.dispatchEvent('click');
    const sheet = page.getByRole('dialog', { name: 'More' });
    await expect(sheet).toBeVisible();
    moreIds = await sheet.locator('[data-nav-id]').evaluateAll(elements => elements.map(element => element.getAttribute('data-nav-id')));
    await sheet.locator(':scope > button').last().evaluate(button => button.click());
    await expect(sheet).toBeHidden();
  }
  return {
    applicable: true,
    compared: sidebarIds.length,
    signature: tabIds.filter(Boolean).join(' '),
    missingDestinations: phoneNavigationGaps(sidebarIds, [...tabIds, ...headerIds, ...moreIds].filter(Boolean)),
  };
}

/**
 * Taps every tab and top-bar icon the way a thumb does, then opens More by tap and follows its first row. Each tap
 * starts from the same settled page and must leave it, or light a tab already current. Where the bar is the same
 * afterwards, the tapped destination (or More, for a row in it) must be the lit one; a different bar means the tap
 * went into another context, such as an event's own pages.
 */
async function tapPhoneBar(page, app, url) {
  const barIds = () => page.locator('nav[aria-label="Main"] [data-nav-id]:not([disabled])').evaluateAll(elements => elements.map(element => element.getAttribute('data-nav-id')));
  const ids = scope => page.locator(`${scope} [data-nav-id]:not([disabled])`).evaluateAll(elements => elements.map(element => element.getAttribute('data-nav-id')));
  const settle = async () => {
    await expect.poll(async () => (await page.locator('main').innerText()).trim().length).toBeGreaterThan(20);
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
  };
  // A portal swaps its loading frame for the loaded one, so each tap waits for the page to settle first.
  const open = async () => {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await settle();
  };
  const lit = async locator => (await locator.count()) > 0 && (await locator.first().getAttribute('aria-current')) === 'page';
  // Reads the bar and address before the tap, then judges where the tap landed.
  const tapAndLand = async (name, tap, lights) => {
    const before = (await barIds()).join(' ');
    const from = page.url();
    await tap.tap();
    await expect.poll(async () => page.url() !== from || await lit(lights), { message: `Tapping ${name} must open a page` }).toBe(true);
    await settle();
    if ((await barIds()).join(' ') === before) await expect(lights, `Tapping ${name} must light it up`).toHaveAttribute('aria-current', 'page');
  };
  await open();
  const targets = [...(await ids('nav[aria-label="Main"]')).map(id => ['nav[aria-label="Main"]', id]), ...(await ids('header')).map(id => ['header', id])];
  for (const [scope, id] of targets) {
    await open();
    const target = page.locator(`${scope} [data-nav-id="${id}"]`);
    await tapAndLand(id, target, target);
  }
  const more = page.locator('nav[aria-label="Main"]').getByRole('button', { name: /^More(?:,|$)/ });
  await open();
  if (!(await more.count())) return targets.length;
  await more.tap();
  const sheet = page.getByRole('dialog', { name: 'More' });
  await expect(sheet).toBeVisible();
  await sheet.evaluate(element => Promise.all(element.getAnimations().map(animation => animation.finished)));
  expect(await page.evaluate(() => document.activeElement?.matches(':focus-visible') ?? false), 'A tap on More must not open the sheet with a keyboard focus ring').toBe(false);
  if (process.env.BROWSER_SCREENSHOTS === '1') {
    const directory = join(process.env.BROWSER_RUN_DIRECTORY, 'screenshots', 'mobile', app);
    mkdirSync(directory, { recursive: true });
    const name = new URL(url).pathname.split('/').filter(Boolean).slice(0, 2).join('-') || 'root';
    await page.screenshot({ path: join(directory, `phone-more-sheet-${name}.png`) });
  }
  const row = sheet.locator('[data-nav-id]:not([disabled])').first();
  const rowId = await row.getAttribute('data-nav-id');
  await tapAndLand(`More › ${rowId}`, row, more);
  await expect(sheet).toBeHidden();
  return targets.length + 1;
}

async function pageFixture(app) {
  if (app === 'guest') return {};
  const fixture = await freshEvent();
  if (app === 'client' || app === 'event') {
    await api('POST', `/events/${fixture.eventId}/ocular-visit/waive`, { reason: 'Synthetic page coverage venue fixture' });
    const draft = await api('POST', `/events/${fixture.eventId}/floorplans`, {
      // A blank room in metres; the API builds its Pascal scene.
      name: 'Page coverage official layout', sourceType: 'blank', width: 30, height: 20, gridSize: 1, pax: 120,
    });
    await api('POST', `/events/${fixture.eventId}/floorplans/${draft.id}/submit`);
    await api('POST', `/events/${fixture.eventId}/floorplans/${draft.id}/approve`);
    fixture.draftId = draft.id;
  }
  if (app === 'supplier') {
    const requests = await api('POST', `/events/${fixture.eventId}/quote-requests`, { categoryId: 'supcat_digital_registration', supplierIds: ['sup_xperto'], deadline: fixture.eventDate });
    fixture.quoteToken = requests[0].accessToken;
  }
  if (app === 'event') {
    const workspace = await api('GET', '/pmcm/reference');
    fixture.clientId = selectClientRecords(workspace.events, workspace.inquiries).find(client => client.inquiries.some(inquiry => inquiry.id === fixture.id))?.id;
    expect(fixture.clientId, 'Page coverage requires an existing client dossier').toBeTruthy();
  }
  return fixture;
}

for (const app of pageCoverageApps) test(`all registered pages render: ${app}`, async ({ browser }, info) => {
  test.setTimeout(15 * 60_000);
  const device = projectDevice(info.project.name);
  const records = [];
  const failures = [];
  const phoneChecks = [];
  const overflowPages = [];
  const clippedPages = [];
  const tappedBars = new Set();
  const report = join(process.env.BROWSER_RUN_DIRECTORY, `page-coverage-${info.project.name}-${app}.json`);
  mkdirSync(process.env.BROWSER_RUN_DIRECTORY, { recursive: true });
  const saveReport = () => writeFileSync(report, JSON.stringify({ checkedAt: new Date().toISOString(), project: info.project.name, app, records, phoneChecks, overflowPages, clippedPages }, null, 2));
  saveReport();
  const fixture = await pageFixture(app);
  const redact = text => fixture.quoteToken ? text.replaceAll(fixture.quoteToken, '[invitation]') : text;
  const supplierPrefix = `Pagination coverage ${info.project.name} ${fixture.eventId}`;
  if (app === 'event') {
    for (let index = 0; index < 26; index += 1) {
      await api('POST', '/suppliers', { categoryId: 'supcat_digital_registration', name: `${supplierPrefix} ${String(index).padStart(2, '0')}` });
    }
  }
  const actor = app === 'supplier' || app === 'event' ? await persona(browser, app === 'event' ? 'pmcm' : app, device) : { context: await browser.newContext(device) };
  const page = actor.page ?? await actor.context.newPage();
  try {
    const phoneWidth = info.project.name === 'mobile' ? phoneViewport(process.env.BROWSER_PHONE_WIDTH) : null;
    if (phoneWidth) await page.setViewportSize(phoneWidth);
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
      await page.getByRole('button', { name: 'Open my pass', exact: true }).click();
      // The code opens the pass in one step; going on before it arrives cancels one navigation with the other.
      await page.waitForURL(/\/dashboard/);
      await page.goto(`${origins.guest}/games/events/${lobby.eventSlug}`);
      await page.getByRole('button', { name: /^Play / }).first().click();
      await expect(page).toHaveURL(/\/games\/session\/[^/]+$/);
      fixture.gameSessionId = new URL(page.url()).pathname.split('/').at(-1);
    }
    const cases = pageCoverageCases(app, fixture);
    console.log(`Page coverage ${info.project.name}: checking ${cases.length} ${app} routes`);
    for (const [order, item] of cases.entries()) {
      const errors = [];
      const badResponses = [];
      // WebKit reports a cross-origin load cancelled by leaving the page (a prefetch, a poll) as an access-control
      // error; Chromium drops it. Only that message is set aside, and only on WebKit.
      const onError = error => {
        if (browser.browserType().name() === 'webkit' && /due to access control checks/.test(error.message)) return;
        errors.push(error.message);
      };
      const onResponse = response => {
        // An unavailable-session case deliberately opens an unknown session, so its API 404 is the expected answer.
        const expectedMissingSession = item.state === 'unavailable-session' && response.status() === 404;
        if (response.status() >= 500 || (item.path.startsWith('/dashboard') && response.status() >= 400 && !expectedMissingSession && response.url().includes('/api/'))) badResponses.push({ status: response.status(), path: new URL(response.url()).pathname });
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
        if (info.project.name === 'mobile' && ((app === 'client' && item.path.startsWith('/dashboard/calendar')) || (app === 'event' && item.path.startsWith('/dashboard/clients/')))) {
          expect(await fitsViewport(page), 'Calendar and client dossiers must fit the phone without zooming out or sideways page scrolling').toBe(true);
        }
        const signedIn = app !== 'guest' && item.path.startsWith('/dashboard');
        let overflow = null;
        if (info.project.name !== 'desktop' && signedIn) {
          // Phones and the narrowest sidebar width record sideways scrolling for follow-up rather than failing on it.
          const dimensions = await pageWidths(page);
          overflow = phoneOverflowReport(redact(item.path), dimensions.scrollWidth, dimensions.viewportWidth, dimensions.culprits);
          if (overflow) overflowPages.push(overflow);
          if (dimensions.clipped.length) clippedPages.push({ path: redact(item.path), clipped: dimensions.clipped });
        }
        let tapSignature = null;
        if (info.project.name === 'mobile' && signedIn) {
          const navigation = await assertPhoneNavigation(page, app, item.path);
          phoneChecks.push({ path: redact(item.path), navigation: !navigation.applicable ? 'not-applicable' : navigation.missingDestinations.length ? 'failed' : 'passed', compared: navigation.compared ?? 0, missingDestinations: navigation.missingDestinations, overflow: overflow ? { scrollWidth: overflow.scrollWidth, viewportWidth: overflow.viewportWidth, pixels: overflow.overflow } : null });
          if (navigation.missingDestinations.length) throw new Error(`Phone navigation cannot reach sidebar destinations: ${navigation.missingDestinations.join(', ')}`);
          if (navigation.applicable && !tappedBars.has(navigation.signature)) tapSignature = navigation.signature;
        }
        // A guest has no sidebar to compare with, but once a pass is open the same phone bar must still work by thumb.
        if (info.project.name === 'mobile' && app === 'guest' && !tappedBars.has('guest') && await page.locator('nav[aria-label="Main"]').count()) {
          tapSignature = 'guest';
          phoneChecks.push({ path: redact(item.path), navigation: 'not-applicable', compared: 0, missingDestinations: [], overflow: null });
        }
        await screenshot(page, info.project.name, app, redact(item.path), false, order + 1);
        if (tapSignature !== null) {
          // Each distinct bar (the portal's, one inside an event) is tapped through once, from the first page showing it.
          tappedBars.add(tapSignature);
          phoneChecks.at(-1).tapped = await tapPhoneBar(page, app, `${origins[app]}${item.path}`);
        }
        records.push({ app, template: item.template, path: redact(item.path), expectedState: item.state, result: 'passed' });
      } catch (error) {
        await screenshot(page, info.project.name, app, redact(item.path), true, order + 1);
        const failure = { app, template: item.template, path: redact(item.path), error: redact(error.message) };
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
        const rows = page.getByTestId('supplier-card');
        await expect(rows).toHaveCount(25);
        const names = () => rows.evaluateAll(cards => cards.map(card => card.querySelector('button')?.textContent?.trim() ?? ''));
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
        await expect(rows).toHaveCount(25);
        await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeEnabled();
        await page.locator('#supplier-page-size').focus();
        await page.keyboard.press('Enter');
        // Radix moves focus onto the current option after the list opens; keys sent before that are lost.
        await expect(page.getByRole('option', { name: '25', exact: true })).toBeFocused();
        await page.keyboard.press('ArrowDown');
        await expect(page.getByRole('option', { name: '50', exact: true })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.locator('#supplier-page-size')).toHaveText('50');
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
    assertPageCoverageComplete(cases.map(item => ({ ...item, path: redact(item.path) })), records);
  } finally {
    saveReport();
    await actor.context.close();
  }
  saveReport();
  await info.attach('page coverage', { path: report, contentType: 'application/json' });
  if (info.project.name !== 'desktop' && app !== 'guest') {
    console.log(overflowPages.length
      ? `${info.project.name} horizontal overflow (${overflowPages.length} pages): ${overflowPages.map(item => `${item.path} (${item.scrollWidth}px > ${item.viewportWidth}px${item.culprits[0] ? `, widest: ${item.culprits[0]}` : ""})`).join('; ')}`
      : `${info.project.name} horizontal overflow: none`);
    console.log(clippedPages.length
      ? `${info.project.name} clipped text (${clippedPages.length} pages): ${clippedPages.map(item => `${item.path} (${item.clipped[0]})`).join('; ')}`
      : `${info.project.name} clipped text: none`);
    if (info.project.name === 'mobile') console.log(`Phone bars tapped through: ${tappedBars.size}`);
  }
  if (info.project.name === 'mobile' && app === 'guest') expect(tappedBars.has('guest'), 'A guest with a pass open must get the phone bar, and it must work by tap').toBe(true);
  expect(failures, 'Every registered route must render; inspect the attached coverage report').toEqual([]);
});

test('coordinator phone route coverage', async ({ browser }, info) => {
  test.skip(info.project.name !== 'mobile', 'Coordinator phone checks run only in the mobile project.');
  test.setTimeout(5 * 60_000);
  const actor = await persona(browser, 'coordinator', projectDevice('mobile'));
  const views = ['shift', 'tasks', 'issues', 'run-sheet', 'calendar', 'assignments', 'notifications', 'messages', 'account'];
  const checks = [];
  const overflowPages = [];
  const page = actor.page;
  try {
    const phoneWidth = phoneViewport(process.env.BROWSER_PHONE_WIDTH);
    if (phoneWidth) await page.setViewportSize(phoneWidth);
    for (const view of views) {
      const path = `/dashboard?view=${view}`;
      await page.goto(`${origins.event}${path}`, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('main')).toBeVisible();
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});
      expect(new URL(page.url()).pathname).toBe('/dashboard');
      if (view === 'shift') await expect(page.getByRole('button', { name: /switch event/i }), 'The coordinator desk must open an assigned event on its own').toBeVisible();
      const dimensions = await pageWidths(page);
      const overflow = phoneOverflowReport(path, dimensions.scrollWidth, dimensions.viewportWidth, dimensions.culprits);
      if (overflow) overflowPages.push(overflow);
      const navigation = await assertPhoneNavigation(page, 'coordinator', view === 'shift' ? '/dashboard' : path);
      checks.push({ view, navigation: !navigation.applicable ? 'not-applicable' : navigation.missingDestinations.length ? 'failed' : 'passed', missingDestinations: navigation.missingDestinations, overflow: overflow ? { scrollWidth: overflow.scrollWidth, viewportWidth: overflow.viewportWidth, pixels: overflow.overflow } : null });
      expect(navigation.missingDestinations, `Coordinator ${view} sidebar destinations must be reachable on a phone`).toEqual([]);
      if (view === 'shift') checks.at(-1).tapped = await tapPhoneBar(page, 'coordinator', `${origins.event}${path}`);
    }
    console.log(overflowPages.length
      ? `Coordinator phone horizontal overflow (${overflowPages.length} pages): ${overflowPages.map(item => `${item.path} (${item.scrollWidth}px > ${item.viewportWidth}px${item.culprits[0] ? `, widest: ${item.culprits[0]}` : ""})`).join('; ')}`
      : 'Coordinator phone horizontal overflow: none');
    await info.attach('coordinator phone coverage', { body: JSON.stringify({ width: (phoneWidth ?? projectDevice('mobile').viewport).width, checks, overflowPages }, null, 2), contentType: 'application/json' });
  } finally {
    await actor.context.close();
  }
});
