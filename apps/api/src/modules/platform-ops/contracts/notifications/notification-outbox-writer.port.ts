import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { NotificationAction, NotificationEventSection } from '@prism/types';

/** The link a notice carries into one area of an event, in each reader's own portal. */
export function eventSectionAction(eventId: string, section: NotificationEventSection): NotificationAction {
  return { kind: 'event_section', eventId, section };
}

export type NotificationOutboxChannel = 'email' | 'viber' | 'zoom' | 'canva' | 'storage' | 'ai';

export interface NotificationOutboxWriteInput {
  eventId?: string;
  recipient: string;
  message: string;
  channel?: NotificationOutboxChannel;
  correlationId?: string;
  idempotencyKey?: string;
  action?: NotificationAction;
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
