import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '../../../../core/shared-kernel/src';
import { NotificationChannel } from '../ops.constants';
import { NotificationOutboxService } from '../services/notification-outbox.service';
import type { NotificationOutboxWriteInput, NotificationOutboxWriter } from './notification-outbox-writer.port';

@Injectable()
export class NotificationOutboxWriterAdapter implements NotificationOutboxWriter {
  constructor(private readonly notificationOutboxService: NotificationOutboxService) {}

  write(input: NotificationOutboxWriteInput, context?: PrismTransactionContext) {
    return this.notificationOutboxService.queue(
      input.eventId,
      input.recipient,
      input.message,
      input.channel ?? NotificationChannel.Email,
      {
        forceFail: input.forceFail,
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      },
      context,
    );
  }
}