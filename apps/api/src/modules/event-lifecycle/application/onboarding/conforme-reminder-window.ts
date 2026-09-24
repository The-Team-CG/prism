import { ConflictException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { NotificationOutboxChannel, NotificationOutboxWriter } from '@prism/contexts/platform-ops';

export type ConformeReminderMessage = {
  recipient: string;
  message: string;
  channel: Extract<NotificationOutboxChannel, 'email' | 'viber'>;
};

export type ClaimConformeReminderWindowInput = {
  inquiryId: string;
  conformeSentAt: Date;
  expectedLastReminderAt: Date | null;
  now: Date;
  messages: readonly ConformeReminderMessage[];
};

export type ClaimConformeReminderWindowStateInput = Omit<ClaimConformeReminderWindowInput, 'messages'>;

export function conformeReminderWindowKey(inquiryId: string, baseAt: Date) {
  return `conforme-follow-up:${inquiryId}:${baseAt.getTime()}`;
}

/**
 * Claim the same reminder window used by the scheduled sweep and the PMCM
 * draft approval path. Call inside the transaction that persists its decision.
 */
export async function claimConformeReminderWindow(
  tx: Prisma.TransactionClient,
  writer: NotificationOutboxWriter,
  input: ClaimConformeReminderWindowInput,
) {
  const claimed = await claimConformeReminderWindowState(tx, input);
  const context: PrismTransactionContext = { prisma: tx, correlationId: claimed.windowKey };
  for (const notification of input.messages) {
    await writer.write({
      recipient: notification.recipient,
      message: notification.message,
      channel: notification.channel,
      correlationId: claimed.windowKey,
      idempotencyKey: `${claimed.windowKey}:${notification.channel}`,
    }, context);
  }

  return claimed;
}

export async function claimConformeReminderWindowState(
  tx: Prisma.TransactionClient,
  input: ClaimConformeReminderWindowStateInput,
) {
  const claimed = await tx.opsInquiry.updateMany({
    where: {
      id: input.inquiryId,
      status: 'accepted',
      conformeSentAt: input.conformeSentAt,
      conformeSignedAt: null,
      lastConformeReminderAt: input.expectedLastReminderAt,
    },
    data: { lastConformeReminderAt: input.now },
  });
  if (claimed.count !== 1) {
    throw new ConflictException('The conforme reminder window changed; refresh before continuing');
  }

  const windowKey = conformeReminderWindowKey(input.inquiryId, input.expectedLastReminderAt ?? input.conformeSentAt);
  return {
    windowKey,
    inquiry: await tx.opsInquiry.findUniqueOrThrow({ where: { id: input.inquiryId } }),
  };
}
