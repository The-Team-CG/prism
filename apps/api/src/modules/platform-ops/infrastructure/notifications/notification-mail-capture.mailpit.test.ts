import { randomUUID } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { NotificationOutboxService } from '../../application/notifications/notification-outbox.service';
import { NotificationRecipientDeliveryService } from '../../application/notifications/notification-recipient-delivery.service';
import { NotificationInboxService } from '../../application/notifications/notification-inbox.service';
import { MailpitMailTransport } from '../../../../kernel/mail/mailpit-mail-transport';
import { MailNotificationDeliveryAdapter } from './mail-notification-delivery.adapter';

/**
 * A local check, not a required CI suite: it needs the isolated PostgreSQL (127.0.0.1:55437/prism_p0) and a Mailpit
 * inbox (127.0.0.1:55439), neither of which the CI database runner provides, so it is named outside that runner's
 * patterns on purpose. Without both it is skipped. See docs/runbooks/operational-communications.md.
 */
const url = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(url && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(url));
if (url && !live) throw new Error('Notification tests require isolated 127.0.0.1:55437/prism_p0');
const mailCapture = process.env.PRISM_COMMS_MAILPIT_URL === 'http://127.0.0.1:55439';

describe.skipIf(!live || !mailCapture)('queued email through real local mail capture', () => {
  it('delivers durable work, then records the recipient read and acknowledgment', async () => {
    const prisma = new PrismaService();
    const recipient = `comms-${randomUUID()}@example.test`;
    const message = 'Your event instruction is ready for review.';
    const adapter = new MailNotificationDeliveryAdapter(new MailpitMailTransport('http://127.0.0.1:55439'), {} as never, new NotificationRecipientDeliveryService(prisma));
    const outbox = new NotificationOutboxService(prisma, adapter);
    const row = await outbox.queue(undefined, recipient, message);
    try {
      expect((await outbox.processQueued()).find((entry) => entry.id === row.id)).toMatchObject({ status: 'sent' });
      const delivery = await prisma.opsNotificationDelivery.findFirstOrThrow({ where: { notificationId: row.id } });
      expect(delivery.providerReceipt).toMatch(/^mailpit:/);
      const captured = await fetch(`http://127.0.0.1:55439/api/v1/message/${encodeURIComponent(delivery.providerReceipt!.slice('mailpit:'.length))}`);
      expect(captured.ok).toBe(true);
      expect(await captured.json()).toMatchObject({ Text: message });
      const inbox = new NotificationInboxService(prisma, {} as never, { write: vi.fn() } as never);
      const actor = { id: 'mail-test', role: 'client', email: recipient, name: 'Test recipient' } as never;
      const [notice] = await inbox.mine(actor);
      await inbox.markRead(notice.id, notice.version, actor);
      await inbox.acknowledge(notice.id, notice.version, actor);
      expect((await inbox.mine(actor))[0]).toMatchObject({ message, readAt: expect.any(String), acknowledgedAt: expect.any(String) });
    } finally {
      await prisma.opsNotificationLog.delete({ where: { id: row.id } });
      await prisma.$disconnect();
    }
  });
});
