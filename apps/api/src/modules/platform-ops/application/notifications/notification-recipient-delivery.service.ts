import { Injectable, Optional } from '@nestjs/common';
import type { OpsNotificationDelivery } from '@prisma/client';
import { NotificationProviderOutcomeService } from './notification-provider-outcome.service';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';
import type { ResolvedNotificationRecipients } from './notification-recipient-resolver';

/** A recipient in one of these states has been answered for good and is never sent to again. */
const FINAL_STATUSES = ['accepted', 'failed', 'skipped'];

/**
 * What a provider's answer means for one recipient. An acceptance without a receipt is not an acceptance, and any other
 * answer (a retryable failure) leaves the recipient pending for the next attempt.
 */
function settlementFor(result: NotificationDeliveryResult): { status: string; providerReceipt: string | null; failureReason: string | null } {
  if (result.status === 'accepted' && result.receipt.trim()) return { status: 'accepted', providerReceipt: result.receipt, failureReason: null };
  if (result.status === 'permanent_failure') return { status: 'failed', providerReceipt: null, failureReason: result.reason };
  if (result.status === 'skipped') return { status: 'skipped', providerReceipt: null, failureReason: result.reason };
  return { status: 'pending', providerReceipt: null, failureReason: null };
}

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

    await Promise.all(
      // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one step per recipient, and a notification with more than 200 recipients is refused above.
      rows.map((row) => this.deliverToRow(row, currentlyAllowed, send)),
    );

    const settled = await this.prisma.opsNotificationDelivery.findMany({ where: { notificationId }, orderBy: { recipient: 'asc' } });
    if (settled.some((row) => row.status === 'pending')) return { status: 'retryable_failure', reason: 'At least one recipient is awaiting provider acceptance' };
    if (settled.some((row) => row.status === 'failed')) return { status: 'permanent_failure', reason: 'Provider rejected at least one recipient' };
    const receipts = settled.flatMap((row) => row.status === 'accepted' && row.providerReceipt ? [row.providerReceipt] : []);
    if (receipts.length === 0) return { status: 'skipped', reason: 'No recipient was eligible for this channel' };
    return { status: 'accepted', receipt: receipts.join(',') };
  }

  /** Send to one recipient and record the provider's answer. A recipient already settled is never sent to again. */
  private async deliverToRow(row: OpsNotificationDelivery, currentlyAllowed: Set<string>, send: (address: string) => Promise<NotificationDeliveryResult>) {
    if (FINAL_STATUSES.includes(row.status)) return;
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
    const settlement = settlementFor(result);
    await this.prisma.opsNotificationDelivery.updateMany({
      where: { id: row.id, status: { notIn: FINAL_STATUSES } },
      data: {
        status: settlement.status,
        attempts: { increment: 1 },
        providerReceipt: settlement.providerReceipt,
        failureReason: settlement.failureReason,
        acceptedAt: settlement.status === 'accepted' ? new Date() : null,
      },
    });
    if (settlement.providerReceipt) await this.outcomes?.reconcile(settlement.providerReceipt);
  }
}
