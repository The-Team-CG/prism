import { test, expect, devices } from '@playwright/test';
import { api, origins, password, inbox, mailLink, persona, privacyIfNeeded, fillStable } from './helpers.mjs';
import { submitPublicInquiry } from './inquiry-actions.mjs';

// Each supplier booking is a <details> titled "Category · Event". A single booking starts open, so only a closed one is clicked.
async function openBooking(page, eventName) {
  const booking = page.locator('details', { has: page.locator('summary', { hasText: eventName }) });
  if ((await booking.getAttribute('open')) === null) await booking.locator('summary').click();
  return booking;
}

test('client, PMCM, supplier, coordinator and guest complete an event lifecycle', async ({ browser, page: client }, info) => {
  test.setTimeout(12 * 60_000);
  const device = info.project.name === 'mobile' ? devices['Pixel 7'] : devices['Desktop Chrome'];
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [pmcm.context];
  let inquiry, eventId;
  let supplierActor, coordinator;
  const path = tab => `${origins.event}/dashboard/events/${eventId}/${tab}`;
  try {
    await test.step('Public client submits; PMCM accepts; client activates from the local inbox', async () => {
      inquiry = await submitPublicInquiry(client, 'Full browser lifecycle', info.project.name === 'mobile' ? '12/16/2030' : '12/15/2030');
      await pmcm.page.goto(`${origins.event}/dashboard/inquiries`);
      await pmcm.page.getByPlaceholder('Search client, email, or event...').fill(inquiry.eventName);
      await pmcm.page.getByRole('button', { name: `Review inquiry ${inquiry.eventName}`, exact: true }).click();
      await pmcm.page.getByRole('button', { name: 'Accept', exact: true }).click();
      await expect(pmcm.page.getByText('Inquiry accepted', { exact: true })).toBeVisible();
      const mail = await inbox(inquiry.email, '/activate');
      await client.goto(mailLink(mail, '/activate', origins.client));
      await client.getByLabel('New password', { exact: true }).fill(password);
      await client.getByLabel('Confirm new password', { exact: true }).fill(password);
      await client.getByRole('button', { name: 'Set password', exact: true }).click();
      await client.getByRole('link', { name: 'Sign in', exact: true }).click();
      await fillStable(client.getByLabel('Email address'), inquiry.email);
      await fillStable(client.getByLabel('Password', { exact: true }), password);
      await client.getByRole('button', { name: 'Sign in', exact: true }).click();
      await privacyIfNeeded(client);
    });

    await test.step('PMCM prepares the immutable conforme; client signs; PMCM countersigns to create the event', async () => {
      await pmcm.page.goto(`${origins.event}/dashboard/inquiries`);
      await pmcm.page.getByRole('button', { name: 'Onboarding', exact: true }).click();
      await pmcm.page.getByRole('article', { name: `Onboarding ${inquiry.eventName}`, exact: true }).getByRole('button', { name: 'Upload signed conforme', exact: true }).click();
      const modal = pmcm.page.getByRole('dialog', { name: 'Upload signed conforme', exact: true });
      await modal.getByRole('button', { name: 'Prepare in-app conforme', exact: true }).click();
      await expect(modal.getByText('Status: awaiting client', { exact: true })).toBeVisible();
      await client.goto(`${origins.client}/conforme`);
      await client.getByRole('checkbox').check();
      await client.getByRole('button', { name: 'Acknowledge conforme', exact: true }).click();
      await expect(client.getByText('Your acknowledgment is recorded. The workspace will open after PMCM countersigns.', { exact: true })).toBeVisible();
      await modal.getByRole('button', { name: 'Refresh signing status', exact: true }).click();
      await modal.getByRole('checkbox', { name: 'I reviewed this exact version and approve the in-app record.' }).check();
      await modal.getByRole('button', { name: 'Countersign and activate', exact: true }).click();
      await expect(modal.getByText('Both acknowledgments are recorded; the client workspace is active.', { exact: true })).toBeVisible();
      const list = await api('GET', '/events');
      eventId = list.items.find(event => event.inquiryId === inquiry.id)?.id;
      expect(eventId).toBeTruthy();
    });

    await test.step('Client submits the briefing; PMCM issues a priced proposal; client approves it', async () => {
      await client.goto(`${origins.client}/dashboard/events/${eventId}/briefing`);
      await client.getByLabel(/^Venue preference/).fill('Browser acceptance venue');
      await client.getByLabel(/^Expected guest count/).fill('120');
      await client.getByLabel(/^Budget range/).fill('PHP 150k-500k');
      await client.getByLabel(/^Service requirements/).fill('Registration\nVenue coordination');
      await client.getByLabel(/^Additional notes/).fill('Synthetic event for cross-persona browser acceptance.');
      await client.getByRole('button', { name: 'Submit briefing', exact: true }).click();
      await expect(client.getByRole('button', { name: 'Submit updated briefing', exact: true })).toBeVisible();
      await pmcm.page.goto(path('briefing'));
      await pmcm.page.getByRole('tab', { name: 'Proposal', exact: true }).click();
      const proposal = pmcm.page.locator('section').filter({ has: pmcm.page.getByRole('heading', { name: 'Commercial proposal', exact: true }) });
      await proposal.getByLabel('Client budget (PHP)', { exact: true }).fill('150000');
      await proposal.getByLabel('Line 1 category', { exact: true }).fill('Venue');
      await proposal.getByLabel('Line 1 description', { exact: true }).fill('Event delivery');
      await proposal.getByLabel('Line 1 quantity', { exact: true }).fill('1');
      await proposal.getByLabel('Line 1 unit amount in PHP', { exact: true }).fill('100000');
      await proposal.getByLabel('Proposal title', { exact: true }).fill('Browser lifecycle proposal');
      await proposal.getByRole('button', { name: 'Issue to client', exact: true }).click();
      await expect(proposal.getByRole('status')).toContainText('Version 1 is issued');
      // The client's proposal package includes billing, and a client only sees a statement once PMCM sends it.
      await pmcm.page.goto(path('billing'));
      const billing = pmcm.page.getByRole('region', { name: 'Billing source', exact: true });
      await billing.getByLabel('Amount (PHP)', { exact: true }).fill('100000');
      await billing.getByLabel('Proposal evidence', { exact: true }).selectOption({ index: 1 });
      await billing.getByRole('button', { name: 'Create billing source', exact: true }).click();
      await billing.getByRole('button', { name: 'Approve source', exact: true }).click();
      await billing.getByRole('button', { name: 'Generate statement', exact: true }).click();
      await pmcm.page.getByRole('button', { name: 'Send to client', exact: true }).first().click();
      await expect.poll(async () => (await api('GET', `/pmcm/events/${eventId}/workspace`)).billingStatements.some(statement => Boolean(statement.sentAt))).toBe(true);
      await client.goto(`${origins.client}/dashboard/events/${eventId}/proposal`);
      await client.getByRole('button', { name: 'Approve proposal', exact: true }).click();
      await expect(client.getByText('Approved', { exact: true }).first()).toBeVisible();
    });

    await test.step('PMCM requests a supplier quote; supplier follows its own email; PMCM selects the quote', async () => {
      await pmcm.page.goto(path('suppliers'));
      await pmcm.page.getByRole('tab', { name: /^Requests & quotes/ }).click();
      await pmcm.page.getByRole('button', { name: 'Request Quotes', exact: true }).click();
      await pmcm.page.getByRole('checkbox', { name: /XPERTO Registration/ }).check();
      await pmcm.page.getByLabel('Quote deadline', { exact: true }).fill('12/01/2030');
      await expect(pmcm.page.getByLabel('Quote deadline', { exact: true })).toHaveValue('12/01/2030');
      const request = pmcm.page.waitForResponse(response => response.url().endsWith(`/events/${eventId}/quote-requests`) && response.request().method() === 'POST');
      await pmcm.page.getByRole('button', { name: 'Send Requests', exact: true }).click();
      const requests = await (await request).json();
      const token = (Array.isArray(requests) ? requests : requests.data)[0].accessToken;
      const mail = await inbox('ops@xperto.test', token);
      const context = await browser.newContext(device); contexts.push(context);
      const supplier = await context.newPage();
      await supplier.goto(mailLink(mail, '/quote-requests/', origins.supplier));
      await supplier.getByLabel('Quote amount (PHP)', { exact: true }).fill('50000');
      await supplier.getByLabel('Inclusions, one per line').fill('Registration equipment\nOn-site support');
      await supplier.getByRole('button', { name: 'Send quote to PMCM', exact: true }).click();
      await expect(supplier.getByRole('status')).toContainText('Your quote has been sent');
      await pmcm.page.reload();
      await pmcm.page.getByRole('tab', { name: /^Requests & quotes/ }).click();
      await pmcm.page.getByRole('button', { name: 'Select supplier', exact: true }).click();
      await expect(pmcm.page.getByRole('button', { name: 'Selected', exact: true })).toBeVisible();
    });

    await test.step('Supplier confirms the booking/readiness; PMCM assigns the coordinator; coordinator acknowledges', async () => {
      supplierActor = await persona(browser, 'supplier', device); contexts.push(supplierActor.context);
      await supplierActor.page.goto(`${origins.supplier}/dashboard/bookings`);
      const booking = await openBooking(supplierActor.page, inquiry.eventName);
      await booking.getByRole('button', { name: 'Confirm assignment', exact: true }).click();
      await booking.getByRole('button', { name: 'Confirm readiness', exact: true }).click();
      await expect(booking.getByRole('button', { name: 'Readiness confirmed', exact: true })).toBeVisible();
      await pmcm.page.goto(path('coordinators'));
      await pmcm.page.getByRole('group', { name: 'General Coordinator: Marco Santos', exact: true }).getByRole('button', { name: 'Quick assign', exact: true }).click();
      coordinator = await persona(browser, 'coordinator', device); contexts.push(coordinator.context);
      await coordinator.page.goto(`${origins.event}/dashboard?event=${eventId}`);
      await coordinator.page.getByRole('button', { name: /Acknowledge role|Confirm assignment/ }).first().click();
      await expect.poll(async () => (await api('GET', `/pmcm/events/${eventId}/workspace`)).coordinatorAssignments.some(item => item.coordinatorId === 'coord_marco' && item.status === 'acknowledged')).toBe(true);
    });

    await test.step('PMCM approves the official plan and starts event day from the event overview', async () => {
      await api('POST', `/events/${eventId}/ocular-visit/waive`, { reason: 'Synthetic browser acceptance venue fixture' });
      await api('POST', '/templates', { name: 'Browser acceptance layout', venue: 'Browser acceptance venue', width: 1200, height: 800, gridSize: 20, pax: 120, objects: [{ id: 'table-1', kind: 'table', position: { x: 100, y: 100 }, size: { width: 80, height: 80 }, rotation: 0, zIndex: 1 }] });
      await pmcm.page.goto(path('floorplans'));
      // Picking a template creates the PMCM draft and opens it in the editor; submission and approval live in the draft list.
      await pmcm.page.getByRole('button', { name: /Browser acceptance layout/ }).first().click();
      await expect(pmcm.page.getByRole('button', { name: 'Submit review' })).toBeVisible();
      await pmcm.page.goto(path('floorplans'));
      await pmcm.page.getByRole('button', { name: 'Submit', exact: true }).click();
      await pmcm.page.getByRole('button', { name: 'Approve', exact: true }).click();
      await expect.poll(async () => (await api('GET', `/pmcm/events/${eventId}/workspace`)).floorPlanDrafts.some(draft => draft.status === 'approved')).toBe(true);
      await pmcm.page.goto(path('overview'));
      await pmcm.page.getByRole('button', { name: 'Start event day', exact: true }).click();
      await expect.poll(async () => (await api('GET', `/events/${eventId}`)).status).toBe('event_day');
    });

    await test.step('Supplier reports arrival/readiness, coordinator logs a task, and guest checks in', async () => {
      await supplierActor.page.reload();
      const booking = await openBooking(supplierActor.page, inquiry.eventName);
      await booking.getByRole('button', { name: /^Arrived/ }).click();
      await booking.getByRole('button', { name: /^Set up and ready/ }).click();
      await coordinator.page.goto(`${origins.event}/dashboard?event=${eventId}&section=coord-queue`);
      const logTask = coordinator.page.locator('details', { has: coordinator.page.locator('summary', { hasText: 'Log a task' }) });
      if ((await logTask.getAttribute('open')) === null) await logTask.locator('summary').click();
      await coordinator.page.getByLabel('Task title (required)', { exact: true }).fill('Browser lifecycle venue sweep');
      await coordinator.page.getByLabel('Assigned role (required)', { exact: true }).selectOption('General Coordinator');
      await coordinator.page.getByRole('checkbox', { name: /Assign to me|Assign to my queue/ }).check();
      await coordinator.page.getByRole('button', { name: 'Log task', exact: true }).click();
      await expect(coordinator.page.getByText('Browser lifecycle venue sweep', { exact: true }).first()).toBeVisible();
      const guestName = `Lifecycle Guest ${info.project.name}`;
      await api('POST', `/guest/events/${eventId}/roster/import`, { source: 'csv', rows: [{ sourceKey: 'browser-lifecycle-guest', guestName }] });
      const detail = await api('GET', `/events/${eventId}`);
      const guestContext = await browser.newContext(device); contexts.push(guestContext);
      const guest = await guestContext.newPage();
      await guest.goto(`${origins.guest}/open`);
      await guest.getByLabel('Event code', { exact: true }).fill(detail.guestAccessCode);
      await guest.getByRole('button', { name: 'Preview event' }).click();
      await guest.getByRole('button', { name: 'Continue', exact: true }).click();
      await guest.getByLabel('Guest name', { exact: true }).fill(guestName);
      await guest.getByRole('checkbox', { name: /I consent to PMCM recording/ }).check();
      await guest.getByRole('button', { name: /check.in/i }).click();
      await expect(guest.getByRole('heading', { name: 'Check-in request received' })).toBeVisible();
      await booking.getByRole('button', { name: /^Done and leaving/ }).click();
    });

    await test.step('PMCM clears every close gate, the client submits closeout feedback, and PMCM archives without an override', async () => {
      const workspace = `/pmcm/events/${eventId}/workspace`;
      await pmcm.page.goto(path('closure'));
      const ended = new Date(Date.now() - 60_000);
      const local = new Date(ended.getTime() - ended.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
      await pmcm.page.getByLabel('Actual ended at', { exact: true }).fill(local);
      await pmcm.page.getByRole('button', { name: 'Record actual end', exact: true }).click();
      await expect(pmcm.page.getByRole('button', { name: 'Correct actual end', exact: true })).toBeVisible();
      await pmcm.page.getByRole('button', { name: 'Start quick wrap-up', exact: true }).click();
      await expect(pmcm.page.getByRole('button', { name: 'Save wrap-up evidence', exact: true })).toBeVisible();

      const logistics = pmcm.page.locator('section', { has: pmcm.page.getByRole('heading', { name: 'Asset returns and site clearance', exact: true }) });
      await logistics.getByRole('checkbox', { name: 'All assets and equipment returns verified' }).check();
      await logistics.getByLabel('Completion summary', { exact: true }).fill('Browser lifecycle: rented staging and AV returned; venue cleared.');
      await logistics.getByRole('button', { name: 'Record logistics completion', exact: true }).click();
      await expect(logistics.getByText(/revision 1/)).toBeVisible();

      const deliverables = pmcm.page.getByRole('region', { name: 'Post-event deliverables', exact: true });
      const markComplete = deliverables.getByRole('button', { name: 'Mark complete', exact: true });
      await expect(markComplete).toHaveCount(2);
      for (let remaining = 2; remaining > 0; remaining -= 1) {
        await markComplete.first().click();
        await expect(markComplete).toHaveCount(remaining - 1);
      }
      await expect(deliverables.getByRole('status')).toHaveCount(2);

      await pmcm.page.goto(path('billing'));
      const milestones = (await api('GET', workspace)).paymentMilestones;
      expect(milestones.length).toBeGreaterThan(0);
      const savePayment = pmcm.page.getByRole('button', { name: 'Save payment', exact: true });
      for (const [index] of milestones.entries()) {
        await pmcm.page.locator('button:enabled', { hasText: 'Record payment' }).first().click();
        await pmcm.page.getByLabel('Reference number', { exact: true }).fill(`BROWSER-LIFECYCLE-${index + 1}`);
        await savePayment.click();
        await expect(savePayment).toBeHidden();
      }
      await expect.poll(async () => (await api('GET', workspace)).paymentMilestones.every(milestone => milestone.status === 'paid' && milestone.remainingBalance === 0)).toBe(true);

      // The actual end opened the client's feedback window; closeout lives on the client event summary.
      await client.goto(`${origins.client}/dashboard/events/${eventId}/summary`);
      const feedback = client.locator('form', { has: client.getByRole('heading', { name: 'Your feedback', exact: true }) });
      await feedback.getByRole('combobox').selectOption('5');
      await feedback.getByLabel('Feedback', { exact: true }).fill('Browser lifecycle: smooth planning and a well-run event day.');
      await feedback.getByRole('button', { name: 'Submit feedback', exact: true }).click();
      await expect(feedback.getByRole('button', { name: 'Update feedback', exact: true })).toBeVisible();

      await expect.poll(async () => (await api('GET', `/events/${eventId}/close-gates`)).missingKeys).toEqual([]);
      await pmcm.page.goto(path('closure'));
      await expect(pmcm.page.getByText('All close gates passed', { exact: true })).toBeVisible();
      await expect(pmcm.page.getByPlaceholder('Required PMCM override reason if gates are not complete')).toHaveCount(0);
      await pmcm.page.getByRole('button', { name: 'Archive event', exact: true }).click();
      await expect.poll(async () => { const detail = await api('GET', `/events/${eventId}`); return detail.archived === true || Boolean(detail.archivedAt); }).toBe(true);
      await client.goto(`${origins.client}/dashboard/events/${eventId}/summary`);
      await expect(client.getByText(inquiry.eventName, { exact: true }).first()).toBeVisible();
      await coordinator.page.goto(`${origins.event}/dashboard?event=${eventId}&section=coord-queue`);
      await expect(coordinator.page.getByText('Archived event: operational records are read-only.', { exact: true })).toBeVisible();
    });
  } catch (error) {
    for (const [index, context] of contexts.entries()) {
      const page = context.pages()[0];
      if (page && !page.isClosed()) await info.attach(`persona-${index}-failure`, { body: await page.screenshot(), contentType: 'image/png' });
    }
    throw error;
  } finally { for (const context of contexts.reverse()) await context.close(); }
});
