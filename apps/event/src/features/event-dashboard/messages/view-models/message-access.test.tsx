/** @vitest-environment jsdom */
import { cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalQueryProvider } from '@prism/portal-query';
import { ChatWorkspace, type ChatThread } from '@prism/ui/chat';
import { useEventMessagesViewModel } from './use-event-messages-view-model';
import { coordinatorLocationRedirect, coordinatorViewFromParam } from '@/features/coordinators/desk/model/coordinator-portal-routes';

const repo = vi.hoisted(() => ({ inbox: vi.fn(async () => []), list: vi.fn(async () => []), participants: vi.fn(async () => []), readReceipts: vi.fn(async () => []), history: vi.fn(), listOlder: vi.fn(), markRead: vi.fn(), send: vi.fn(), create: vi.fn() }));
vi.mock('../data/event-messages-repository', () => ({ eventMessagesRepository: repo }));
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
});
