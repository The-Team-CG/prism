import { createHash } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { NotificationDeliveryPort, NotificationDeliveryResult } from '../../contracts/notifications/notification-delivery.port';

@Injectable()
export class CaptureNotificationDeliveryAdapter implements NotificationDeliveryPort {
  readonly deliveryMode = 'capture' as const;

  async deliver(input: {
    idempotencyKey: string;
    channel: string;
    recipient: string;
    message: string;
  }): Promise<NotificationDeliveryResult> {
    const receiptHash = createHash('sha256').update(input.idempotencyKey).digest('hex').slice(0, 16);
    return { status: 'captured', receipt: `capture_${receiptHash}` };
  }
}
