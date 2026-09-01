import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { NotificationOutboxChannel } from '../../application/notifications/notification-outbox.service';

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
