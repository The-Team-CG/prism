import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { AccountEmailRelink, AccountEmailRelinker } from '@prism/kernel/shared-kernel';

/**
 * Where notifications go, the person's notification inbox (and deliveries not sent yet), and their privacy requests,
 * holds and review items are keyed by their email, so they follow the account. If the new address already has
 * channel settings, those stay and the old row goes. The notification log keeps the address each message was for.
 */
@Injectable()
export class PlatformAccountEmailRelinkerService implements AccountEmailRelinker {
  async relinkAccountEmail(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    const preferences = await this.movePreferences(input, tx);
    const inbox = await this.moveInbox(input, tx);
    const sameSubject = { subjectEmail: { equals: input.previousEmail, mode: 'insensitive' as const } };
    const requests = await tx.opsPrivacyRequest.updateMany({ where: sameSubject, data: { subjectEmail: input.newEmail } });
    const holds = await tx.opsPrivacyLegalHold.updateMany({ where: sameSubject, data: { subjectEmail: input.newEmail } });
    const reviews = await tx.opsRetentionReviewItem.updateMany({ where: sameSubject, data: { subjectEmail: input.newEmail } });
    return {
      surfaces: ['notification_channel_preferences', 'notification_deliveries', 'privacy_requests', 'privacy_legal_holds', 'retention_review_items'],
      touchedRecords: preferences + inbox + requests.count + holds.count + reviews.count,
    };
  }

  /** One delivery per notification and recipient: a notice already delivered to the new address keeps that copy. */
  private async moveInbox(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    const already = await tx.opsNotificationDelivery.findMany({ where: { recipient: input.newEmail }, select: { notificationId: true } });
    const moved = await tx.opsNotificationDelivery.updateMany({
      where: { recipient: input.previousEmail, notificationId: { notIn: already.map((row) => row.notificationId) } },
      data: { recipient: input.newEmail },
    });
    return moved.count;
  }

  private async movePreferences(input: AccountEmailRelink, tx: Prisma.TransactionClient) {
    const existing = await tx.opsNotificationChannelPreference.findUnique({ where: { email: input.newEmail }, select: { email: true } });
    if (existing) return (await tx.opsNotificationChannelPreference.deleteMany({ where: { email: input.previousEmail } })).count;
    return (await tx.opsNotificationChannelPreference.updateMany({ where: { email: input.previousEmail }, data: { email: input.newEmail } })).count;
  }
}
