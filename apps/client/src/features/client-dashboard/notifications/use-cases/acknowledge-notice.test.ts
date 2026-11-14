import { describe, expect, it, vi } from 'vitest';
import type { PrismNotificationInboxItem } from '@prism/types';
import { acknowledgeNotice, markNoticeRead } from './acknowledge-notice';

const repository = vi.hoisted(() => ({ acknowledgeReceipt: vi.fn(), markNoticeRead: vi.fn() }));
vi.mock('../data/notification-preferences-repository', () => ({ notificationPreferencesRepository: repository }));
const notice: PrismNotificationInboxItem = { id: 'email', notificationId: 'n1', eventId: 'event', channel: 'email, viber', message: 'Review', version: 'a'.repeat(64), createdAt: '', readAt: null, acknowledgedAt: null,
  deliveries: [{ id: 'email', version: 'a'.repeat(64) }, { id: 'viber', version: 'b'.repeat(64) }] };

describe('receipt of a grouped notification', () => {
  it('reads and acknowledges both deliveries with their own reviewed versions', async () => {
    repository.markNoticeRead.mockImplementation(async (id: string) => ({ id, readAt: '2026-11-13T01:00:00Z' }));
    expect(await markNoticeRead(notice)).toMatchObject({ id: 'email', readAt: '2026-11-13T01:00:00Z' });
    await acknowledgeNotice(notice);
    for (const method of [repository.acknowledgeReceipt, repository.markNoticeRead]) {
      expect(method).toHaveBeenCalledWith('email', { version: 'a'.repeat(64) });
      expect(method).toHaveBeenCalledWith('viber', { version: 'b'.repeat(64) });
    }
  });

  it('reports a failed channel acknowledgment instead of marking the group complete', async () => {
    repository.acknowledgeReceipt.mockRejectedValueOnce(new Error('version changed'));
    await expect(acknowledgeNotice(notice)).rejects.toThrow('version changed');
  });
});
