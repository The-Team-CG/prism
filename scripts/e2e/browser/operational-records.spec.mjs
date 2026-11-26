import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, fitsViewport, freshEvent, origins, persona } from './helpers.mjs';

test('PMCM records and accepts an accreditation requirement while event planning stays available', async ({ browser }, info) => {
  const event = await freshEvent('Browser accreditation');
  const { context, page } = await persona(browser, 'pmcm', projectDevice(info.project.name));
  const supplierPath = `${origins.event}/dashboard/events/${event.eventId}/suppliers?part=readiness`;
  const name = 'Venue business permit';
  const status = page.getByRole('combobox', { name: `Status of ${name}` });
  try {
    await page.goto(supplierPath);
    await expect(page.getByRole('heading', { name: 'Accreditation documents', exact: true })).toBeVisible();
    await page.getByRole('textbox', { name: 'Document', exact: true }).fill(name);
    await page.getByRole('spinbutton', { name: 'Days to submit' }).fill('9');
    const requestStartedAt = Date.now();
    await page.getByRole('button', { name: 'Request document' }).click();
    const item = page.getByRole('listitem').filter({ has: status });
    await expect(item).toContainText(`${name} · due`);
    await expect(status).toHaveText(/pending/i);
    await expect.poll(() => fitsViewport(page)).toBe(true);
    const [requirement] = await api('GET', `/events/${event.eventId}/accreditation`);
    const requestSavedAt = Date.parse(requirement.dueAt) - 9 * 86_400_000;
    expect(requestSavedAt).toBeGreaterThanOrEqual(requestStartedAt);
    expect(requestSavedAt).toBeLessThanOrEqual(Date.now());

    await page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await page.getByRole('tab', { name: 'Plan', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Apply a template' })).toBeEnabled();

    await page.goto(supplierPath);
    for (const next of ['submitted', 'accepted']) {
      await status.click();
      await page.getByRole('option', { name: new RegExp(`^${next}$`, 'i') }).click();
      await expect(status).toHaveText(new RegExp(next, 'i'));
    }
    await page.reload();
    await expect(status).toHaveText(/accepted/i);
  } finally { await context.close(); }
});

test('PMCM logs a pre-event risk, revises its score and records the mitigation status', async ({ browser }, info) => {
  const event = await freshEvent('Browser risk register');
  const { context, page } = await persona(browser, 'pmcm', projectDevice(info.project.name));
  const title = 'Delayed access to the loading bay';
  const mitigation = 'Confirm keys with the venue the day before.';
  try {
    await page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await page.getByRole('tab', { name: 'Changes', exact: true }).click();
    const register = page.getByRole('region', { name: 'Risk register', exact: true });
    await register.getByRole('combobox', { name: 'Phase', exact: true }).click();
    await page.getByRole('option', { name: 'Pre-event', exact: true }).click();
    await register.getByRole('textbox', { name: 'Risk', exact: true }).fill(title);
    await register.getByRole('combobox', { name: 'Likelihood', exact: true }).click();
    await page.getByRole('option', { name: 'Likelihood 4', exact: true }).click();
    await register.getByRole('textbox', { name: 'Mitigation', exact: true }).fill(mitigation);
    await register.getByRole('textbox', { name: 'Owner', exact: true }).fill('Venue lead');
    const addRisk = register.getByRole('button', { name: 'Add risk', exact: true });
    await register.getByRole('textbox', { name: 'Owner', exact: true }).press('Tab');
    await expect(addRisk).toBeFocused();
    await addRisk.click();
    const row = register.getByRole('listitem').filter({ hasText: title });
    await expect(register.getByRole('heading', { name: 'Pre-event', exact: true })).toBeVisible();
    await expect(row).toContainText(mitigation);
    await expect(row).toContainText('Owner: Venue lead');
    await expect(row).toContainText('Score 12');
    await expect.poll(() => fitsViewport(page)).toBe(true);
    await row.getByRole('combobox', { name: `Impact of ${title}` }).click();
    await page.getByRole('option', { name: 'I2', exact: true }).click();
    await expect(row).toContainText('Score 8');
    const status = row.getByRole('combobox', { name: `Status of ${title}` });
    await status.click();
    await page.getByRole('option', { name: 'Mitigated', exact: true }).click();
    await expect(status).toHaveText('Mitigated');
    await page.reload();
    await expect(status).toHaveText('Mitigated');
    await expect(row).toContainText('Score 8');
    const risks = await api('GET', `/events/${event.eventId}/risks`);
    expect(risks.find(risk => risk.title === title)).toMatchObject({ owner: 'Venue lead', phase: 'pre_event' });
  } finally { await context.close(); }
});
