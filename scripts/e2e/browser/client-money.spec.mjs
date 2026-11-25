import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, origins, persona } from './helpers.mjs';
import { billedEvent, signedInClient, closeAll, proofPng } from './journey-fixtures.mjs';

test('client reports a payment with proof, PMCM verifies it on the finance desk, and the client sees it accepted', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await billedEvent('Browser payment report');
  const client = await signedInClient(browser, device, event);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [client.context, pmcm.context];
  const reference = `BROWSER-REPORT-${info.project.name}-${Date.now()}`;
  try {
    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/billing`);
    await client.page.getByRole('button', { name: "I've paid" }).first().click();
    const dialog = client.page.getByRole('dialog', { name: 'Tell PMCM you paid' });
    await dialog.getByLabel('Amount sent (₱)').fill('50000');
    await dialog.getByLabel('Reference number', { exact: true }).fill(reference);
    await dialog.getByLabel('Proof of payment', { exact: true }).setInputFiles(proofPng);
    await dialog.getByRole('button', { name: 'Send to PMCM', exact: true }).click();
    await expect(dialog).toBeHidden();
    const sent = client.page.getByRole('region', { name: /^Payments you sent/ });
    await expect(sent.getByText('Being checked', { exact: true })).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/finance`);
    await pmcm.page.getByRole('searchbox', { name: 'Search the queue' }).fill(event.eventName);
    await pmcm.page.getByRole('button', { name: 'Verify', exact: true }).first().click();
    const verify = pmcm.page.getByRole('dialog', { name: 'Verify this payment' });
    await verify.getByLabel('What you checked', { exact: true }).fill(`Matched ${reference} against the bank statement.`);
    await verify.getByRole('button', { name: 'Verify', exact: true }).click();
    await expect(verify).toBeHidden();
    await client.page.reload();
    await expect(sent.getByText('Verified · awaiting application', { exact: true })).toBeVisible();
    expect((await api('GET', `/pmcm/events/${event.eventId}/workspace`)).paymentMilestones.reduce((sum, item) => sum + item.amountPaid, 0)).toBe(0);
    await pmcm.page.getByRole('link', { name: 'Apply it to a milestone' }).click();
    const apply = pmcm.page.getByRole('dialog', { name: 'Apply to a milestone' });
    await expect(apply).toContainText('unapplied');
    await apply.getByRole('button', { name: 'Apply money', exact: true }).click();
    await expect(apply).toBeHidden();
    await expect.poll(async () => (await api('GET', `/pmcm/events/${event.eventId}/workspace`)).paymentMilestones.reduce((sum, item) => sum + item.amountPaid, 0)).toBe(50000);

    await client.page.reload();
    await expect(sent.getByText('Accepted', { exact: true })).toBeVisible();
  } finally { await closeAll(contexts); }
});
