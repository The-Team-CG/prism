import { acknowledgeNotificationReceiptSchema, parseContract, type PrismNotificationInboxItem } from '@prism/types';
import { notificationPreferencesRepository } from '../data/notification-preferences-repository';
export function acknowledgeNotice(notice: PrismNotificationInboxItem) {
  return Promise.all((notice.deliveries ?? [notice]).map((delivery) => notificationPreferencesRepository.acknowledgeReceipt(delivery.id, parseContract(acknowledgeNotificationReceiptSchema, { version: delivery.version }, 'Notification receipt'))));
}

export async function markNoticeRead(notice: PrismNotificationInboxItem) {
  const saved = await Promise.all((notice.deliveries ?? [notice]).map((delivery) => notificationPreferencesRepository.markNoticeRead(delivery.id, parseContract(acknowledgeNotificationReceiptSchema, { version: delivery.version }, 'Notification receipt'))));
  return { id: notice.id, readAt: saved.map((row) => row.readAt).sort().at(-1)! };
}
