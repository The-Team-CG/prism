/** @vitest-environment jsdom */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ChatWorkspace, useChatThreads, type ChatSource, type ChatThreadRecord } from '@prism/ui/chat';

/** A conversation as the PMCM messages pane shows it: the hook's state with the whole chat workspace, composer included. */
function ConversationHarness({ source }: { source: ChatSource }) {
  const chat = useChatThreads({ scope: 'evt-1', source, viewerId: 'pmcm' });
  return <ChatWorkspace ariaLabel="Messages" {...chat.workspace} />;
}

function openThread(id: string): ChatThreadRecord & { eventId: string } {
  return { id, subject: id, createdAt: '2026-11-14T10:00:00.000Z', updatedAt: '2026-11-14T10:00:00.000Z', participants: [], messages: [], status: 'open', eventId: 'evt-1' };
}

describe('attaching a file to a message', () => {
  afterEach(() => cleanup());

  it('keeps Send disabled while a file uploads, and enables it once the file is attached', async () => {
    let finishUpload: (attachmentId: string) => void = () => undefined;
    const uploadAttachment = vi.fn(() => new Promise<string>((resolve) => {
      finishUpload = resolve;
    }));
    const source = {
      list: vi.fn(async () => ({ items: [openThread('t1')], nextCursor: null, hasMore: false })),
      markRead: vi.fn(async () => undefined),
      send: vi.fn(),
      older: vi.fn(),
      uploadAttachment,
      copyAttachment: vi.fn(),
      storedFiles: vi.fn(async () => []),
    } as unknown as ChatSource;
    const file = new File(['%PDF-1.7'], 'contract.pdf', { type: 'application/pdf' });

    const { container } = render(<ConversationHarness source={source} />);
    const send = (await screen.findByRole('button', { name: 'Send message' })) as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(await screen.findByText('contract.pdf')).toBeTruthy();
    expect(screen.getByText('Uploading…')).toBeTruthy();
    expect(uploadAttachment).toHaveBeenCalledWith(expect.objectContaining({ id: 't1', eventId: 'evt-1' }), file);
    expect(send.disabled).toBe(true);

    await act(async () => finishUpload('obj-1'));
    await waitFor(() => expect(send.disabled).toBe(false));
    expect(screen.queryByText('Uploading…')).toBeNull();
  });
});
