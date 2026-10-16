import type { NotificationDeliveryPort } from '../../contracts/notifications/notification-delivery.port';

export function resolveGuestPassNotificationDelivery(
  demoEnabled: unknown,
  captureAdapter?: NotificationDeliveryPort,
): NotificationDeliveryPort | undefined {
  if (typeof demoEnabled !== 'string' || demoEnabled.trim().toLowerCase() !== 'true') return undefined;
  if (!captureAdapter || captureAdapter.deliveryMode !== 'capture') {
    throw new Error('Guest QR demo requires a capture-only notification adapter');
  }
  return captureAdapter;
}
