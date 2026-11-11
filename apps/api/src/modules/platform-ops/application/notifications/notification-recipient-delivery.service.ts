import { Injectable, Optional } from '@nestjs/common';
import { NotificationProviderOutcomeService } from './notification-provider-outcome.service';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import type { ResolvedNotificationRecipients } from './notification-recipient-resolver';

/** Persists the recipient snapshot and each provider acceptance independently of the parent outbox row. */
@Injectable()
export class NotificationRecipientDeliveryService {
  constructor(private readonly prisma: PrismaService, @Optional() private readonly outcomes?: NotificationProviderOutcomeService) {}

  async deliver(
    notificationId: string,
    resolve: () => Promise<ResolvedNotificationRecipients>,
    send: (address: string) => Promise<NotificationDeliveryResult>,
  ): Promise<NotificationDeliveryResult> {
    let rows = await this.prisma.opsNotificationDelivery.findMany({ where: { notificationId }, orderBy: { recipient: 'asc' } });
    const recipients = await resolve();
    if (recipients.status === 'failed') return { status: 'permanent_failure', reason: recipients.reason };
    if (recipients.addresses.length > 200) return { status: 'permanent_failure', reason: 'Notification recipient limit exceeded; operator review required' };
    const currentlyAllowed = new Set(recipients.addresses.map((address) => address.trim().toLowerCase()));
    if (rows.length === 0) {
      await this.prisma.opsNotificationDelivery.createMany({
        data: recipients.addresses.map((address) => ({ id: `ndel_${randomUUID()}`, notificationId, recipient: address.trim().toLowerCase() })),
        skipDuplicates: true,
      });
      rows = await this.prisma.opsNotificationDelivery.findMany({ where: { notificationId }, orderBy: { recipient: 'asc' } });
    }

    await Promise.all(rows.map(async (row) => {
      if (row.status === 'accepted' || row.status === 'failed' || row.status === 'skipped') return;
      if (!currentlyAllowed.has(row.recipient)) {
        await this.prisma.opsNotificationDelivery.updateMany({
          where: { id: row.id, status: 'pending' },
          data: { status: 'skipped', failureReason: 'Recipient no longer belongs to the notification scope' },
        });
        return;
      }
      let result: NotificationDeliveryResult;
      try { result = await send(row.recipient); }
      catch { result = { status: 'retryable_failure' }; }
      const accepted = result.status === 'accepted' && Boolean(result.receipt.trim());
      const failed = result.status === 'permanent_failure';
      const skipped = result.status === 'skipped';
      await this.prisma.opsNotificationDelivery.updateMany({
        where: { id: row.id, status: { notIn: ['accepted', 'failed', 'skipped'] } },
        data: {
          status: accepted ? 'accepted' : failed ? 'failed' : skipped ? 'skipped' : 'pending',
          attempts: { increment: 1 },
          providerReceipt: accepted && result.status === 'accepted' ? result.receipt : null,
          failureReason: result.status === 'permanent_failure' || result.status === 'skipped' ? result.reason : null,
          acceptedAt: accepted ? new Date() : null,
        },
      });
      if (accepted && result.status === 'accepted') await this.outcomes?.reconcileViber(result.receipt);
    }));

    const settled = await this.prisma.opsNotificationDelivery.findMany({ where: { notificationId }, orderBy: { recipient: 'asc' } });
    if (settled.some((row) => row.status === 'pending')) return { status: 'retryable_failure', reason: 'At least one recipient is awaiting provider acceptance' };
    if (settled.some((row) => row.status === 'failed')) return { status: 'permanent_failure', reason: 'Provider rejected at least one recipient' };
    const receipts = settled.flatMap((row) => row.status === 'accepted' && row.providerReceipt ? [row.providerReceipt] : []);
    if (receipts.length === 0) return { status: 'skipped', reason: 'No recipient was eligible for this channel' };
    return { status: 'accepted', receipt: receipts.join(',') };
  }
}
