import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type NotificationOutboxChannel = 'email' | 'viber' | 'zoom' | 'canva' | 'storage' | 'ai';

export interface NotificationOutboxWriteInput {
  eventId?: string;
  recipient: string;
  message: string;
  channel?: NotificationOutboxChannel;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface GuestPassDeliveryWriteInput {
  eventId: string;
  passId: string;
  recipient: string;
  plaintextMessage: string;
  idempotencyKey: string;
}

export interface NotificationOutboxWriter {
  write(input: NotificationOutboxWriteInput, context?: PrismTransactionContext): Promise<unknown>;
  writeGuestPassDelivery(
    input: GuestPassDeliveryWriteInput,
    context?: PrismTransactionContext,
  ): Promise<{ notificationId: string; status: 'queued' }>;
  retryGuestPassDelivery(notificationId: string, context?: PrismTransactionContext): Promise<void>;
  cancelGuestPassDelivery(notificationId: string, context?: PrismTransactionContext): Promise<void>;
}

export type NotificationOutboxWriteOptions = Omit<NotificationOutboxWriteInput, 'eventId' | 'recipient' | 'message' | 'channel'>;

/** Preserve the readable application-level outbox call shape at the port. */
export function writeNotification(
  writer: NotificationOutboxWriter,
  eventId: string | undefined,
  recipient: string,
  message: string,
  channel?: NotificationOutboxChannel,
  options: NotificationOutboxWriteOptions = {},
  context?: PrismTransactionContext,
) {
  return writer.write({ eventId, recipient, message, channel, ...options }, context);
}
