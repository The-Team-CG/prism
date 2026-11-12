import { describe, expect, it } from 'vitest';
import { conversationNoticeUrl } from './conversation-notice-url';
import { notificationHtml } from './mail-notification-delivery.adapter';
import { vi } from 'vitest';
import { MailNotificationDeliveryAdapter } from './mail-notification-delivery.adapter';
import { ChannelNotificationDeliveryAdapter } from './channel-notification-delivery.adapter';

const portals = { client: 'https://client.example.test', supplier: 'https://supplier.example.test', event: 'https://event.example.test' };

describe('conversation notices outside PRISM', () => {
  it.each(['client', 'supplier', 'event'] as const)('opens the recipient %s portal using a sign-in-safe query', (portal) => {
    const url = conversationNoticeUrl({ kind: 'conversation', eventId: 'event', threadId: 'thread /?&#', portal }, portals);
    expect(new URL(url!).origin).toBe(portals[portal]);
    expect(new URL(url!).searchParams.get('conversation')).toBe('thread /?&#');
    expect(new URL(url!).hash).toBe('');
  });

  it('does not invent destinations for legacy or unrelated notices, and escapes email markup', () => {
    expect(conversationNoticeUrl({ kind: 'conversation', eventId: 'event', threadId: 'thread', portal: 'coordinator' }, portals)).toBe('https://event.example.test/dashboard?view=messages&conversation=thread');
    expect(conversationNoticeUrl({ kind: 'conversation', eventId: 'event', threadId: 'thread' }, portals)).toBeUndefined();
    expect(conversationNoticeUrl({ kind: 'event_section', eventId: 'event', section: 'billing' }, portals)).toBeUndefined();
    expect(notificationHtml('<script>note</script>', 'https://client.example.test/?a=1&b=2')).toContain('href="https://client.example.test/?a=1&amp;b=2"');
    expect(notificationHtml('<script>note</script>')).not.toContain('<script>');
    expect(notificationHtml('An ordinary notice')).not.toContain('<a ');
  });

  it('includes the same conversation destination in email text, HTML and a linked recipient Viber notice', async () => {
    const send = vi.fn(async () => ({ status: 'accepted', receipt: 'email-receipt' }));
    const sendText = vi.fn(async () => ({ status: 'accepted', messageToken: '123' }));
    const recipients = { deliver: async (_id: string, _resolve: unknown, deliver: (email: string) => Promise<unknown>) => deliver('supplier@example.test') };
    const mail = new MailNotificationDeliveryAdapter({ send } as never, {} as never, recipients as never, portals);
    const channel = new ChannelNotificationDeliveryAdapter(mail, { findViberRecipients: async () => [{ viberUserId: 'viber-user' }] } as never, {} as never, recipients as never, { sendText } as never, portals);
    const input = { idempotencyKey: 'notice', eventId: null, recipient: 'supplier@example.test', message: 'New message <not markup>', action: { kind: 'conversation', eventId: 'event', threadId: 'thread', portal: 'supplier' } } as const;
    await mail.deliver({ ...input, channel: 'email' });
    await channel.deliver({ ...input, channel: 'viber' });
    const url = 'https://supplier.example.test/dashboard/messages?conversation=thread';
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ text: `${input.message}\n\nOpen conversation: ${url}`, html: expect.stringContaining(`href="${url}"`) }));
    expect(sendText).toHaveBeenCalledWith('viber-user', `${input.message}\n\nOpen conversation: ${url}`);
  });
});
