import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, billedEvent, closeAll, signedInClient, supplierAccount, offsetDate } from './journey-fixtures.mjs';

test('PMCM issues an addendum, the client signs it, and PMCM countersigns so it takes effect', async ({ browser }, info) => {
  test.setTimeout(4 * 60_000);
  const device = projectDevice(info.project.name);
  // A financial addendum changes billing, so the event already has an approved billing source and a sent statement.
  const event = await billedEvent('Browser addendum');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  const title = `Photo booth added ${info.project.name}`;
  const changesTab = async () => {
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/briefing`);
    await pmcm.page.getByRole('tab', { name: 'Changes', exact: true }).click();
    return pmcm.page.getByRole('region', { name: 'Addenda', exact: true });
  };
  const addendum = async () => (await api('GET', `/events/${event.eventId}/addenda`)).find(item => item.title === title);
  try {
    await test.step('PMCM writes and issues the addendum, then asks the client to sign', async () => {
      const addenda = await changesTab();
      await addenda.getByRole('button', { name: 'Issue addendum', exact: true }).click();
      const form = pmcm.page.getByRole('form', { name: 'Issue addendum' });
      await form.getByLabel('Title', { exact: true }).fill(title);
      await form.getByLabel(/What changes, in the client's words/).fill('A photo booth near registration for three hours.');
      await form.getByRole('combobox', { name: 'Addendum document' }).click();
      await pmcm.page.getByRole('option').first().click();
      await form.getByLabel(/Contract terms after this addendum/).fill('Photo booth for 3 hours\nPrinted strips for every guest');
      await form.getByLabel(/Change to the contract price/).fill('15000');
      await expect(form).toContainText('Contract total ₱100,000 → ₱115,000 once countersigned.');
      await form.getByRole('button', { name: 'Issue addendum', exact: true }).click();
      await expect.poll(async () => (await addendum())?.status).toBe('pending');
      await addenda.getByRole('button', { name: 'Request client conforme', exact: true }).click();
      await expect.poll(async () => Boolean((await addendum())?.conforme)).toBe(true);
    });

    await test.step('the client reads and signs it', async () => {
      const { id } = await addendum();
      await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/overview?addendum=${encodeURIComponent(id)}`);
      const dialog = client.page.getByRole('dialog');
      await expect(dialog).toContainText(title);
      await dialog.getByLabel('I have read this addendum and agree to the scope and amount changes it describes.').check();
      await dialog.getByRole('button', { name: 'Sign addendum', exact: true }).click();
      await expect(dialog.getByRole('button', { name: 'Sign addendum', exact: true })).toHaveCount(0);
    });

    await test.step('PMCM countersigns and the addendum is effective', async () => {
      const addenda = await changesTab();
      await addenda.getByRole('button', { name: 'Countersign addendum conforme', exact: true }).click();
      await expect.poll(async () => (await addendum())?.status).toBe('effective');
      await expect(addenda.getByRole('button', { name: 'Issue addendum', exact: true })).toBeVisible();
    });
  } finally { await closeAll(contexts); }
});

test('PMCM records a compliance risk and moves it to mitigated with its reason', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  // Compliance review opens on the Closure page once the event has ended.
  const event = await freshEvent('Browser compliance risk');
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  await api('POST', `/events/${event.eventId}/start-event-day`, {});
  await api('POST', `/events/${event.eventId}/actual-end`, { actualEndedAt: new Date(Date.now() - 60 * 60_000).toISOString() });
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [pmcm.context];
  const risk = `Venue power may trip (${info.project.name})`;
  try {
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/closure`);
    await pmcm.page.getByRole('tab', { name: 'Compliance', exact: true }).click();
    await pmcm.page.getByText('Record a risk', { exact: true }).click();
    await pmcm.page.getByLabel('Risk', { exact: true }).fill(risk);
    await pmcm.page.getByLabel('Mitigation', { exact: true }).fill('Ask the venue for the load sheet.');
    await pmcm.page.getByRole('button', { name: 'Record risk', exact: true }).click();
    await pmcm.page.getByRole('button', { name: `Update ${risk}` }).click();
    const editor = pmcm.page.getByRole('form', { name: `Update ${risk}` });
    await editor.getByRole('radio', { name: 'Mitigated', exact: true }).click();
    await editor.getByLabel('Owner', { exact: true }).fill('Site lead');
    await editor.getByLabel('Why it changed (optional)').fill('Backup generator booked.');
    await editor.getByRole('button', { name: 'Save risk', exact: true }).click();
    await expect.poll(async () => (await api('GET', `/events/${event.eventId}/compliance/risks`)).find(item => item.title === risk)?.status).toBe('mitigated');
    await expect(pmcm.page.getByText(/Mitigated · Owner: Site lead/)).toBeVisible();
  } finally { await closeAll(contexts); }
});

test('PMCM logs a quote a supplier gave by phone and selects it', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser phoned quote');
  await api('POST', `/events/${event.eventId}/quote-requests`, { categoryId: supplierAccount.category, supplierIds: [supplierAccount.supplierId], deadline: offsetDate(20) });
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [pmcm.context];
  try {
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/suppliers`);
    const waiting = pmcm.page.getByRole('region', { name: /^Waiting for quotes/ });
    await waiting.getByRole('button', { name: 'Log a quote from XPERTO Registration' }).click();
    const form = pmcm.page.getByRole('form', { name: 'Quote from XPERTO Registration' });
    await form.getByLabel('Amount (PHP)').fill('48,000');
    await form.getByLabel('Inclusions, one per line').fill('Registration kiosks\nBadge printing');
    await form.getByLabel(/How it arrived/).fill('Quoted by phone');
    await form.getByRole('button', { name: 'Save quote', exact: true }).click();
    await expect(waiting).toHaveCount(0);
    await pmcm.page.getByRole('button', { name: 'Select supplier', exact: true }).first().click();
    await expect.poll(async () => (await api('GET', `/pmcm/events/${event.eventId}/workspace`)).supplierQuotes.find(quote => quote.amount === 48000)?.status).toBe('selected');
  } finally { await closeAll(contexts); }
});

test('PMCM edits a workspace compliance rule, turns it off, and turns it back on', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [pmcm.context];
  const title = `Generator on site ${info.project.name} ${Date.now()}`;
  const saved = async () => (await api('GET', '/compliance/rules')).find(rule => rule.title.startsWith(title));
  try {
    await pmcm.page.goto(`${origins.event}/dashboard/settings?tab=rules`);
    await pmcm.page.getByRole('button', { name: /Add rule/ }).click();
    const add = pmcm.page.getByRole('form', { name: 'Add a rule' });
    await add.getByLabel('Rule title').fill(title);
    await add.getByLabel('Check identifier').fill(`generator_${info.project.name}_${Date.now()}`);
    await add.getByRole('button', { name: 'Save rule', exact: true }).click();
    await expect.poll(async () => (await saved())?.active).toBe(true);

    await pmcm.page.getByRole('button', { name: `Edit ${title}` }).click();
    const edit = pmcm.page.getByRole('form', { name: 'Edit rule' });
    await edit.getByLabel('Rule title').fill(`${title} (backup)`);
    await edit.getByRole('button', { name: 'Save rule', exact: true }).click();
    await expect.poll(async () => (await saved())?.title).toBe(`${title} (backup)`);

    await pmcm.page.getByRole('button', { name: `Edit ${title} (backup)` }).click();
    await pmcm.page.getByRole('form', { name: 'Edit rule' }).getByRole('button', { name: 'Turn off rule', exact: true }).click();
    await expect.poll(async () => (await saved())?.active).toBe(false);
    await pmcm.page.getByRole('region', { name: 'Turned-off rules' }).getByRole('button', { name: `Turn on ${title} (backup)` }).click();
    await expect.poll(async () => (await saved())?.active).toBe(true);
  } finally { await closeAll(contexts); }
});
