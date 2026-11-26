import { test, expect } from '@playwright/test';
import { formatPortalDate } from '@prism/ui/format-date';
import { projectDevice } from './browser-devices.mjs';
import { api, fitsViewport, freshEvent, origins, persona } from './helpers.mjs';
import { billedEvent, bookedSupplier, closeAll, openBooking, signedInClient } from './journey-fixtures.mjs';

function shiftDate(date, days) {
  return new Date(Date.parse(date.slice(0, 10)) + days * 86_400_000).toISOString().slice(0, 10);
}

async function openPlanning(page, eventId, tab) {
  await page.goto(`${origins.event}/dashboard/events/${eventId}/briefing`);
  await page.getByRole('tab', { name: tab, exact: true }).click();
}

async function previewTemplate(page, template) {
  await page.getByRole('button', { name: 'Apply a template' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apply a planning template' });
  await dialog.getByRole('combobox', { name: 'Template' }).click();
  await page.getByRole('option', { name: new RegExp(`^${template} ·`) }).click();
  await dialog.getByRole('button', { name: 'Preview', exact: true }).click();
  return dialog;
}

test('PMCM creates and previews a planning template before applying it without duplicate tasks', async ({ browser }, info) => {
  const event = await freshEvent('Browser planning template');
  const { context, page } = await persona(browser, 'pmcm', projectDevice(info.project.name));
  const template = `Conference preparation ${info.project.name}`;
  const title = 'Confirm venue access';
  try {
    await page.goto(`${origins.event}/dashboard/settings?tab=templates`);
    await page.getByRole('button', { name: 'New template' }).click();
    const editor = page.getByRole('dialog', { name: 'New planning template' });
    await editor.getByRole('textbox', { name: 'Name', exact: true }).fill(template);
    await editor.getByRole('textbox', { name: 'Task 1 title' }).fill(title);
    await editor.getByRole('textbox', { name: 'Task 1 owner' }).fill('Venue lead');
    await editor.getByRole('textbox', { name: 'Task 1 days' }).fill('14');
    await expect.poll(() => fitsViewport(page)).toBe(true);
    await editor.getByRole('button', { name: 'Create template' }).click();
    await expect(editor).toBeHidden();
    await expect(page.getByRole('listitem').filter({ hasText: template })).toContainText('Version 1 · 1 task');

    await openPlanning(page, event.eventId, 'Plan');
    const preview = await previewTemplate(page, template);
    const due = formatPortalDate(shiftDate(event.eventDate, -14));
    await expect(preview.getByRole('listitem').filter({ hasText: title })).toContainText(`due ${due} · Venue lead`);
    expect(await api('GET', `/events/${event.eventId}/plan`)).toEqual([]);
    await preview.getByRole('button', { name: 'Apply to the plan' }).click();
    await expect(preview).toBeHidden();
    const tasks = page.getByRole('region', { name: `${template} tasks` });
    await expect(tasks.getByRole('listitem')).toHaveCount(1);
    await expect(tasks).toContainText(due);
    await tasks.getByRole('checkbox', { name: `Mark ${title} done` }).click();
    await expect(tasks.getByRole('checkbox', { name: `Reopen ${title}` })).toBeChecked();

    const again = await previewTemplate(page, template);
    await expect(again.getByText('1 task already match', { exact: false })).toBeVisible();
    await expect(again.getByRole('button', { name: 'Apply to the plan' })).toBeDisabled();
    await again.getByRole('button', { name: 'Cancel', exact: true }).click();
    await page.reload();
    await expect(tasks.getByRole('listitem')).toHaveCount(1);
    await expect(tasks.getByRole('checkbox', { name: `Reopen ${title}` })).toBeChecked();
  } finally { await context.close(); }
});

async function preparePostponement() {
  const event = await billedEvent('Browser postponement');
  await bookedSupplier(event);
  const planUrl = `/events/${event.eventId}/plan`;
  const template = await api('POST', '/planning-templates', {
    name: `Postponement plan ${event.eventId}`,
    description: '',
    items: [
      { key: 'crew', title: 'Reconfirm crew call', ownerRole: 'Stage lead', offsetDays: -10, dependsOn: null, notes: '' },
      { key: 'venue', title: 'Verify venue paperwork', ownerRole: 'Venue lead', offsetDays: -20, dependsOn: null, notes: '' },
    ],
  });
  const preview = await api('POST', `${planUrl}/preview`, { templateId: template.id });
  await api('POST', `${planUrl}/apply`, { templateId: template.id, version: preview.version, previewToken: preview.previewToken });
  const initial = await api('GET', planUrl);
  const done = initial.find(task => task.key === 'venue');
  await api('PATCH', `${planUrl}/items/${done.id}`, { status: 'done' });
  return { event, planUrl, open: initial.find(task => task.key === 'crew'), done };
}

test('PMCM postpones an event, client and supplier see the new date, and plan sync moves only eligible tasks', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const { event, planUrl, open, done } = await preparePostponement();
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const supplier = await persona(browser, 'supplier', device);
  const newDate = shiftDate(event.eventDate, 14);
  const [year, month, day] = newDate.split('-');
  const dateInput = `${month}/${day}/${year}`;
  const move = pmcm.page.getByRole('button', { name: 'Move 1 task with the event' });
  try {
    await test.step('PMCM previews the proposed date without changing the plan', async () => {
      await openPlanning(pmcm.page, event.eventId, 'Changes');
      await pmcm.page.getByRole('textbox', { name: 'New date to check' }).fill(dateInput);
      await pmcm.page.getByRole('button', { name: 'Check this date' }).click();
      await expect(pmcm.page.getByText(/14 days later/)).toBeVisible();
      await expect(pmcm.page.getByText(/Reconfirm crew call · .* → /)).toBeVisible();
      await expect(pmcm.page.getByText('1 task stays where it is (done, skipped or edited).')).toBeVisible();
      await expect(move).toHaveCount(0);
      await expect.poll(() => fitsViewport(pmcm.page)).toBe(true);
    });

    await test.step('PMCM records the postponement and both client and supplier see the updated date', async () => {
      await pmcm.page.getByText('Cancel or postpone this event', { exact: true }).click();
      const form = pmcm.page.getByRole('form', { name: 'Record cancellation or postponement' });
      await form.getByRole('combobox', { name: 'Decision', exact: true }).click();
      await pmcm.page.getByRole('option', { name: 'Postpone to a new date' }).click();
      await form.getByRole('textbox', { name: 'Reason', exact: true }).fill('Venue requested a later date.');
      await form.getByRole('textbox', { name: 'New event date' }).fill(dateInput);
      await form.getByRole('combobox', { name: 'Supplier obligations' }).click();
      await pmcm.page.getByRole('option', { name: 'Preserve supplier obligations' }).click();
      await form.getByRole('combobox', { name: 'Deposit treatment' }).click();
      await pmcm.page.getByRole('option', { name: 'Credit deposit to a new date' }).click();
      const submit = form.getByRole('button', { name: 'Record decision' });
      await expect(submit).toBeDisabled();
      await form.getByRole('checkbox', { name: /I have reviewed/ }).check();
      await submit.click();
      await expect.poll(async () => (await api('GET', `/events/${event.eventId}`)).eventDate.slice(0, 10)).toBe(newDate);

      await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/overview`);
      await expect(client.page.getByText(formatPortalDate(newDate), { exact: false }).filter({ visible: true }).first()).toBeVisible();

      await supplier.page.goto(`${origins.supplier}/dashboard/bookings`);
      const booking = await openBooking(supplier.page, event.eventName);
      await expect(booking.getByText(formatPortalDate(newDate), { exact: true })).toBeVisible();
      await expect(booking.getByText('Selected by PMCM', { exact: true })).toBeVisible();
      await expect(booking.getByRole('button', { name: 'Confirm assignment', exact: true })).toHaveCount(0);
    });

    await test.step('PMCM moves the open task and confirms the completed task, bookings and payments are preserved', async () => {
      await openPlanning(pmcm.page, event.eventId, 'Changes');
      const impactUrl = `/events/${event.eventId}/date-change-impact`;
      const beforeSync = await api('GET', impactUrl);
      expect(beforeSync.suppliers).toHaveLength(1);
      expect(beforeSync.payments).toHaveLength(2);
      expect((await api('GET', planUrl)).find(task => task.id === open.id).dueDate).toBe(open.dueDate);
      await move.click();
      await expect(pmcm.page.getByText('No open task needs to move.')).toBeVisible();
      const tasks = await api('GET', planUrl);
      expect(tasks).toHaveLength(2);
      expect(tasks.find(task => task.id === open.id).dueDate.slice(0, 10)).toBe(shiftDate(open.dueDate, 14));
      expect(tasks.find(task => task.id === done.id)).toMatchObject({ dueDate: done.dueDate, status: 'done' });
      const afterSync = await api('GET', impactUrl);
      expect(afterSync.suppliers).toEqual(beforeSync.suppliers);
      expect(afterSync.payments).toEqual(beforeSync.payments);
      expect(beforeSync.approvedWork.length).toBeGreaterThan(0);
      expect(afterSync.approvedWork).toEqual(beforeSync.approvedWork);
    });
  } finally { await closeAll([pmcm.context, client.context, supplier.context]); }
});
