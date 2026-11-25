import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, closeAll, signedInClient } from './journey-fixtures.mjs';

test('after the event ends a guest sends feedback and the client a testimonial; PMCM approves both', async ({ browser }, info) => {
  test.setTimeout(4 * 60_000);
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser guest feedback');
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  await api('POST', `/events/${event.eventId}/start-event-day`, {});
  await api('POST', `/events/${event.eventId}/actual-end`, { actualEndedAt: new Date(Date.now() - 60 * 60_000).toISOString() });
  const { guestAccessCode } = await api('GET', `/events/${event.eventId}`);
  const guestContext = await browser.newContext(device);
  const guest = await guestContext.newPage();
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [guestContext, pmcm.context, client.context];
  const guestName = `Feedback Guest ${info.project.name}`;
  try {
    await guest.goto(`${origins.guest}/open`);
    await guest.getByLabel('Event code', { exact: true }).fill(guestAccessCode);
    await guest.getByRole('button', { name: 'Open my pass', exact: true }).click();
    await expect(guest).toHaveURL(/\/dashboard/);
    await guest.getByPlaceholder('Your name').fill(guestName);
    await guest.getByRole('radio', { name: '5 stars' }).check({ force: true });
    await guest.getByPlaceholder('Tell us about your experience').fill('Registration was quick and the program ran on time.');
    await guest.getByRole('checkbox', { name: /I consent to PMCM saving my name, rating, comment/ }).check();
    await guest.getByRole('button', { name: 'Send feedback' }).click();
    await expect(guest.getByText('Feedback sent. PMCM will review it before sharing.')).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/closure`);
    await pmcm.page.getByRole('tab', { name: /^Feedback/ }).click();
    const row = pmcm.page.getByRole('article').filter({ hasText: guestName });
    await expect(row).toContainText('Registration was quick');
    await row.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(row).toHaveCount(0);

    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/summary`);
    const feedback = client.page.getByRole('region', { name: 'Your feedback' });
    await feedback.getByRole('radio', { name: '5 of 5', exact: true }).click();
    await feedback.getByLabel('Feedback', { exact: true }).fill('PMCM kept every supplier on schedule.');
    await feedback.getByLabel('Optional testimonial').fill('PMCM made our conference effortless.');
    await feedback.getByLabel(/PMCM may consider this testimonial for publication/).check();
    await feedback.getByRole('button', { name: 'Send feedback', exact: true }).click();
    await expect(feedback.getByText(/Testimonial review: pending/)).toBeVisible();

    await pmcm.page.reload();
    await pmcm.page.getByRole('tab', { name: /^Feedback/ }).click();
    await pmcm.page.getByRole('button', { name: 'Approve testimonial', exact: true }).click();
    await client.page.reload();
    await expect(feedback.getByText(/Testimonial review: approved/)).toBeVisible();
  } finally { await closeAll(contexts); }
});
