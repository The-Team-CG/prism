import type { PrismTransactionContext } from '../../../../core/shared-kernel/src';
import type { NotificationOutboxChannel } from '../services/notification-outbox.service';

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