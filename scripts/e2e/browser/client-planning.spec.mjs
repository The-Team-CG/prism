import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { billedEvent, closeAll, signedInClient, offsetDate } from './journey-fixtures.mjs';

test('PMCM shares venue options, the client prefers one, and PMCM sees the choice', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser venue scouting');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  const venue = `Harbour Hall ${info.project.name}`;
  const preferred = async () => (await api('GET', `/events/${event.eventId}/venue-scouting`)).options.find(option => option.name === venue)?.clientPreferredAt ?? null;
  try {
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await pmcm.page.getByRole('tab', { name: 'Proposal', exact: true }).click();
    const scouting = pmcm.page.locator('section').filter({ has: pmcm.page.getByRole('heading', { name: 'Venue scouting', exact: true }) });
    // PMCM shares a shortlist: the client is offered at least three venues at once.
    for (const [name, location] of [[venue, 'Pasay City'], [`Garden Pavilion ${info.project.name}`, 'Taguig'], [`Skyline Loft ${info.project.name}`, 'Makati']]) {
      await scouting.getByLabel('Venue name').fill(name);
      await scouting.getByLabel('Location').fill(location);
      await scouting.getByLabel('Capacity (guests)').fill('150');
      await scouting.getByLabel('Price range').fill('PHP 300,000 – 400,000');
      await scouting.getByLabel(/Available dates/).fill(offsetDate(180));
      await scouting.getByRole('button', { name: 'Add venue option', exact: true }).click();
      await expect(scouting.getByText(name, { exact: true })).toBeVisible();
    }
    await scouting.getByRole('button', { name: 'Share new options with the client', exact: true }).click();

    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/proposal`);
    const card = client.page.locator('article, li, div').filter({ has: client.page.getByText(venue, { exact: true }) }).filter({ has: client.page.getByRole('button', { name: 'Prefer this venue' }) }).last();
    await card.getByRole('button', { name: 'Prefer this venue' }).click();
    await expect(client.page.getByText(/^Your preferred venue/)).toBeVisible();

    await expect.poll(preferred).not.toBeNull();
    await pmcm.page.reload();
    await pmcm.page.getByRole('tab', { name: 'Proposal', exact: true }).click();
    await expect(scouting.locator('li', { hasText: venue })).toHaveClass(/border-primary/);
  } finally { await closeAll(contexts); }
});

test('the client adds and confirms its own supplier; PMCM raises a risk the client reads', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser own supplier');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  const supplier = `Lens and Light ${info.project.name}`;
  try {
    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/briefing`);
    await client.page.getByRole('button', { name: 'Add supplier', exact: true }).click();
    const dialog = client.page.getByRole('dialog', { name: 'Add a supplier you booked' });
    await dialog.getByLabel('Service', { exact: true }).fill('Photography');
    await dialog.getByLabel('Supplier', { exact: true }).fill(supplier);
    await dialog.getByLabel('Arrival and set-up notes').fill('Arrives 2 hours before doors');
    await dialog.getByRole('button', { name: 'Add supplier', exact: true }).click();
    await expect(client.page.getByText(new RegExp(`^${supplier} · Photography`))).toBeVisible();
    await client.page.getByRole('button', { name: 'Mark confirmed' }).click();
    await expect(client.page.getByText(/^Confirmed/)).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/suppliers`);
    await pmcm.page.getByRole('tab', { name: 'Readiness', exact: true }).click();
    await pmcm.page.getByLabel(`Risk warning for ${supplier}`).fill('No ingress pass yet');
    await pmcm.page.getByRole('button', { name: 'Raise risk', exact: true }).click();

    await client.page.reload();
    await expect(client.page.getByText('PMCM note: No ingress pass yet')).toBeVisible();
  } finally { await closeAll(contexts); }
});

test('a statement PMCM sends reaches the client notification inbox, and Mark all read clears it', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await billedEvent('Browser notifications');
  await expect.poll(async () => (await api('GET', '/notification-inbox/unread-count', undefined, event.clientToken)).unread, { timeout: 45_000 }).toBeGreaterThan(0);
  const client = await signedInClient(browser, device, event);
  const contexts = [client.context];
  try {
    await client.page.goto(`${origins.client}/dashboard/notifications`);
    await expect(client.page.getByRole('img', { name: 'Unread' }).first()).toBeVisible();
    await client.page.getByRole('button', { name: 'Mark all read' }).click();
    await expect(client.page.getByRole('img', { name: 'Unread' })).toHaveCount(0);
    await expect.poll(async () => (await api('GET', '/notification-inbox/unread-count', undefined, event.clientToken)).unread).toBe(0);
  } finally { await closeAll(contexts); }
});
