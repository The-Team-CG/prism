import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { closeAll, samplePdf, signedInClient } from './journey-fixtures.mjs';

const requirement = { key: 'browser_venue_permit', label: 'Venue permit' };

async function uploadForRequirement(page, buttonName, file) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: buttonName }).click();
  await (await chooser).setFiles(file);
}

async function reviewInLibrary(page, eventId, fileName, decide) {
  await page.goto(`${origins.event}/dashboard/events/${eventId}/files`);
  await page.getByRole('tab', { name: 'Library', exact: true }).click();
  await page.getByRole('button', { name: `Preview ${fileName}` }).first().click();
  await decide(page.getByRole('dialog'));
}

const status = async eventId => (await api('GET', `/events/${eventId}/file-requirements`)).items.find(item => item.key === requirement.key);

test('PMCM asks the client for a file, rejects the first upload with a reason, and approves the replacement', async ({ browser }, info) => {
  test.setTimeout(5 * 60_000);
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser file requirement');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  try {
    await test.step('PMCM adds a client-owned requirement', async () => {
      await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/files`);
      await pmcm.page.getByRole('tab', { name: 'Requirements', exact: true }).click();
      await pmcm.page.getByRole('button', { name: 'Add requirement', exact: true }).click();
      await pmcm.page.getByLabel('Key', { exact: true }).fill(requirement.key);
      await pmcm.page.getByLabel('Label', { exact: true }).fill(requirement.label);
      await pmcm.page.getByRole('combobox', { name: 'Owner' }).click();
      await pmcm.page.getByRole('option', { name: /client/i }).first().click();
      await pmcm.page.getByRole('button', { name: 'Add requirement', exact: true }).click();
      await expect.poll(async () => (await status(event.eventId))?.ownerRole).toBe('client');
    });

    await test.step('client uploads the file and sees it waiting for review', async () => {
      await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/documents`);
      await uploadForRequirement(client.page, `Upload ${requirement.label}`, samplePdf);
      await expect(client.page.getByRole('status').filter({ hasText: `${samplePdf.name} sent for ${requirement.label}. PMCM will review it.` })).toBeVisible();
      await expect(client.page.getByRole('button', { name: `Preview ${samplePdf.name}` })).toContainText(`For ${requirement.label}`);
    });

    await test.step('PMCM rejects it with a reason the client reads', async () => {
      await reviewInLibrary(pmcm.page, event.eventId, samplePdf.name, async sheet => {
        await sheet.getByRole('button', { name: 'Reject', exact: true }).click();
        await sheet.getByLabel(`Reason for rejecting ${samplePdf.name}`).fill('The permit page is unsigned; please send the signed copy.');
        await sheet.getByRole('button', { name: 'Reject', exact: true }).click();
      });
      await expect.poll(async () => (await status(event.eventId))?.validationStatus).toBe('rejected');
      await client.page.reload();
      await expect(client.page.getByText(/Not accepted\. Upload a replacement/).first()).toBeVisible();
      await expect(client.page.getByText(/please send the signed copy/).first()).toBeVisible();
    });

    await test.step('client replaces the file and PMCM approves it', async () => {
      const replacement = { ...samplePdf, name: 'venue-permit-signed.pdf' };
      await uploadForRequirement(client.page, `Replace ${requirement.label}`, replacement);
      await expect(client.page.getByRole('status').filter({ hasText: `${replacement.name} sent for ${requirement.label}. PMCM will review it.` })).toBeVisible();
      await reviewInLibrary(pmcm.page, event.eventId, replacement.name, async sheet => {
        await sheet.getByRole('button', { name: 'Approve', exact: true }).click();
      });
      await expect.poll(async () => (await status(event.eventId))?.status).toMatch(/approved|complete/);
      await client.page.reload();
      await expect(client.page.getByText(/Not accepted\. Upload a replacement/)).toHaveCount(0);
    });
  } finally { await closeAll(contexts); }
});
