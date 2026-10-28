import {submitPublicInquiry} from './inquiry-actions.mjs';
import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { origins, api, password, inbox, mailLink, createInquiry, acceptedClient, freshEvent, signInPmcm, privacyIfNeeded, fillStable } from './helpers.mjs';

test('public inquiry uses the calendar and persists the submitted brief',async ({page}) => {
  await submitPublicInquiry(page);
});

test('PMCM completes MFA and accepts an inquiry through the portal', async ({ page }) => {
  const inquiry = await createInquiry('PMCM browser approval');
  await signInPmcm(page);
  await page.goto(`${origins.event}/dashboard/inquiries`);
  await page.getByPlaceholder('Search client, email, or event...').fill(inquiry.eventName);
  await page.getByRole('button', { name: `Review inquiry ${inquiry.eventName}`, exact: true }).click();
  await page.getByRole('button', { name: 'Accept', exact: true }).click();
  await expect(page.getByText('Inquiry accepted', { exact: true })).toBeVisible();
  const mail = await inbox(inquiry.email, '/activate');
  expect(mail.HTML).toContain('/activate');
  expect(new URL(mailLink(mail, '/activate', origins.client)).searchParams.get('token')).toBeTruthy();
});

test('client activates and resets a password using locally captured email links', async ({ page }) => {
  const client = await acceptedClient();
  await page.goto(client.activation);
  await page.getByLabel('New password', { exact: true }).fill(password);
  await page.getByLabel('Confirm new password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Set password', exact: true }).click();
  await expect(page.getByRole('heading', { name: "You're all set" })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await fillStable(page.getByLabel('Email address'), client.inquiry.email);
  await fillStable(page.getByLabel('Password', { exact: true }), password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await privacyIfNeeded(page);
  await page.goto(`${origins.client}/password-reset`);
  await fillStable(page.getByLabel('Email address'), client.inquiry.email);
  await page.locator('button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  const mail = await inbox(client.inquiry.email, '/password-reset');
  await page.goto(mailLink(mail, '/password-reset', origins.client));
  const replacement = `${password}New`;
  await page.getByLabel('New password', { exact: true }).fill(replacement);
  await page.getByLabel('Confirm new password', { exact: true }).fill(replacement);
  await page.locator('button[type=submit]').click();
  await expect(page.getByRole('heading', { name: 'Password updated' })).toBeVisible();
  await page.getByRole('link', { name: 'Sign in', exact: true }).click();
  await fillStable(page.getByLabel('Email address'), client.inquiry.email);
  await fillStable(page.getByLabel('Password', { exact: true }), replacement);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test('supplier follows the emailed quote request and submits a persisted quote', async ({ page }) => {
  const event = await freshEvent();
  const requests = await api('POST', `/events/${event.eventId}/quote-requests`, { categoryId: 'supcat_digital_registration', supplierIds: ['sup_xperto'], deadline: event.eventDate });
  const mail = await inbox('ops@xperto.test', requests[0].accessToken);
  const link = mailLink(mail, '/quote-requests/', origins.supplier);
  await page.goto(link);
  await expect(page.getByRole('heading', { name: event.eventName })).toBeVisible();
  await page.getByLabel('Quote amount (PHP)', { exact: true }).fill('50000');
  await page.getByLabel('Inclusions, one per line').fill('Registration equipment\nOn-site technical support');
  await page.getByLabel('Payment terms', { exact: true }).fill('50% deposit, 50% after event');
  await page.getByRole('button', { name: 'Send quote to PMCM', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Your quote has been sent to PMCM for review.');
  const detail = await api('GET', `/quote-requests/${new URL(link).pathname.split('/').at(-1)}`, undefined, null);
  expect(detail.quote.amount).toBe(50000);
});

test('guest previews an event and submits a named check-in with consent', async ({ page }) => {
  const eventId = 'evt_uat_live_261024';
  const name = `Browser Guest ${randomUUID()}`;
  await api('POST', `/guest/events/${eventId}/roster/import`, { source: 'csv', rows: [{ sourceKey: randomUUID(), guestName: name }] });
  const detail = await api('GET', `/events/${eventId}`);
  await page.goto(`${origins.guest}/open`);
  await page.getByLabel('Event code', { exact: true }).fill(detail.guestAccessCode);
  await page.getByRole('button', { name: 'Preview event' }).click();
  await expect(page.getByText(detail.eventName, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('Guest name', { exact: true })).toBeVisible();
  await page.getByLabel('Guest name', { exact: true }).fill(name);
  await page.getByRole('checkbox', { name: /I consent to PMCM recording/ }).check();
  await page.getByRole('button', { name: /check.in/i }).click();
  await expect(page.getByRole('heading', { name: 'Check-in request received' })).toBeVisible();
});

test('signed-out visitors are redirected before private dashboards render', async ({ page }) => {
  for (const role of ['client', 'supplier', 'event']) {
    await page.goto(`${origins[role]}/dashboard`);
    await expect(page).toHaveURL(/\/sign-in/);
    await expect(page.getByLabel('Email address')).toBeVisible();
  }
  await page.goto(`${origins.guest}/dashboard`);
  await expect(page).toHaveURL(/\/open/);
});

test('client credentials do not open PMCM or supplier workspaces', async ({ page }) => {
  for (const role of ['event', 'supplier']) {
    await page.goto(`${origins[role]}/sign-in`);
    await fillStable(page.getByLabel('Email address'), 'ana@ayala.test');
    await fillStable(page.getByLabel('Password', { exact: true }), password);
    await page.getByRole('button', { name: 'Sign in', exact: true }).click();
    await expect(page.getByRole('alert').filter({ hasText: /client/i })).toBeVisible();
    await expect(page).toHaveURL(/\/sign-in/);
  }
});
