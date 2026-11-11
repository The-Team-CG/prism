/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NotificationInbox } from './notification-inbox';
import { createElement } from 'react';

const { repository } = vi.hoisted(() => ({ repository: { inbox: vi.fn(), markNoticeRead: vi.fn(), acknowledgeReceipt: vi.fn() } }));
vi.mock('../data/notification-preferences-repository', () => ({ notificationPreferencesRepository: repository }));
afterEach(() => { cleanup(); vi.resetAllMocks(); });

describe('supplier notification inbox', () => {
  it('opens a versioned schedule notice, records reading separately, and acknowledges the exact displayed version', async () => {
    const notice = { id: 'delivery', notificationId: 'notice', eventId: 'event', channel: 'email', message: 'Review schedule revision 2', version: 'a'.repeat(64), createdAt: '2026-11-11T00:00:00.000Z', readAt: null, acknowledgedAt: null, action: { kind: 'supplier_schedule', requestId: 'booking', revision: 2 } };
    repository.inbox.mockResolvedValueOnce([notice]).mockResolvedValue([{ ...notice, readAt: '2026-11-11T01:00:00.000Z', acknowledgedAt: '2026-11-11T02:00:00.000Z' }]);
    repository.markNoticeRead.mockResolvedValue({ id: notice.id, readAt: '2026-11-11T01:00:00.000Z' });
    repository.acknowledgeReceipt.mockResolvedValue({ id: notice.id, acknowledged: true });
    render(createElement(NotificationInbox));
    const summary = await screen.findByText(notice.message, { selector: 'summary' });
    const details = summary.closest('details')!;
    details.open = true; fireEvent(details, new Event('toggle'));
    await waitFor(() => expect(repository.markNoticeRead).toHaveBeenCalledWith('delivery', { version: notice.version }));
    expect(repository.acknowledgeReceipt).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Review schedule revision 2' }).getAttribute('href')).toBe('/dashboard/bookings#supplier-work-booking');
    fireEvent.click(screen.getByRole('button', { name: 'Acknowledge receipt' }));
    await waitFor(() => expect(repository.acknowledgeReceipt).toHaveBeenCalledWith('delivery', { version: notice.version }));
    expect(await screen.findByText('Receipt acknowledged')).toBeTruthy();
  });
});
