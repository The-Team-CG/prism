import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, closeAll, tokenFor } from './journey-fixtures.mjs';

test('a coordinator reports an issue on event day, PMCM resolves it in live ops, and the coordinator sees it resolved', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  // A coordinator cannot hold two events on one day, so each viewport's event gets its own date.
  const event = await freshEvent('Browser coordinator issue', { daysAhead: info.project.name === 'mobile' ? 202 : 201 });
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  const assignment = await api('POST', `/events/${event.eventId}/coordinators`, { coordinatorId: 'coord_marco', role: 'General Coordinator' });
  const marco = await tokenFor('marco@pmcm.test', process.env.PRISM_SEED_PASSWORD_COORDINATOR);
  await api('PATCH', `/events/${event.eventId}/coordinators/${assignment.id}/acknowledge`, { decision: 'acknowledged' }, marco);
  await api('POST', `/events/${event.eventId}/start-event-day`, {});
  const coordinator = await persona(browser, 'coordinator', device);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [coordinator.context, pmcm.context];
  const note = `Projector at stage left has no signal (${info.project.name})`;
  try {
    await coordinator.page.goto(`${origins.event}/dashboard?event=${event.eventId}&view=issues`);
    await coordinator.page.getByRole('button', { name: 'Report an issue' }).first().click();
    const sheet = coordinator.page.getByRole('dialog', { name: 'Report an issue' });
    await sheet.getByRole('group', { name: 'Kind of problem' }).getByText('Equipment', { exact: true }).click();
    await sheet.getByPlaceholder('Caterer 30 minutes late, no word yet').fill(note);
    await sheet.getByRole('button', { name: 'Send to PMCM', exact: true }).click();
    await expect(sheet).toBeHidden();
    await expect(coordinator.page.getByText(note, { exact: false }).first()).toBeVisible();

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/live-ops`);
    const issues = pmcm.page.getByRole('region', { name: 'Urgent issues' });
    await expect(issues).toContainText(note);
    await issues.getByRole('button', { name: 'Mark resolved', exact: true }).click();
    await expect(issues.getByRole('button', { name: 'Mark resolved', exact: true })).toHaveCount(0);

    await coordinator.page.reload();
    await expect(coordinator.page.getByRole('heading', { name: /^Resolved · 1/ })).toBeVisible();
  } finally { await closeAll(contexts); }
});
