import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, fitsViewport, freshEvent, origins, persona } from './helpers.mjs';
import { bookedSupplier, closeAll, openBooking, samplePdf, supplierAccount, startConversation, openConversation, sendMessage, conversationShows } from './journey-fixtures.mjs';

test('a booked supplier delivers its contract, schedule and creative work, and confirms the payout PMCM releases', async ({ browser }, info) => {
  test.setTimeout(6 * 60_000);
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser supplier delivery');
  const { request } = await bookedSupplier(event);
  // PMCM owns the ingress/egress schedule; publishing needs two date-time pickers six months out, so it is set here
  // and the journey covers the supplier's acknowledgement and PMCM's view of it.
  const day = event.eventDate.slice(0, 10);
  await api('POST', `/events/${event.eventId}/supplier-schedules`, { requestId: request.id, ingressAt: `${day}T06:00:00+08:00`, egressAt: `${day}T22:00:00+08:00`, location: 'Loading dock B', notes: 'Use the service lift' });
  const pmcm = await persona(browser, 'pmcm', device);
  const supplier = await persona(browser, 'supplier', device);
  const contexts = [pmcm.context, supplier.context];
  const suppliersTab = `${origins.event}/dashboard/events/${event.eventId}/suppliers`;
  const openSupplierSheet = async () => {
    await pmcm.page.goto(suppliersTab);
    await pmcm.page.locator('#supplier-bookings').getByRole('button', { name: 'XPERTO Registration', exact: true }).click();
    const sheet = pmcm.page.getByRole('dialog', { name: 'XPERTO Registration' });
    await expect(sheet).toBeVisible();
    return sheet;
  };
  try {
    await test.step('PMCM assigns a creative deliverable', async () => {
      const sheet = await openSupplierSheet();
      await sheet.getByRole('button', { name: 'Add deliverable', exact: true }).click();
      await sheet.getByPlaceholder('Deliverable title').fill('Registration desk signage');
      await sheet.getByPlaceholder('Brief and acceptance criteria for this supplier').fill('Two A1 boards with the event logo and QR code.');
      await sheet.getByRole('button', { name: 'Assign deliverable', exact: true }).click();
      await expect(sheet.getByText('Registration desk signage', { exact: true })).toBeVisible();
    });

    await test.step('supplier uploads its contract, acknowledges the schedule and submits the deliverable', async () => {
      await supplier.page.goto(`${origins.supplier}/dashboard/bookings`);
      const booking = await openBooking(supplier.page, event.eventName);
      await booking.getByLabel('Signed contract file').setInputFiles(samplePdf);
      await booking.getByLabel('Contract total (PHP)').fill('60000');
      await booking.getByRole('button', { name: 'Upload contract' }).click();
      await expect(booking.getByText(/v1 · browser-acceptance\.pdf/)).toBeVisible();
      await booking.getByRole('button', { name: 'Acknowledge', exact: true }).click();
      await expect(booking.getByText('You acknowledged this revision.')).toBeVisible();
      await booking.getByPlaceholder('Progress note for PMCM').fill('Boards printed; proof attached.');
      await booking.getByRole('button', { name: 'Submit deliverable', exact: true }).click();
      await expect(booking.getByText(/Submission v1 · Boards printed/)).toBeVisible();
    });

    await test.step('PMCM accepts the contract and the deliverable, then records a payout release', async () => {
      const sheet = await openSupplierSheet();
      await expect(sheet.getByText(/revision 1/)).toBeVisible();
      await sheet.getByRole('button', { name: 'Accept', exact: true }).first().click();
      await expect(sheet.getByText('Accepted').first()).toBeVisible();
      await sheet.getByPlaceholder('Review note').fill('Signage matches the brief.');
      await sheet.getByRole('button', { name: 'Accept', exact: true }).click();
      await sheet.getByRole('button', { name: 'Add milestone', exact: true }).click();
      await sheet.getByPlaceholder('Milestone name').fill('Downpayment');
      await sheet.getByPlaceholder('Amount', { exact: true }).fill('30000');
      await sheet.getByRole('button', { name: 'Add milestone', exact: true }).click();
      await sheet.getByRole('button', { name: 'Record release', exact: true }).click();
      await sheet.getByPlaceholder('Release amount').fill('30000');
      const today = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Manila', month: '2-digit', day: '2-digit', year: 'numeric' }).format(new Date());
      await sheet.getByPlaceholder('MM/DD/YYYY').fill(today);
      await sheet.getByPlaceholder('Method', { exact: true }).fill('Bank transfer');
      await sheet.getByPlaceholder('Reference number').fill(`PAYOUT-${info.project.name}`);
      await sheet.getByRole('button', { name: 'Save release', exact: true }).click();
      await expect(sheet.getByText('Supplier has not confirmed it yet')).toBeVisible();
    });

    await test.step('supplier confirms it received the payout; PMCM sees the confirmation', async () => {
      await supplier.page.goto(`${origins.supplier}/dashboard/payments`);
      await expect(supplier.page.getByRole('button', { name: 'I received this' }).first()).toBeVisible();
      // A long event name once pushed the payout card past a phone's width and hid this action under the next card.
      expect(await fitsViewport(supplier.page)).toBe(true);
      await supplier.page.getByRole('button', { name: 'I received this' }).first().click();
      const confirm = supplier.page.getByRole('dialog', { name: 'I received this payment' });
      await confirm.getByRole('button', { name: 'Confirm received', exact: true }).click();
      await expect(confirm).toBeHidden();
      const sheet = await openSupplierSheet();
      await expect(sheet.getByText(/^Supplier confirmed /)).toBeVisible();
    });

    await test.step('PMCM and the supplier exchange messages about the booking', async () => {
      const subject = `Load-in plan ${info.project.name}`;
      await startConversation(pmcm.page, event.eventId, subject, supplierAccount.email);
      await sendMessage(pmcm.page, subject, 'Please bring the kiosks through dock B.');
      await supplier.page.goto(`${origins.supplier}/dashboard/messages`);
      await openConversation(supplier.page, subject);
      await conversationShows(supplier.page, subject, 'Please bring the kiosks through dock B.');
      await sendMessage(supplier.page, subject, 'Noted, we arrive at 6 AM.');
      await pmcm.page.reload();
      await openConversation(pmcm.page, subject);
      await conversationShows(pmcm.page, subject, 'Noted, we arrive at 6 AM.');
    });
  } finally { await closeAll(contexts); }
});
