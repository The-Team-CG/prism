import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { PRISM_PRIVACY_NOTICE_VERSION } from '@prism/types';
import { totp } from '../lifecycle/lib.mjs';

export const origins = { client: 'http://127.0.0.1:3301', supplier: 'http://127.0.0.1:3302', guest: 'http://127.0.0.1:3303', event: 'http://127.0.0.1:3304' };
export const adminToken = JSON.parse(readFileSync(join(process.env.BROWSER_RUN_DIRECTORY, 'actors.json'), 'utf8')).adminToken;
export const password = process.env.PRISM_SEED_PASSWORD_CLIENT;
export async function api(method, path, body, token = adminToken) {
  const response = await fetch(`${process.env.E2E_API_URL}${path}`, { method, signal: AbortSignal.timeout(30_000), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!response.ok) throw new Error(`Browser fixture ${method} ${path.split('?')[0]} failed (${response.status}).`);
  const text = await response.text();
  const json = text ? JSON.parse(text) : undefined;
  return json && Object.keys(json).length === 1 && 'data' in json ? json.data : json;
}
export async function inbox(email, pathPart) {
  let found;
  await expect.poll(async () => {
    const result = await fetch(`${process.env.PRISM_MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`).then(r => r.json());
    for (const summary of result.messages ?? []) {
      const message = await fetch(`${process.env.PRISM_MAILPIT_URL}/api/v1/message/${summary.ID}`).then(r => r.json());
      if ((message.Text ?? '').includes(pathPart) && message.To?.some(to => to.Address === email)) { found = message; return true; }
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
export async function createInquiry(label = 'Browser acceptance') {
  const id = randomUUID();
  const email = `browser-${id}@example.test`;
  const eventDate = new Date(Date.now() + 180 * 86_400_000).toISOString().slice(0, 10);
  const inquiry = await api('POST', '/inquiries', { clientName: 'Browser Test Client', companyName: 'Synthetic Browser Tests', email, eventName: `${label} ${id}`, eventType: 'Conference', eventDate, clientType: 'Corporate', source: 'P.R.I.S.M Website', message: 'Phone: 0917 123 4567\nExpected guests: 120', privacyConsentAccepted: true, privacyNoticeVersion: PRISM_PRIVACY_NOTICE_VERSION }, null);
  return { ...inquiry, email, eventDate };
}
export async function acceptedClient() {
  const inquiry = await createInquiry();
  await api('PATCH', `/inquiries/${inquiry.id}/status`, { status: 'accepted' });
  const mail = await inbox(inquiry.email, '/activate');
  return { inquiry, activation: mailLink(mail, '/activate', origins.client), mail };
}
export async function freshEvent() {
  const { inquiry, activation } = await acceptedClient();
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
  await page.waitForURL(/\/privacy|\/dashboard/, { timeout: 30_000 });
  if (page.url().includes('/privacy')) await page.getByRole('button', { name: "I've read this notice" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}
export async function signInPmcm(page, email = 'approver@pmcm.test') {
  await page.goto(`${origins.event}/sign-in`);
  await fillStable(page.getByLabel('Email address'), email);
  await fillStable(page.getByLabel('Password', { exact: true }), email === 'marco@pmcm.test' ? process.env.PRISM_SEED_PASSWORD_COORDINATOR : process.env.PRISM_SEED_PASSWORD_ADMIN);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  const code = page.getByLabel('Authenticator code');
  const sessionFile = join(process.env.BROWSER_RUN_DIRECTORY, `${email === 'marco@pmcm.test' ? 'coordinator' : 'pmcm'}-session.json`);
  // PMCM admins must use MFA; coordinators sign straight in. Wait for whichever screen this account gets.
  await expect.poll(async () => (await code.isVisible()) || /\/(privacy|dashboard)/.test(page.url()), { timeout: 20_000 }).toBe(true);
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
  await code.fill(totp(secret));
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
