import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, fitsViewport, freshEvent, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, closeAll, pickDateTime, tokenFor } from './journey-fixtures.mjs';

test('PMCM authors the run of show and the assigned coordinator reads the same run sheet', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser run of show', { daysAhead: info.project.name === 'mobile' ? 212 : 211 });
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  const assignment = await api('POST', `/events/${event.eventId}/coordinators`, { coordinatorId: 'coord_marco', role: 'General Coordinator' });
  const token = await tokenFor('marco@pmcm.test', process.env.PRISM_SEED_PASSWORD_COORDINATOR);
  await api('PATCH', `/events/${event.eventId}/coordinators/${assignment.id}/acknowledge`, { decision: 'acknowledged' }, token);

  const pmcm = await persona(browser, 'pmcm', { ...device, timezoneId: 'UTC' });
  const coordinator = await persona(browser, 'coordinator', device);
  const dayLabel = 'Conference programme';
  const segment = 'Opening remarks';
  const eventDate = new Date(`${event.eventDate}T04:00:00Z`);
  const [year, month, day] = event.eventDate.split('-');
  try {
    await coordinator.page.goto(`${origins.event}/coordinator?event=${event.eventId}&view=run-sheet`);
    await expect(coordinator.page.getByText("PMCM hasn't published the run sheet for this event yet.")).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/live-ops`);
    await pmcm.page.getByText('Schedule and reports', { exact: true }).click();
    const schedule = pmcm.page.getByRole('region', { name: 'Onsite schedule and reports' });
    await schedule.getByRole('textbox', { name: 'Day date' }).fill(`${month}/${day}/${year}`);
    await schedule.getByRole('textbox', { name: 'Day label (optional)' }).fill(dayLabel);
    await schedule.getByRole('button', { name: 'Add day' }).click();
    const scheduleDay = schedule.getByRole('article').filter({ has: pmcm.page.getByRole('heading', { name: dayLabel }) });
    await scheduleDay.getByRole('textbox', { name: 'Segment title' }).fill(segment);
    await pickDateTime(pmcm.page, scheduleDay.getByRole('button', { name: /^Starts/ }), eventDate, '10:00 AM');
    await pickDateTime(pmcm.page, scheduleDay.getByRole('button', { name: /^Ends/ }), eventDate, '10:30 AM');
    await scheduleDay.getByRole('combobox', { name: 'Owner role' }).click();
    await pmcm.page.getByRole('option', { name: 'General Coordinator', exact: true }).click();
    await scheduleDay.getByRole('textbox', { name: 'Location', exact: true }).fill('Main stage');
    await scheduleDay.getByRole('button', { name: 'Add', exact: true }).click();
    const row = scheduleDay.getByRole('listitem').filter({ hasText: segment });
    await expect(row).toContainText(/10:00.*10:30/);
    await expect(row).toContainText('Main stage');
    await expect(row).toContainText('Status: planned');
    await expect.poll(() => fitsViewport(pmcm.page)).toBe(true);

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/run-sheet`);
    await expect(pmcm.page.getByText(segment, { exact: true }).first()).toBeVisible();
    await expect(pmcm.page.getByText('Main stage', { exact: false }).first()).toBeVisible();

    await coordinator.page.reload();
    await expect(coordinator.page.getByText(segment, { exact: true }).first()).toBeVisible();
    await expect(coordinator.page.getByText('Main stage', { exact: false }).first()).toBeVisible();
    await expect(coordinator.page.getByRole('button', { name: 'Add day', exact: true })).toHaveCount(0);
    await expect.poll(() => fitsViewport(coordinator.page)).toBe(true);
  } finally { await closeAll([pmcm.context, coordinator.context]); }
});
