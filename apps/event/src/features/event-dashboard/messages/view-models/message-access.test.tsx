/** @vitest-environment jsdom */
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalQueryProvider } from '@prism/portal-query';
import { ChatWorkspace, type ChatThread } from '@prism/ui/chat';
import { useEventMessagesViewModel } from './use-event-messages-view-model';
import { EventMessagesWorkspace } from '../views/event-messages-workspace';
import { coordinatorLocationRedirect, coordinatorViewFromParam } from '@/features/coordinators/desk/model/coordinator-portal-routes';

const repo = vi.hoisted(() => ({ inbox: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })), list: vi.fn(async () => ({ items: [], nextCursor: null, hasMore: false })), thread: vi.fn(), participants: vi.fn(async () => []), readReceipts: vi.fn(async () => []), history: vi.fn(async () => ({ items: [], nextCursor: null })), listOlder: vi.fn(), markRead: vi.fn(async () => ({ lastReadAt: '' })), send: vi.fn(), create: vi.fn() }));
vi.mock('../data/event-messages-repository', () => ({ eventMessagesRepository: repo }));
vi.mock('@/features/account-notifications/data/notification-preferences-repository', () => ({ notificationPreferencesRepository: { mine: vi.fn(async () => ({ viberConfigured: false, viberLinked: false, viberEnabled: false })) } }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('coordinator Messages and private read receipts', () => {
  it('loads the coordinator inbox without offering creation, participant selection or private receipt polling', async () => {
    const session = { id: 'marco', name: 'Marco', role: 'coordinator' };
    const { result } = renderHook(() => useEventMessagesViewModel({ session: session as never }), { wrapper: ({ children }) => <PortalQueryProvider actorKey="marco">{children}</PortalQueryProvider> });
    await waitFor(() => expect(result.current.workspace.loading).toBe(false));
    expect(repo.inbox).toHaveBeenCalledOnce();
    expect(repo.participants).not.toHaveBeenCalled();
    expect(repo.readReceipts).not.toHaveBeenCalled();
    expect(result.current.compose).toBeUndefined();
    expect(result.current.canInspectReadReceipts).toBe(false);
    expect(coordinatorViewFromParam('messages')).toBe('messages');
    expect(coordinatorLocationRedirect({ pathname: '/dashboard/messages', search: '?conversation=thread' })).toEqual({ search: '?conversation=thread&view=messages' });
  });

  it('shows Seen only in the PMCM presentation, only for active readers whose time covers that message', async () => {
    const thread: ChatThread = { id: 'thread', subject: 'Load-in', createdAt: '', updatedAt: '', messages: [{ id: 'message', senderId: 'pmcm', senderRole: 'pmcm-admin', body: 'Ready?', createdAt: '2026-11-13T01:00:00Z', mine: true }], participants: [
      { actorId: 'pmcm', actorRole: 'pmcm-admin', active: true, name: 'Mys', lastReadAt: '2026-11-13T02:00:00Z' },
      { actorId: 'ana', actorRole: 'client', active: true, name: 'Ana', lastReadAt: '2026-11-13T01:00:00Z' },
      { actorId: 'bloom', actorRole: 'supplier', active: true, name: 'Bloom', lastReadAt: '2026-11-13T00:59:59Z' },
      { actorId: 'removed', actorRole: 'coordinator', active: false, name: 'Removed', lastReadAt: '2026-11-13T02:00:00Z' },
    ] };
    const props = { ariaLabel: 'Messages', threads: [thread], viewerId: 'pmcm', loading: false, busy: false, draft: '', onDraftChange: vi.fn(), onSend: vi.fn(), onLoadOlder: vi.fn(), onOpenThread: vi.fn() };
    const view = render(<ChatWorkspace {...props} showReadReceipts />);
    expect(await screen.findByText('Seen by Ana')).toBeTruthy();
    expect(screen.queryByText('Seen by Bloom')).toBeNull();
    expect(screen.queryByText('Seen by Mys')).toBeNull();
    expect(screen.queryByText('Seen by Removed')).toBeNull();
    view.rerender(<ChatWorkspace {...props} showReadReceipts={false} />);
    expect(screen.queryByText('Seen by Ana')).toBeNull();
    expect(screen.getByLabelText('Sent')).toBeTruthy();
  });

  it('shows a closed conversation as closed with no composer, and offers People and Reopen only to PMCM', async () => {
    const at = '2026-11-13T01:00:00Z';
    repo.inbox.mockResolvedValue({ nextCursor: null, hasMore: false, items: [{ id: 'thread', eventId: 'event', eventName: 'Founders gala', subject: 'Load-in', status: 'closed', createdBy: 'mys', createdAt: at, updatedAt: at, unreadCount: 0, lastMessage: { id: 'm1', senderId: 'ana', senderRole: 'client', body: 'Thanks', createdAt: at }, participants: [{ id: 'p1', actorId: 'pmcm', actorRole: 'pmcm-admin', active: true, name: 'Mys' }, { id: 'p2', actorId: 'ana', actorRole: 'client', active: true, name: 'Ana' }] }] } as never);
    const client = render(<PortalQueryProvider actorKey="ana"><EventMessagesWorkspace session={{ id: 'ana', name: 'Ana', role: 'client' } as never} /></PortalQueryProvider>);
    expect(await screen.findByText('PMCM closed this conversation.')).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
    expect(screen.queryByRole('button', { name: 'People' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reopen' })).toBeNull();
    client.unmount();
    render(<PortalQueryProvider actorKey="mys"><EventMessagesWorkspace session={{ id: 'mys', name: 'Mys', role: 'pmcm-admin' } as never} /></PortalQueryProvider>);
    expect(await screen.findByRole('button', { name: 'People' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reopen' })).toBeTruthy();
    expect(screen.queryByLabelText('Message')).toBeNull();
  });
});
