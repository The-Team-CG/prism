import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { closeAll, pickDateTime, signedInClient } from './journey-fixtures.mjs';

test('client asks for a venue visit, PMCM schedules it and marks it complete', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser ocular visit');
  const client = await signedInClient(browser, device, event);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [client.context, pmcm.context];
  const visitStatus = async () => (await api('GET', `/pmcm/events/${event.eventId}/workspace`)).ocularVisit?.status;
  try {
    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/overview`);
    await client.page.getByLabel('Note for PMCM (optional)').fill('Weekday mornings suit us best.');
    await client.page.getByRole('button', { name: 'Ask for a venue visit', exact: true }).click();
    await expect.poll(visitStatus).toBe('requested');

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/overview`);
    // The overview's next step links down to the visit card; Manage visit opens its controls.
    await pmcm.page.getByRole('link', { name: 'Schedule visit' }).click();
    await pmcm.page.getByRole('button', { name: 'Manage visit' }).click();
    await pmcm.page.getByRole('button', { name: 'Schedule visit', exact: true }).click();
    await pickDateTime(pmcm.page, pmcm.page.locator('#ocular-visit-scheduled-at'), new Date(Date.now() + 2 * 86_400_000));
    await pmcm.page.getByLabel(/Note for the client/).fill('Meet at the lobby concierge.');
    await pmcm.page.getByRole('button', { name: 'Save schedule', exact: true }).click();
    await expect.poll(visitStatus).toBe('scheduled');

    await client.page.reload();
    await expect(client.page.getByText(/Meet at the lobby concierge|scheduled/i).first()).toBeVisible();

    await pmcm.page.getByRole('button', { name: 'Mark ocular visit complete', exact: true }).click();
    await expect.poll(visitStatus).toBe('completed');
  } finally { await closeAll(contexts); }
});
