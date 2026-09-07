export const NOTIFICATION_DELIVERY = Symbol('NOTIFICATION_DELIVERY');

export type NotificationDeliveryResult =
  | { status: 'accepted'; receipt: string }
  | { status: 'unconfigured' }
  | { status: 'retryable_failure' }
  | { status: 'permanent_failure' };

/** Adapters must use the stable notification ID as the provider idempotency key.
 * Accepted means the provider accepted delivery, not that a human read it.
 * No adapter is bound until the delivery provider and access are approved.
 */
export interface NotificationDeliveryPort {
  deliver(input: {
    idempotencyKey: string;
    channel: string;
    recipient: string;
    message: string;
  }): Promise<NotificationDeliveryResult>;
}
