/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversationList, useChatThreads, type ChatSource, type ChatThreadListRequest, type ChatThreadRecord } from '@prism/ui/chat';

function thread(id: string, updatedAt: string): ChatThreadRecord {
  return { id, subject: id, createdAt: updatedAt, updatedAt, participants: [], messages: [], status: 'open' };
}

/** The inbox list as a portal renders it: the hook's state with its paging controls on the list. */
function InboxList({ source }: { source: ChatSource }) {
  const chat = useChatThreads({ scope: 'inbox', source, viewerId: 'pmcm' });
  return (
    <ConversationList
      threads={chat.threads}
      loading={chat.workspace.loading}
      onOpen={() => undefined}
      statusTab={chat.workspace.statusTab}
      onStatusTabChange={chat.workspace.onStatusTabChange}
      hasMore={chat.workspace.hasMore}
      loadingMore={chat.workspace.loadingMore}
      onLoadMore={chat.workspace.onLoadMore}
    />
  );
}

describe('paging the conversation list', () => {
  afterEach(() => cleanup());

  it('shows the next page on request, and a refresh of the first page keeps it on screen', async () => {
    const firstPage = { items: [thread('t1', '2026-11-14T10:00:00.000Z'), thread('t2', '2026-11-14T09:00:00.000Z')], nextCursor: 'cursor-2', hasMore: true };
    const secondPage = { items: [thread('t3', '2026-11-14T08:00:00.000Z')], nextCursor: null, hasMore: false };
    const list = vi.fn(async (request: ChatThreadListRequest) => (request.cursor ? secondPage : firstPage));
    const source = { list, markRead: vi.fn(async () => undefined), send: vi.fn(), older: vi.fn() } as unknown as ChatSource;

    render(<InboxList source={source} />);
    expect(await screen.findByText('t1')).toBeTruthy();
    expect(screen.queryByText('t3')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByText('t3')).toBeTruthy();
    expect(list).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'cursor-2', status: 'open' }));

    // The 15-second refresh (here: the window regaining focus) fetches the first page only, and the page below stays.
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
    });
    await waitFor(() => expect(list).toHaveBeenCalledTimes(3));
    expect(list.mock.lastCall?.[0].cursor).toBeUndefined();
    expect(screen.getByText('t3')).toBeTruthy();
    expect(screen.getAllByText('t1')).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });
});
