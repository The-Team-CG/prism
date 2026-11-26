import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { closeAll, signedInClient } from './journey-fixtures.mjs';

test('PMCM issues a venue option, the client approves it, and PMCM sees the decision', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser venue option');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  const title = `Grand Ballroom package ${info.project.name}`;
  try {
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await pmcm.page.getByRole('tab', { name: 'Proposal', exact: true }).click();
    const panel = pmcm.page.locator('section').filter({ has: pmcm.page.getByRole('heading', { name: 'Client venue and styling reviews' }) });
    await panel.getByLabel('Budget range').fill('PHP 150k-200k');
    await panel.getByLabel('Proposal title').fill(title);
    await panel.getByLabel('Proposal details').fill('Ballroom for 120 guests with a built-in stage and AV.');
    await panel.getByRole('button', { name: 'Issue new version', exact: true }).click();
    await expect(panel.getByRole('heading', { name: title })).toBeVisible();

    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/proposal`);
    const review = client.page.locator('section, article').filter({ hasText: title }).last();
    await review.getByRole('button', { name: 'Approve option' }).click();
    await expect.poll(async () => (await api('GET', `/events/${event.eventId}/client-review-items`)).find(item => item.title === title)?.clientDecision?.action).toBe('approve');

    await pmcm.page.reload();
    await pmcm.page.getByRole('tab', { name: 'Proposal', exact: true }).click();
    await expect(panel.getByText(/Client decision: approve/)).toBeVisible();
  } finally { await closeAll(contexts); }
});
