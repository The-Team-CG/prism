import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { oneTableScene } from '../floorplan-fixture.mjs';

test('PMCM adds a piece to a floorplan and finds it after reopening', async ({ browser }, info) => {
  test.skip(info.project.name === 'mobile', 'Floorplan editing is view-only on phones');
  test.setTimeout(180_000);
  const event = await freshEvent('Browser floorplan editing');
  await api('POST', `/events/${event.eventId}/ocular-visit/waive`, { reason: 'Synthetic browser venue' });
  const template = await api('POST', '/templates', { name: `Browser editor ${event.eventId}`, venue: 'Browser venue', pax: 120, scene: oneTableScene('Browser editor venue') });
  const draft = await api('POST', `/events/${event.eventId}/floorplans`, { name: 'Editor acceptance draft', sourceType: 'template', venueTemplateId: template.id });
  const pmcm = await persona(browser, 'pmcm', projectDevice(info.project.name));
  const plan = () => api('GET', `/plans/${draft.floorPlanId}`);
  try {
    const before = await plan();
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/floorplans`);
    await pmcm.page.getByRole('button', { name: 'Open / Edit', exact: true }).first().click();
    const planView = pmcm.page.getByRole('button', { name: '2D', exact: true });
    await planView.focus({ timeout: 60_000 });
    await planView.press('Enter', { timeout: 60_000 });
    await expect(planView).toHaveAttribute('aria-pressed', 'true');
    await pmcm.page.getByRole('searchbox', { name: 'Search pieces' }).fill('Registration desk');
    const piece = pmcm.page.getByRole('button', { name: /Registration desk/ });
    await piece.focus();
    await piece.press('Enter');
    const viewport = pmcm.page.viewportSize();
    await pmcm.page.mouse.click(viewport.width / 2, viewport.height / 2);
    await expect.poll(async () => Object.keys((await plan()).scene.nodes).length, { timeout: 30_000 }).toBeGreaterThan(Object.keys(before.scene.nodes).length);
    await pmcm.page.getByRole('button', { name: 'Back to floor plans' }).click();
    await pmcm.page.getByRole('button', { name: 'Open / Edit', exact: true }).first().click();
    await expect(pmcm.page.getByRole('button', { name: 'Back to floor plans' })).toBeVisible();
    expect(Object.values((await plan()).scene.nodes).some(node => node.type === 'prism-registration')).toBe(true);
  } finally { await pmcm.context.close(); }
});
