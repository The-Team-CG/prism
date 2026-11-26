import { randomUUID } from 'node:crypto';
import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { api, freshEvent, origins, persona } from './helpers.mjs';
import { approvedOfficialPlan, approvedProposal, closeAll } from './journey-fixtures.mjs';

const hostCommand = (eventId, sessionId, command) =>
  api('POST', `/events/${eventId}/game-sessions/${sessionId}/commands`, { command, idempotencyKey: randomUUID() });

test('a guest joins a live poll with the host PIN and votes; the host sees the vote in the room totals', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser live poll');
  await approvedOfficialPlan(event);
  await approvedProposal(event);
  await api('POST', `/events/${event.eventId}/start-event-day`, {});
  // Configuring a poll is PMCM setup; the journey covers the guest-to-host handoff over a live session.
  const game = await api('POST', `/events/${event.eventId}/games`, { kind: 'live-poll', title: 'Pick the closing song', configuration: {
    kind: 'live-poll', rounds: [{ key: 'closing-song', prompt: 'Which song should close the night?', options: ['September', 'Dancing Queen'], durationSeconds: 120 }],
  } });
  await api('POST', `/events/${event.eventId}/games/${game.id}/publish`);
  const session = await api('POST', `/events/${event.eventId}/games/${game.id}/sessions`, { gameId: game.id });
  const sessionId = session.sessionId ?? session.id;
  await hostCommand(event.eventId, sessionId, 'start');
  const { pin } = await hostCommand(event.eventId, sessionId, 'enable-joins');
  const guestContext = await browser.newContext(device);
  const guest = await guestContext.newPage();
  const pmcm = await persona(browser, 'pmcm', device);
  const contexts = [guestContext, pmcm.context];
  try {
    await guest.goto(`${origins.guest}/games/join`);
    await guest.getByLabel('Game PIN', { exact: true }).fill(pin);
    await guest.getByRole('button', { name: 'Join game' }).click();
    await expect(guest).toHaveURL(/\/games\/session\/[^/]+$/);
    await guest.getByRole('button', { name: 'Dancing Queen', exact: true }).click();
    await expect(guest.getByText('Vote recorded.', { exact: false })).toBeVisible();

    await hostCommand(event.eventId, sessionId, 'pause');
    await pmcm.page.goto(`${origins.event}/dashboard/events/${event.eventId}/registration?part=games`);
    await pmcm.page.getByRole('tab', { name: 'Run live', exact: true }).click();
    const totals = pmcm.page.getByRole('list', { name: 'Aggregate vote results' });
    await expect(totals.getByRole('listitem').filter({ hasText: 'Dancing Queen' })).toContainText('1');
  } finally { await closeAll(contexts); }
});
