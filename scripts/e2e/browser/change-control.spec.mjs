import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { closeAll, signedInClient } from './journey-fixtures.mjs';

test('client requests a scope change and reads PMCM approval and response', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser scope change');
  const client = await signedInClient(browser, device, event);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [client.context, pmcm.context];
  const change = `Add a photo booth ${info.project.name}`;
  try {
    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/changes`);
    await client.page.getByRole('button', { name: 'Request a change', exact: true }).click();
    const form = client.page.getByRole('dialog', { name: 'Request a change' });
    await form.getByLabel('What would you like to change?').fill(change);
    await form.getByLabel('Details', { exact: true }).fill('A photo booth near registration for 120 guests.');
    await form.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(form).toBeHidden();
    await expect(client.page.getByText(change).first()).toBeVisible();
    await expect(client.page.getByText('Under review', { exact: true }).first()).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await pmcm.page.getByRole('tab', { name: 'Changes', exact: true }).click();
    const item = pmcm.page.getByRole('listitem').filter({ hasText: change });
    await item.getByRole('button', { name: 'Start review', exact: true }).click();
    await item.getByRole('button', { name: 'Approve', exact: true }).click();
    const approve = item.getByRole('form', { name: 'Approve scope change' });
    await approve.getByRole('checkbox', { name: /I have reviewed billing, supplier, coordinator, and floorplan impact/ }).check();
    await approve.getByLabel('Response for the client (optional)').fill('Approved; the booth fits the current budget.');
    await approve.getByRole('button', { name: 'Confirm approval', exact: true }).click();
    await expect.poll(async () => (await api('GET', `/events/${event.eventId}/scope-changes`)).find(request => request.title === change)?.status).toBe('approved');

    await client.page.reload();
    await expect(client.page.getByText('Approved', { exact: true }).first()).toBeVisible();
    await client.page.getByText(change).first().click();
    await expect(client.page.getByRole('dialog', { name: change })).toContainText("PMCM's answer: Approved; the booth fits the current budget.");
  } finally { await closeAll(contexts); }
});
