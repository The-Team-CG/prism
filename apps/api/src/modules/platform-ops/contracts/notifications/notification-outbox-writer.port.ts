import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';

export type NotificationOutboxChannel = 'email' | 'viber' | 'zoom' | 'canva' | 'storage' | 'ai';

export interface NotificationOutboxWriteInput {
  eventId?: string;
  recipient: string;
  message: string;
  channel?: NotificationOutboxChannel;
  forceFail?: boolean;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface NotificationOutboxWriter {
  write(input: NotificationOutboxWriteInput, context?: PrismTransactionContext): Promise<unknown>;
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
