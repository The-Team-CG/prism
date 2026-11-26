import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import { totp } from '../lifecycle/lib.mjs';

export const origins = { client: 'http://127.0.0.1:3301', supplier: 'http://127.0.0.1:3302', guest: 'http://127.0.0.1:3303', event: 'http://127.0.0.1:3304' };
export const adminToken = JSON.parse(readFileSync(join(process.env.BROWSER_RUN_DIRECTORY, 'actors.json'), 'utf8')).adminToken;
export const password = process.env.PRISM_SEED_PASSWORD_CLIENT;
// Public submissions (every fixture inquiry) are limited to 10 a minute per address. The suite creates them faster than
// that late in a run, so a throttled request waits out the API's Retry-After instead of failing the test.
const THROTTLE_RETRIES = 2;
async function waitForRetryAfter(response) {
  const seconds = Number(response.headers.get('retry-after'));
  await new Promise(resolve => setTimeout(resolve, (seconds > 0 ? Math.min(seconds, 60) : 5) * 1000));
}
export async function api(method, path, body, token = adminToken) {
  let response;
  for (let attempt = 0; attempt <= THROTTLE_RETRIES; attempt += 1) {
    response = await fetch(`${process.env.E2E_API_URL}${path}`, { method, signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    if (response.status !== 429 || attempt === THROTTLE_RETRIES) break;
    await waitForRetryAfter(response);
  }
  if (!response.ok) throw new Error(`Browser fixture ${method} ${path.split('?')[0]} failed (${response.status}).`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  return json && Object.keys(json).length === 1 && 'data' in json ? json.data : json;
}
async function mailpitJson(path) {
  const response = await fetch(`${process.env.PRISM_MAILPIT_URL}/api/v1/${path}`);
  if (!response.ok) throw new Error(`Local Mailpit ${path.split('/')[0]} request failed with HTTP ${response.status}.`);
  return response.json();
}
export async function inbox(email, pathPart) {
  let found;
  const ruledOut = new Set();
  await expect.poll(async () => {
    const result = await mailpitJson(`search?query=${encodeURIComponent(`to:${email}`)}`);
    for (const summary of result.messages ?? []) {
      if (ruledOut.has(summary.ID)) continue;
      const message = await mailpitJson(`message/${summary.ID}`);
      if ((message.Text ?? '').includes(pathPart) && message.To?.some(to => to.Address === email)) { found = message; return true; }
      ruledOut.add(summary.ID);
    }
    return false;
  }, { timeout: 45_000, message: 'Expected recipient-specific test email in local Mailpit' }).toBe(true);
  return found;
}
export function mailLink(message, pathPart, origin) {
  const link = message.Text.match(/https?:\/\/[^\s<>"']+/g)?.find(value => value.includes(pathPart));
  if (!link || new URL(link).origin !== origin) throw new Error('Test email did not contain the intended local portal link.');
  return link;
}
export async function createInquiry(label = 'Browser acceptance', { daysAhead = 180 } = {}) {
  const id = randomUUID();
  const email = `browser-${id}@example.test`;
  const eventDate = new Date(Date.now() + daysAhead * 86_400_000).toISOString().slice(0, 10);
  const inquiry = await api('POST', '/inquiries', { clientName: 'Browser Test Client', companyName: 'Synthetic Browser Tests', email, eventName: `${label} ${id}`, eventType: 'Conference', eventDate, clientType: 'Corporate', source: 'P.R.I.S.M Website', message: 'Phone: 0917 123 4567\nExpected guests: 120', privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION }, null);
  return { ...inquiry, email, eventDate };
}
export async function acceptedClient(label, options) {
  const inquiry = await createInquiry(label, options);
  await api('PATCH', `/inquiries/${inquiry.id}/status`, { status: 'accepted' });
  const mail = await inbox(inquiry.email, '/activate');
  return { inquiry, activation: mailLink(mail, '/activate', origins.client), mail };
}
export async function freshEvent(label, options) {
  const { inquiry, activation } = await acceptedClient(label, options);
  await api('POST', '/auth/activate', { token: new URL(activation).searchParams.get('token'), password }, null);
  const client = await api('POST', '/auth/login', { email: inquiry.email, password }, null);
  if (client.privacyNoticeRequired) await api('POST', '/auth/privacy-notice/acknowledge', { version: PRISM_PRIVACY_NOTICE_VERSION }, client.accessToken);
  const execution = await api('POST', `/inquiries/${inquiry.id}/conforme-executions`, { templateVersion: 1, templateContent: 'Synthetic browser acceptance: client agrees to the PMCM event management terms, scope and payment schedule.' });
  const sign = { executionId: execution.id, templateVersion: execution.templateVersion, documentSha256: execution.documentSha256, consentAccepted: true };
  await api('POST', '/client/conforme-execution/sign', sign, client.accessToken);
  const signed = await api('POST', `/inquiries/${inquiry.id}/conforme-executions/${execution.id}/sign`, sign);
  return { ...inquiry, eventId: signed.eventId, clientToken: client.accessToken };
}
/**
 * Types into a field and confirms the value stuck. Text typed before React hydrates a controlled input is reset to the
 * initial state on hydration, so the fill is retried until the page keeps it.
 */
export async function fillStable(locator, value) {
  await expect(async () => {
    await locator.fill(value);
    await expect(locator).toHaveValue(value, { timeout: 1_000 });
  }).toPass({ timeout: 20_000 });
}
export async function privacyIfNeeded(page) {
  // Coordinators land in their own portal at /coordinator; everyone else on /dashboard.
  await page.waitForURL(/\/privacy|\/dashboard|\/coordinator/, { timeout: 30_000 });
  if (page.url().includes('/privacy')) await page.getByRole('button', { name: "I've read this notice" }).click();
  await expect(page).toHaveURL(/\/dashboard|\/coordinator/, { timeout: 60_000 });
}
export async function signInPmcm(page, email = 'approver@pmcm.test') {
  await page.goto(`${origins.event}/sign-in`);
  await fillStable(page.getByLabel('Email address'), email);
  await fillStable(page.getByLabel('Password', { exact: true }), email === 'marco@pmcm.test' ? process.env.PRISM_SEED_PASSWORD_COORDINATOR : process.env.PRISM_SEED_PASSWORD_ADMIN);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const code = page.getByLabel('Authenticator code');
  const sessionFile = join(process.env.BROWSER_RUN_DIRECTORY, `${email === 'marco@pmcm.test' ? 'coordinator' : 'pmcm'}-session.json`);
  // PMCM admins must use MFA; coordinators sign straight in. Wait for whichever screen this account gets.
  await expect.poll(async () => (await code.isVisible()) || /\/(privacy|dashboard|coordinator)/.test(page.url()), { timeout: 20_000 }).toBe(true);
  if (!(await code.isVisible())) {
    await privacyIfNeeded(page);
    await page.context().storageState({ path: sessionFile });
    return;
  }
  const file = join(process.env.BROWSER_RUN_DIRECTORY, 'browser-mfa.json');
  let secret;
  if (await page.getByText('Or enter this setup key').isVisible()) {
    secret = await page.locator('code').innerText();
    const secrets = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {};
    writeFileSync(file, JSON.stringify({ ...secrets, [email]: secret }), { mode: 0o600 });
  } else if (existsSync(file)) secret = JSON.parse(readFileSync(file, 'utf8'))[email];
  if (!secret) throw new Error('Browser MFA setup key is unavailable.');
    await code.fill('123');
    await expect(page.getByRole('button', { name: 'Verify code', exact: true })).toBeDisabled();
    await code.fill(totp(secret));
    await expect(page.getByRole('button', { name: 'Verify code', exact: true })).toBeEnabled();
  await page.locator('button[type=submit]').click();
  await privacyIfNeeded(page);
  await page.context().storageState({ path: sessionFile });
}

export async function persona(browser, role, device = {}) {
  const state = join(process.env.BROWSER_RUN_DIRECTORY, `${role}-session.json`);
  const context = await browser.newContext({ ...device, ...(existsSync(state) ? { storageState: state } : {}) });
  const page = await context.newPage();
  if (!existsSync(state)) {
    if (role === 'pmcm' || role === 'coordinator') await signInPmcm(page, role === 'pmcm' ? 'approver@pmcm.test' : 'marco@pmcm.test');
    else {
      await page.goto(`${origins[role]}/sign-in`);
      await fillStable(page.getByLabel('Email address'), role === 'client' ? 'ana@ayala.test' : 'ops@xperto.test');
      await fillStable(page.getByLabel('Password', { exact: true }), role === 'client' ? password : process.env.PRISM_SEED_PASSWORD_SUPPLIER);
      await page.getByRole('button', { name: 'Sign in', exact: true }).click();
      await privacyIfNeeded(page);
      await context.storageState({ path: state });
    }
  }
  return { context, page };
}

/**
 * The page's width against the phone or tablet it is shown on, what pushes it wide, and text cut off inside it.
 * Mobile emulation zooms out to fit wide content, which stretches window.innerWidth along with it, so the device width
 * is the root element's clientWidth.
 */
export async function pageWidths(page) {
  return page.evaluate(() => {
    const scrollWidth = document.documentElement.scrollWidth;
    const viewportWidth = document.documentElement.clientWidth;
    const describe = (element, right) => {
      const classes = typeof element.className === 'string' ? element.className.trim().split(/\s+/).slice(0, 6).join('.') : '';
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''} → ${Math.round(right)}px "${(element.textContent ?? '').trim().slice(0, 40)}"`;
    };
    const clips = element => ['hidden', 'clip', 'auto', 'scroll'].includes(getComputedStyle(element).overflowX);
    const insideClip = element => {
      for (let node = element.parentElement; node && node !== document.body; node = node.parentElement) if (clips(node)) return node;
      return null;
    };
    const elements = [...document.body.querySelectorAll('*')];
    // What pushes the page wide: elements past both the screen and their parent, that no ancestor clips or scrolls.
    const culprits = [];
    if (scrollWidth > viewportWidth + 1) {
      for (const element of elements) {
        const right = element.getBoundingClientRect().right;
        const parent = element.parentElement?.getBoundingClientRect().right ?? viewportWidth;
        const position = getComputedStyle(element).position;
        // An absolutely placed element can escape a scroller that is not its containing block, so it stays a suspect.
        if (right <= viewportWidth + 1 || right <= parent + 1 || position === 'fixed' || (position !== 'absolute' && insideClip(element))) continue;
        if (position !== 'absolute' && !element.checkVisibility()) continue;
        culprits.push(describe(element, right));
        if (culprits.length === 5) break;
      }
    }
    // Text a hidden-overflow box cuts off without an ellipsis: the page fits, but part of what it says is not shown.
    // An ellipsis on the way up is a deliberate shortening, and a 1px box is screen-reader text.
    const truncated = (element, box) => {
      for (let node = element; node && node !== box; node = node.parentElement) if (getComputedStyle(node).textOverflow === 'ellipsis') return true;
      return getComputedStyle(box).textOverflow === 'ellipsis';
    };
    const clipped = [];
    for (const element of elements) {
      if (element.children.length || !(element.textContent ?? '').trim() || element.closest('[aria-hidden="true"]')) continue;
      // Not drawn at all, such as a closed <details> row: nothing is cut off that anyone could see.
      if (!element.checkVisibility({ visibilityProperty: true })) continue;
      const box = insideClip(element);
      if (!box || ['auto', 'scroll'].includes(getComputedStyle(box).overflowX) || box.getBoundingClientRect().width <= 1 || truncated(element, box)) continue;
      const right = element.getBoundingClientRect().right;
      const edge = box.getBoundingClientRect().right;
      if (right <= edge + 1) continue;
      clipped.push(describe(element, right));
      if (clipped.length === 5) break;
    }
    return { scrollWidth, viewportWidth, culprits, clipped };
  });
}

export async function fitsViewport(page) {
  const { scrollWidth, viewportWidth, culprits } = await pageWidths(page);
  return scrollWidth <= viewportWidth + 1 ? true : culprits;
}
