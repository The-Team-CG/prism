// Opt-in report (BROWSER_FIRST_LOAD=1): how each key page's API reads are spread over its first load.
// It counts the serial steps (a read that starts only after every earlier read has finished) and the idle gaps between
// them, which is where a page waits on its shell before asking for its own data. Local timings are too noisy for a
// pass/fail gate, so this writes first-load.json to the private run directory and prints a summary.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, fillStable, origins, persona } from './helpers.mjs';

const LIVE_EVENT = 'evt_uat_live_261024';
const SAMPLES = 3;

/** Every API read the page makes until the network settles, in milliseconds from navigation. */
async function load(page, url) {
  const requests = [];
  const onFinished = (request) => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return;
    if (!request.url().startsWith('http://127.0.0.1:4300/')) return;
    const timing = request.timing();
    requests.push({ method: request.method(), path: new URL(request.url()).pathname.slice(4), start: timing.startTime, end: timing.startTime + timing.responseEnd });
  };
  page.on('requestfinished', onFinished);
  const navigationStart = Date.now();
  await page.goto(url);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1_500);
  page.off('requestfinished', onFinished);
  return requests
    .map((request) => ({ ...request, start: Math.round(request.start - navigationStart), end: Math.round(request.end - navigationStart) }))
    .sort((left, right) => left.start - right.start);
}

/** Serial steps, the idle time between them, and reads of the same path made more than once. */
export function summarize(requests) {
  let steps = 0;
  let stepEnd = -1;
  let idle = 0;
  for (const request of requests) {
    if (request.start >= stepEnd) {
      steps += 1;
      if (stepEnd >= 0) idle += request.start - stepEnd;
    }
    stepEnd = Math.max(stepEnd, request.end);
  }
  const counts = new Map();
  for (const request of requests) counts.set(`${request.method} ${request.path}`, (counts.get(`${request.method} ${request.path}`) ?? 0) + 1);
  return {
    requests: requests.length,
    firstRead: requests[0]?.start ?? null,
    lastRead: requests.length ? Math.max(...requests.map((request) => request.end)) : null,
    steps,
    idleBetweenSteps: idle,
    repeated: [...counts].filter(([, count]) => count > 1).map(([key, count]) => `${key} x${count}`),
  };
}

async function measure(browser, device, role, pages, open = () => persona(browser, role, device)) {
  const actor = await open();
  const state = await actor.context.storageState();
  const results = {};
  for (const [name, url] of Object.entries(pages)) {
    await load(actor.page, url); // warm-up, not kept
    const samples = [];
    for (let index = 0; index < SAMPLES; index += 1) {
      // A fresh context with the same session: no portal cache or HTTP cache carries over between samples.
      const context = await browser.newContext({ ...device, storageState: state });
      samples.push(await load(await context.newPage(), url));
      await context.close();
    }
    const summaries = samples.map(summarize);
    results[name] = { url: url.replace(/^https?:\/\/[^/]+/, ''), summaries, lastSample: samples.at(-1) };
    const middle = [...summaries].sort((left, right) => left.lastRead - right.lastRead)[Math.floor(SAMPLES / 2)];
    console.log(`FIRST_LOAD ${role} ${name}: ${middle.requests} reads, first ${middle.firstRead}ms, done ${middle.lastRead}ms, ${middle.steps} steps, ${middle.idleBetweenSteps}ms idle${middle.repeated.length ? `, repeated ${middle.repeated.join(', ')}` : ''}`);
  }
  await actor.context.close();
  return results;
}

test.describe('first load report', () => {
  test.skip(process.env.BROWSER_FIRST_LOAD !== '1', 'Opt-in: set BROWSER_FIRST_LOAD=1');

  test('first load of key pages in every portal', async ({ browser }, info) => {
    test.setTimeout(20 * 60_000);
    const device = projectDevice(info.project.name);
    const live = await api('GET', `/events/${LIVE_EVENT}`);
    const event = (path) => `${origins.event}/dashboard/events/${LIVE_EVENT}/${path}`;
    const report = {};

    report.pmcm = await measure(browser, device, 'pmcm', {
      home: `${origins.event}/dashboard`,
      briefing: event('briefing'),
      suppliers: event('suppliers'),
      billing: event('billing'),
      finance: `${origins.event}/dashboard/finance`,
    });
    report.coordinator = await measure(browser, device, 'coordinator', { home: `${origins.event}/coordinator` });

    // The seeded client opens its own event, whichever the fixtures gave it.
    report.client = await measure(browser, device, 'client', { home: `${origins.client}/dashboard` });
    const clientEvent = await (async () => {
      const client = await persona(browser, 'client', device);
      await client.page.goto(`${origins.client}/dashboard/events`);
      const href = await client.page.locator('a[href*="/dashboard/events/evt_"]').first().getAttribute('href', { timeout: 30_000 });
      await client.context.close();
      return href.split('/')[3];
    })();
    Object.assign(report.client, await measure(browser, device, 'client', {
      overview: `${origins.client}/dashboard/events/${clientEvent}/overview`,
      billing: `${origins.client}/dashboard/events/${clientEvent}/billing`,
      documents: `${origins.client}/dashboard/events/${clientEvent}/documents`,
    }));

    report.supplier = await measure(browser, device, 'supplier', {
      home: `${origins.supplier}/dashboard`,
      requests: `${origins.supplier}/dashboard/requests`,
      bookings: `${origins.supplier}/dashboard/bookings`,
      payments: `${origins.supplier}/dashboard/payments`,
    });

    // A guest has no account: the event code opens a pass in a fresh context.
    report.guest = await measure(browser, device, 'guest', { pass: `${origins.guest}/dashboard` }, async () => {
      const context = await browser.newContext(device);
      const page = await context.newPage();
      await page.goto(`${origins.guest}/open`);
      await fillStable(page.getByLabel('Event code', { exact: true }), live.guestAccessCode);
      await page.getByRole('button', { name: 'Open my pass', exact: true }).click();
      await page.waitForURL(/\/dashboard/);
      return { context, page };
    });

    writeFileSync(join(process.env.BROWSER_RUN_DIRECTORY, `first-load-${info.project.name}.json`), JSON.stringify(report, null, 2));
  });
});
