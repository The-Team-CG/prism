import { test, expect } from '@playwright/test';
import { projectDevice } from './browser-devices.mjs';
import { freshEvent, origins, persona } from './helpers.mjs';
import { signedInClient, closeAll, startConversation, openConversation, sendMessage, conversationShows } from './journey-fixtures.mjs';

test('PMCM starts a conversation with the client, the client replies, and PMCM reads the reply', async ({ browser }, info) => {
  const device = projectDevice(info.project.name);
  const event = await freshEvent('Browser messages');
  const pmcm = await persona(browser, 'pmcm', device);
  const client = await signedInClient(browser, device, event);
  const contexts = [pmcm.context, client.context];
  const subject = `Venue walkthrough ${info.project.name}`;
  try {
    await startConversation(pmcm.page, event.eventId, subject, event.email);
    await sendMessage(pmcm.page, subject, 'Can you confirm the venue walkthrough on Friday?');

    await client.page.goto(`${origins.client}/dashboard/messages`);
    await openConversation(client.page, subject);
    await conversationShows(client.page, subject, 'Can you confirm the venue walkthrough on Friday?');
    await sendMessage(client.page, subject, 'Friday works for us, 10 AM.');

    await pmcm.page.reload();
    await openConversation(pmcm.page, subject);
    await conversationShows(pmcm.page, subject, 'Friday works for us, 10 AM.');
  } finally { await closeAll(contexts); }
});
