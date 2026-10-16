import { Injectable } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { NotificationChannel } from '@prism/kernel/event-core';
import { NotificationOutboxService } from '../../application/notifications/notification-outbox.service';
import type {
  GuestPassDeliveryWriteInput,
  NotificationOutboxWriteInput,
  NotificationOutboxWriter,
} from '../../contracts/notifications/notification-outbox-writer.port';

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
        correlationId: input.correlationId,
        idempotencyKey: input.idempotencyKey,
      },
      context,
    );
  }

  writeGuestPassDelivery(input: GuestPassDeliveryWriteInput, context?: PrismTransactionContext) {
    return this.notificationOutboxService.writeGuestPassDelivery(input, context);
  }

  cancelGuestPassDelivery(notificationId: string, context?: PrismTransactionContext) {
    return this.notificationOutboxService.cancelGuestPassDelivery(notificationId, context);
  }
}
