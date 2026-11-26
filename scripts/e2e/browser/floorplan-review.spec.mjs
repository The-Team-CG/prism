import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { closeAll, signedInClient, submittedOfficialPlan } from './journey-fixtures.mjs';
import { oneTableScene } from '../floorplan-fixture.mjs';

test('client annotates the official layout and asks for a revision; PMCM sees the request, resubmits, and the client approves', async ({ browser }, info) => {
  test.setTimeout(4 * 60_000);
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser floor plan review');
  const draft = await submittedOfficialPlan(event);
  const client = await signedInClient(browser, device, event);
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [client.context, pmcm.context];
  const draftStatus = async () => (await api('GET', `/pmcm/events/${event.eventId}/workspace`)).floorPlanDrafts.find(item => item.id === draft.id)?.status;
  try {
    await client.page.goto(`${origins.client}/dashboard/events/${event.eventId}/floor-plan`);
    await expect(client.page.getByRole('heading', { name: 'Review this version' })).toBeVisible();
    await client.page.getByLabel('Floorplan annotation').fill('Move the head table closer to the stage.');
    await client.page.getByRole('button', { name: 'Add annotation', exact: true }).click();
    await expect(client.page.getByText('Move the head table closer to the stage.').first()).toBeVisible();
    await client.page.getByLabel('Revision comment').fill('Please swap the head table and the buffet.');
    await client.page.getByRole('button', { name: 'Request revision', exact: true }).click();
    await expect.poll(draftStatus).toBe('revision_requested');

    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/floorplans`);
    await expect(pmcm.page.getByText('Please swap the head table and the buffet.')).toBeVisible();
    // PMCM revises the layout in the editor (gestures are outside this journey), so the resubmitted version is new.
    const plan = await api('GET', `/plans/${draft.floorPlanId}`);
    await api('PUT', `/plans/${draft.floorPlanId}`, { expectedUpdatedAt: plan.updatedAt, scene: oneTableScene('Official browser layout, head table moved') });
    await pmcm.page.reload();
    await pmcm.page.getByRole('button', { name: 'Submit', exact: true }).click();
    await expect.poll(draftStatus).toBe('in_review');

    await client.page.reload();
    await client.page.getByRole('button', { name: 'Approve this version', exact: true }).click();
    // The decision is recorded against this version; official approval stays with PMCM.
    await expect(client.page.getByRole('button', { name: 'Approve this version', exact: true })).toHaveCount(0);
    await pmcm.page.reload();
    await pmcm.page.getByRole('button', { name: 'Approve', exact: true }).click();
    await expect.poll(draftStatus).toBe('approved');
  } finally { await closeAll(contexts); }
});
