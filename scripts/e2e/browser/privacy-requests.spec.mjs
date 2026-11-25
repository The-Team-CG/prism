import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { freshEvent, origins, password, persona } from './helpers.mjs';
import { closeAll, signedInClient } from './journey-fixtures.mjs';

test('a client asks for a copy of their data and sees it move to in progress once PMCM approves it', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser privacy request');
  const client = await signedInClient(browser, device, event);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [client.context, pmcm.context];
  try {
    await client.page.goto(`${origins.client}/dashboard/privacy`);
    await client.page.getByRole('button', { name: 'New request' }).first().click();
    const dialog = client.page.getByRole('dialog');
    await dialog.getByRole('radio', { name: /Get a copy of my data/ }).click();
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByLabel('Anything PMCM should know (optional)').fill('Please include my event messages.');
    await dialog.getByRole('button', { name: 'Next', exact: true }).click();
    await dialog.getByLabel('Your password', { exact: true }).fill(password);
    await dialog.getByRole('button', { name: 'Send request', exact: true }).click();
    await expect(dialog).toBeHidden();
    const requests = client.page.getByRole('region', { name: 'Your requests' });
    await expect(requests.getByRole('button', { name: /^Copy of my data .*With PMCM/ })).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/privacy`);
    const card = pmcm.page.getByRole('article', { name: `request for ${event.email}` });
    await expect(card).toContainText('Sent by them');
    await card.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect(card).toContainText(/approved/i);

    await client.page.reload();
    await expect(requests.getByRole('button', { name: /^Copy of my data .*In progress/ })).toBeVisible();
  } finally { await closeAll(contexts); }
});
