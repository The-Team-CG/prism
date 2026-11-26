import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, fitsViewport, freshEvent, inbox, mailLink, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, closeAll, signedIn, tokenFor } from './journey-fixtures.mjs';

async function prepareRegistration(event) {
  const { coordinators: directory } = await api('GET', '/pmcm/reference');
  const registrar = directory.find(coordinator => coordinator.id === 'coord_bianca');
  const password = process.env.PRISM_SEED_PASSWORD_COORDINATOR;
  const invitation = await api('POST', '/auth/invitations', { email: registrar.email, name: registrar.name, role: 'coordinator', organization: 'PMCM' });
  if (invitation.outcome !== 'existing_account') {
    expect(invitation.outcome).toBe('invited');
    const mail = await inbox(registrar.email, '/activate');
    const link = mailLink(mail, '/activate', origins.event);
    await api('POST', '/auth/activate', { token: new URL(link).searchParams.get('token'), password }, null);
  }
  const token = await tokenFor(registrar.email, password);
  const assignment = await api('POST', `/events/${event.eventId}/coordinators`, { coordinatorId: registrar.id, role: 'Registration Staff' });
  await api('PATCH', `/events/${event.eventId}/coordinators/${assignment.id}/acknowledge`, { decision: 'acknowledged' }, token);
  return { email: registrar.email, password };
}

async function searchDesk(desk, name) {
  await desk.getByRole('textbox', { name: 'Search guest roster' }).fill(name);
  await desk.getByRole('button', { name: 'Search guests' }).click();
  const row = desk.getByRole('row').filter({ hasText: name });
  await expect(row).toBeVisible();
  return row;
}

test('guest and coordinator walk-ins reach PMCM Registration for verification and check-in', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser walk-in verification', { daysAhead: info.project.name === 'mobile' ? 222 : 221 });
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  const registrar = await prepareRegistration(event);
  const pmcm = await persona(browser, 'pmcm', device);
  const coordinator = await signedIn(browser, device, origins.event, registrar.email, registrar.password);
  const guestContext = await browser.newContext(device);
  const guest = await guestContext.newPage();
  const registrationUrl = `${origins.event}/dashboard/events/${event.eventId}/registration`;
  const desk = coordinator.page.getByRole('region', { name: 'Registration desk' });
  const onlineName = 'Nora Online Walk-in';
  const deskName = 'Pia Desk Walk-in';
  try {
    await test.step('PMCM opens walk-ins for a private event', async () => {
      await pmcm.page.goto(registrationUrl);
      await pmcm.page.getByRole('radio', { name: 'Private', exact: true }).click();
      await pmcm.page.getByRole('group', { name: 'Walk-ins' }).getByRole('radio', { name: 'Open', exact: true }).click();
      await pmcm.page.getByRole('button', { name: 'Save changes', exact: true }).click();
      await expect(pmcm.page.getByText('Admission settings saved.')).toBeVisible();
      await expect.poll(async () => (await api('GET', `/events/${event.eventId}/walk-in-policy`)).policy).toBe('open');
      await api('POST', `/events/${event.eventId}/start-event-day`, {});
    });

    await test.step('an unrostered guest submits a check-in for staff review', async () => {
      const detail = await api('GET', `/events/${event.eventId}`);
      await guest.goto(`${origins.guest}/open`);
      await guest.getByLabel('Event code', { exact: true }).fill(detail.guestAccessCode);
      await guest.getByRole('button', { name: 'Open my pass' }).click();
      await expect(guest).toHaveURL(/\/dashboard/);
      // Each viewport uses a different event date so staffing assignments do not collide.
      await expect(guest.getByText(/^Check-in opens on/)).toBeVisible();
      await guest.clock.setFixedTime(new Date(`${event.eventDate}T12:00:00+08:00`));
      await guest.reload();
      await guest.getByLabel('Guest name', { exact: true }).fill(onlineName);
      await guest.getByRole('checkbox', { name: /I consent to PMCM recording/ }).check();
      await guest.getByRole('button', { name: 'Check me in', exact: true }).click();
      await expect(guest.getByRole('heading', { name: /^Check-in sent/ })).toBeVisible();
      await expect(guest.getByRole('status', { name: 'Check-in' })).toContainText('Registration confirms arrivals at the door.');
    });

    await test.step('the coordinator sees the pending guest and flags a second walk-in for PMCM', async () => {
      await coordinator.page.goto(`${origins.event}/coordinator?event=${event.eventId}&view=registration`);
      await desk.getByRole('button', { name: 'Pending reviews' }).click();
      await expect(desk.getByRole('row').filter({ hasText: onlineName })).toContainText('Not checked in');
      await desk.getByLabel('Guest name', { exact: true }).fill(deskName);
      await desk.getByRole('checkbox', { name: /The guest received the privacy notice/ }).check();
      await desk.getByRole('button', { name: 'Register walk-in' }).click();
      await expect(desk.getByRole('status')).toContainText(`${deskName} was added to the roster pending verification.`);
      const row = desk.getByRole('row').filter({ hasText: deskName });
      await expect(row).toContainText('Not checked in');
      await expect(row.getByRole('button', { name: `Check in ${deskName}` })).toHaveCount(0);
      await row.getByRole('button', { name: `Flag ${deskName} for verification` }).click();
      await expect(row).toContainText('Flagged for verification');
      await expect(row.getByRole('button', { name: `Mark ${deskName} verified` })).toHaveCount(0);
      await expect.poll(() => fitsViewport(coordinator.page)).toBe(true);
    });

    await test.step('PMCM verifies both walk-ins, checks them in, and the coordinator sees the arrivals', async () => {
      await pmcm.page.goto(registrationUrl);
      await expect(pmcm.page.getByRole('listitem').filter({ hasText: deskName })).toContainText('Flagged for verification by Bianca Lim');
      for (const name of [onlineName, deskName]) {
        const verification = pmcm.page.getByRole('combobox', { name: `Verification for ${name}` });
        const row = pmcm.page.getByRole('listitem').filter({ hasText: name });
        const checkIn = row.getByRole('button', { name: 'Check in', exact: true });
        await expect(checkIn).toBeDisabled();
        await verification.click();
        await pmcm.page.getByRole('option', { name: 'Verified', exact: true }).click();
        await expect(checkIn).toBeEnabled();
        await checkIn.click();
        await expect(row).toContainText(/Checked in /);
      }
      await expect.poll(() => fitsViewport(pmcm.page)).toBe(true);
      await coordinator.page.reload();
      for (const name of [onlineName, deskName]) {
        const row = await searchDesk(desk, name);
        await expect(row).toContainText('Checked in at');
      }
    });
  } finally { await closeAll([pmcm.context, coordinator.context, guestContext]); }
});
