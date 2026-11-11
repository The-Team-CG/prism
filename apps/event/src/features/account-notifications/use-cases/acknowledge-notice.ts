import { acknowledgeNotificationReceiptSchema, parseContract, type PrismNotificationInboxItem } from '@prism/types';
import { notificationPreferencesRepository } from '../data/notification-preferences-repository';
export function acknowledgeNotice(notice: PrismNotificationInboxItem) {
  return notificationPreferencesRepository.acknowledgeReceipt(notice.id, parseContract(acknowledgeNotificationReceiptSchema, { version: notice.version }, 'Notification receipt'));
}

export function markNoticeRead(notice: PrismNotificationInboxItem) {
  return notificationPreferencesRepository.markNoticeRead(notice.id, parseContract(acknowledgeNotificationReceiptSchema, { version: notice.version }, 'Notification receipt'));
}
