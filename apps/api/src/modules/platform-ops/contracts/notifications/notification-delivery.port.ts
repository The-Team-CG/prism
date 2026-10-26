export const NOTIFICATION_DELIVERY = Symbol('NOTIFICATION_DELIVERY');

/** A failure reason is stored on the outbox row, so it must not carry credentials or message bodies. */
export type NotificationDeliveryResult =
  | { status: 'accepted'; receipt: string }
  | { status: 'retryable_failure'; reason?: string }
  | { status: 'permanent_failure'; reason: string };

/** Adapters must use the stable notification ID as the provider idempotency key.
 * Accepted means the provider accepted delivery, not that a human read it.
 * The platform-ops module always binds one adapter, so queued rows are always delivered or failed with a reason.
 * The worker times out after 30 seconds; adapters must also bound/cancel their
 * transport request. An uncertain timeout may be retried with the same key.
 * `eventId` is the outbox row's event reference, if any; adapters use it to resolve role recipients.
 */
export interface NotificationDeliveryPort {
  deliver(input: {
    idempotencyKey: string;
    channel: string;
    eventId: string | null;
    recipient: string;
    message: string;
  }): Promise<NotificationDeliveryResult>;
}
