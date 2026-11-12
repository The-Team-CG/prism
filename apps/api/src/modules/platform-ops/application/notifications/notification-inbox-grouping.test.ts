import { describe, expect, it } from 'vitest';
import type { PrismNotificationInboxItem } from '@prism/types';
import { groupInboxDeliveries } from './notification-inbox-grouping';

function notice(channel: string, operationId?: string) {
  return { id: channel, notificationId: `notice-${channel}`, eventId: 'event', channel, message: 'Review the statement', version: `${channel}-version`, createdAt: '2026-11-13T00:00:00Z', readAt: null, acknowledgedAt: null, operationId } satisfies PrismNotificationInboxItem & { operationId?: string };
}

describe('logical recipient notices', () => {
  it('shows one notice for both channels and retains every receipt version and pending deadline', () => {
    const email = { ...notice('email', 'statement:1:email'), readAt: '2026-11-13T01:00:00Z', acknowledgedAt: '2026-11-13T01:00:00Z' };
    const viber = { ...notice('viber', 'statement:1:viber'), acknowledgmentDueAt: '2026-11-14T00:00:00Z' };
    const [group] = groupInboxDeliveries([email, viber]);
    expect(group).toMatchObject({ channel: 'email, viber', readAt: null, acknowledgedAt: null, acknowledgmentDueAt: viber.acknowledgmentDueAt,
      deliveries: [{ id: 'email', version: 'email-version' }, { id: 'viber', version: 'viber-version' }] });
    expect(group).not.toHaveProperty('operationId');
  });

  it('groups message keys whose channel is before the email, without collapsing repeated or different notices', () => {
    const pair = ['email', 'viber'].map((channel) => notice(channel, `communication-message:m1:${channel}:a@example.test`));
    expect(groupInboxDeliveries(pair)).toHaveLength(1);
    expect(groupInboxDeliveries([pair[0], notice('viber', 'communication-message:m2:viber:a@example.test')])).toHaveLength(2);
    expect(groupInboxDeliveries([pair[0], { ...pair[1], message: 'Changed statement' }])).toHaveLength(2);
    expect(groupInboxDeliveries([pair[0], { ...pair[1], action: { kind: 'event_section', eventId: 'event', section: 'billing' } }])).toHaveLength(2);
    expect(groupInboxDeliveries([notice('email'), notice('viber')])).toHaveLength(2);
  });
});
