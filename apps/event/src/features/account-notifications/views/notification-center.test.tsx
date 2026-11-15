/** @vitest-environment jsdom */
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismNotificationInbox, PrismNotificationInboxItem, PrismNotificationPreferences } from '@prism/types';
import { NotificationCenter, groupNoticesByDay, noticeDue, noticesNeedingYou } from '@prism/ui/notifications';

afterEach(() => { cleanup(); vi.useRealTimers(); });
// The center reads the clock for days and deadlines, so the date is fixed; timers stay real for the async waits.
beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-16T04:00:00.000Z')); });

const NOW = new Date('2026-11-16T04:00:00.000Z'); // noon in Manila
const TODAY = '2026-11-16';
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000).toISOString();
const hoursFromNow = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000).toISOString();

/** A notice version is a 64-character hex digest; this one is made from the id so a test can name it. */
const versionOf = (id: string) => Buffer.from(id).toString('hex').padEnd(64, '0');

function notice(id: string, over: Partial<PrismNotificationInboxItem> = {}): PrismNotificationInboxItem {
  return { id, notificationId: `n_${id}`, eventId: 'evt_1', eventName: 'Ayala Summit', channel: 'email', message: `Message ${id}`, version: versionOf(id), createdAt: hoursAgo(1), readAt: null, acknowledgedAt: null, ...over };
}

const preferences: PrismNotificationPreferences = { email: 'a@example.test', emailDelivery: 'captured', viberConfigured: true, viberLinked: false, viberEnabled: false, viberLinkedAt: null };

function actionsFor(inbox: PrismNotificationInbox) {
  return {
    inbox: vi.fn(async () => inbox),
    markNoticeRead: vi.fn(async (id: string) => ({ id, readAt: NOW.toISOString() })),
    acknowledgeReceipt: vi.fn(async (id: string) => ({ id, acknowledged: true as const })),
    markAllNoticesRead: vi.fn(async () => ({ marked: 2 })),
    mine: vi.fn(async () => preferences),
    setViberEnabled: vi.fn(),
    startViberLink: vi.fn(),
    unlinkViber: vi.fn(),
  };
}

describe('notice grouping', () => {
  it('splits notices into Philippine calendar days, naming today and yesterday', () => {
    const days = groupNoticesByDay([
      notice('a', { createdAt: '2026-11-16T03:00:00.000Z' }),
      notice('b', { createdAt: '2026-11-15T20:00:00.000Z' }), // 4am Nov 16 in Manila: still today
      notice('c', { createdAt: '2026-11-15T03:00:00.000Z' }),
      notice('d', { createdAt: '2026-11-10T03:00:00.000Z' }),
    ], TODAY);
    expect(days.map((day) => [day.label, day.notices.map((entry) => entry.id)])).toEqual([
      ['Today', ['a', 'b']], ['Yesterday', ['c']], ['Nov 10, 2026', ['d']],
    ]);
  });

  it('puts what is waiting on the reader in order of due date and words the deadline', () => {
    const late = notice('late', { acknowledgmentDueAt: hoursAgo(54) });
    const soon = notice('soon', { acknowledgmentDueAt: hoursFromNow(20) });
    const done = notice('done', { acknowledgmentDueAt: hoursAgo(50), acknowledgedAt: hoursAgo(49) });
    expect(noticesNeedingYou([soon, done, late]).map((entry) => entry.id)).toEqual(['late', 'soon']);
    expect(noticeDue(late, NOW, TODAY)).toEqual({ label: 'Overdue 2 days', overdue: true });
    expect(noticeDue(soon, NOW, TODAY)).toEqual({ label: 'Due tomorrow', overdue: false });
    expect(noticeDue(done, NOW, TODAY)).toBeNull();
  });
});

describe('the notification center', () => {
  it('lists unread notices by event, opens one as read, and keeps the unread count honest', async () => {
    const actions = actionsFor({ items: [notice('a'), notice('b', { readAt: hoursAgo(1), eventName: 'Cruz Gala' })], unread: 1, hasMore: false });
    const onChange = vi.fn();
    render(<NotificationCenter actions={actions} onChange={onChange} linkFor={() => null} />);

    expect(await screen.findByText('Message a')).toBeTruthy();
    expect(screen.getByText('1 unread')).toBeTruthy();
    expect(screen.getByText(/Ayala Summit/)).toBeTruthy();
    expect(screen.getByText(/Cruz Gala/)).toBeTruthy();
    expect(screen.getAllByRole('img', { name: 'Unread' })).toHaveLength(1);

    fireEvent.click(screen.getByText('Message a'));
    await waitFor(() => expect(actions.markNoticeRead).toHaveBeenCalledWith('a', { version: versionOf('a') }));
    expect(screen.queryByRole('img', { name: 'Unread' })).toBeNull();
    expect(screen.queryByText('1 unread')).toBeNull();
    await waitFor(() => expect(onChange).toHaveBeenCalled());
  });

  it('records a notice sent on two channels as read on each copy', async () => {
    const both = notice('a', { channel: 'email, viber', deliveries: [{ id: 'a_email', version: 'e'.repeat(64) }, { id: 'a_viber', version: 'f'.repeat(64) }] });
    const actions = actionsFor({ items: [both], unread: 1, hasMore: false });
    render(<NotificationCenter actions={actions} linkFor={() => null} />);
    fireEvent.click(await screen.findByText('Message a'));
    await waitFor(() => expect(actions.markNoticeRead).toHaveBeenCalledTimes(2));
    expect(actions.markNoticeRead).toHaveBeenCalledWith('a_email', { version: 'e'.repeat(64) });
    expect(actions.markNoticeRead).toHaveBeenCalledWith('a_viber', { version: 'f'.repeat(64) });
  });

  it('shows a notice that asks for acknowledgment first, with its deadline, and acknowledges it', async () => {
    const asked = notice('ask', { message: 'Confirm the schedule', acknowledgmentDueAt: hoursAgo(54) });
    const actions = actionsFor({ items: [notice('plain'), asked], unread: 2, hasMore: false });
    render(<NotificationCenter actions={actions} linkFor={() => null} />);

    const needsYou = (await screen.findByRole('heading', { name: /Needs you/ })).closest('section')!;
    expect(within(needsYou).getByText('Confirm the schedule')).toBeTruthy();
    expect(within(needsYou).getByText('Overdue 2 days')).toBeTruthy();
    expect(screen.getAllByText('Confirm the schedule')).toHaveLength(1);

    fireEvent.click(within(needsYou).getByRole('button', { name: 'Acknowledge receipt' }));
    await waitFor(() => expect(actions.acknowledgeReceipt).toHaveBeenCalledWith('ask', { version: versionOf('ask') }));
    await waitFor(() => expect(actions.inbox.mock.calls.length).toBeGreaterThan(1));
  });

  it('marks everything read at once and filters to what is unread', async () => {
    const actions = actionsFor({ items: [notice('a'), notice('b', { readAt: hoursAgo(1) })], unread: 1, hasMore: false });
    // After the call, the server reports everything read.
    actions.markAllNoticesRead.mockImplementation(async () => {
      actions.inbox.mockResolvedValue({ items: [notice('a', { readAt: hoursAgo(0) }), notice('b', { readAt: hoursAgo(1) })], unread: 0, hasMore: false });
      return { marked: 1 };
    });
    render(<NotificationCenter actions={actions} linkFor={() => null} />);
    await screen.findByText('Message a');

    fireEvent.click(screen.getByRole('button', { name: /^Unread/ }));
    expect(screen.queryByText('Message b')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mark all read' }));
    await waitFor(() => expect(actions.markAllNoticesRead).toHaveBeenCalledOnce());
    expect(await screen.findByText(/all caught up/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Mark all read' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('opens the notice at the page the portal chose, and asks for older notices when more exist', async () => {
    const actions = actionsFor({ items: [notice('a', { readAt: hoursAgo(1) })], unread: 0, hasMore: true });
    render(<NotificationCenter actions={actions} linkFor={() => ({ href: '/dashboard/events/evt_1/billing', label: 'Open billing' })} />);

    const link = await screen.findByRole('link', { name: 'Message a' });
    expect(link.getAttribute('href')).toBe('/dashboard/events/evt_1/billing');
    fireEvent.click(screen.getByRole('button', { name: 'Show older notifications' }));
    await waitFor(() => expect(actions.inbox).toHaveBeenLastCalledWith(60));
  });

  it('keeps channel settings in a side panel that the Viber link anchor opens', async () => {
    window.location.hash = '#viber-settings';
    const actions = actionsFor({ items: [], unread: 0, hasMore: false });
    render(<NotificationCenter actions={actions} linkFor={() => null} />);
    expect(await screen.findByText(/No notifications yet/)).toBeTruthy();
    expect(await screen.findByRole('dialog', { name: 'Notification settings' })).toBeTruthy();
    expect(await screen.findByText('Link your Viber account to get updates there too.')).toBeTruthy();
    window.location.hash = '';
  });
});
