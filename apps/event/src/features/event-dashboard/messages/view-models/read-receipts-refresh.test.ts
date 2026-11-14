/** @vitest-environment jsdom */
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChatThreads } from '@prism/ui/chat';

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('read receipt refresh for an open conversation', () => {
  it('refreshes only after a conversation is shown and stops when the reader returns to the list', async () => {
    vi.useFakeTimers();
    const readReceipts = vi.fn(async (threadId: string) => [{ actorId: 'ana', name: 'Ana', lastReadAt: threadId === 'one' ? '2026-11-13T01:00:00Z' : null }]);
    const source = { list: async () => ['one', 'two'].map((id) => ({ id, subject: id, createdAt: '', updatedAt: '', participants: [{ actorId: 'ana', actorRole: 'client', name: 'Ana', active: true }], messages: [] })), markRead: vi.fn(async () => undefined), readReceipts, send: vi.fn(), older: vi.fn() };
    const { result } = renderHook(() => useChatThreads({ scope: 'inbox', source, viewerId: 'pmcm' }));
    await act(async () => {});
    expect(readReceipts).not.toHaveBeenCalled();
    await act(async () => result.current.workspace.onThreadShown('one'));
    expect(result.current.threads.find((thread) => thread.id === 'one')?.participants[0].lastReadAt).toBe('2026-11-13T01:00:00Z');
    await act(async () => vi.advanceTimersByTimeAsync(15_000));
    expect(readReceipts).toHaveBeenCalledTimes(2);
    await act(async () => result.current.workspace.onThreadHidden());
    await act(async () => vi.advanceTimersByTimeAsync(30_000));
    expect(readReceipts).toHaveBeenCalledTimes(2);
  });

  it('drops a receipt response from the prior event scope', async () => {
    const resolve: Array<(rows: Array<{ actorId: string; lastReadAt: string | null }>) => void> = [];
    const source = { list: async () => [{ id: 'thread', subject: 'Setup', createdAt: '', updatedAt: '', participants: [{ actorId: 'ana', actorRole: 'client', active: true }], messages: [] }],
      markRead: vi.fn(async () => undefined), send: vi.fn(), older: vi.fn(), readReceipts: vi.fn(() => new Promise<Array<{ actorId: string; lastReadAt: string | null }>>((done) => resolve.push(done))) };
    const view = renderHook(({ scope }) => useChatThreads({ scope, source, viewerId: 'pmcm' }), { initialProps: { scope: 'event-a' } });
    await act(async () => {});
    await act(async () => view.result.current.workspace.onThreadShown('thread'));
    view.rerender({ scope: 'event-b' });
    await act(async () => {});
    await act(async () => resolve[0]([{ actorId: 'ana', lastReadAt: '2026-11-13T01:00:00Z' }]));
    expect(view.result.current.threads[0].participants[0].lastReadAt).toBeUndefined();
    await act(async () => resolve[1]([{ actorId: 'ana', lastReadAt: null }]));
    expect(view.result.current.threads[0].participants[0].lastReadAt).toBeNull();
  });
});
