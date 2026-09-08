"use client";
import { useEffect, useRef, useState } from 'react';
import type { PrismCommunicationThread } from '@prism/types';
import { useClientWorkspace } from '../../workspace/shared';
import { clientMessagesRepository } from '../data/client-messages-repository';

export function useClientMessagesViewModel() {
  const { selectedEvent, session } = useClientWorkspace();
  const [threads, setThreads] = useState<PrismCommunicationThread[]>([]);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pendingKey = useRef<string | null>(null);
  useEffect(() => {
    if (!selectedEvent?.id) { setThreads([]); return; }
    void clientMessagesRepository.list(selectedEvent.id).then(setThreads).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load messages'));
  }, [selectedEvent?.id]);
  const activeThread = threads[0];
  useEffect(() => { if (activeThread) void clientMessagesRepository.markRead(activeThread.id); }, [activeThread?.id]);
  function updateDraft(value: string) { setDraft(value); if (value.trim() && !pendingKey.current) pendingKey.current = crypto.randomUUID(); }
  async function sendMessage() {
    if (!activeThread || !draft.trim() || busy) return;
    const key = pendingKey.current ?? crypto.randomUUID(); pendingKey.current = key; setBusy(true); setError(null);
    try {
      const message = await clientMessagesRepository.send(activeThread.id, draft.trim(), key);
      setThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, messages: [...thread.messages, message], unreadCount: 0 } : thread));
      setDraft('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send message'); }
    finally { pendingKey.current = null; setBusy(false); }
  }
  async function loadOlder() {
    if (!activeThread?.messagesNextCursor) return;
    try { const page = await clientMessagesRepository.listOlder(activeThread.id, activeThread.messagesNextCursor); setThreads((current) => current.map((thread) => thread.id === activeThread.id ? { ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor } : thread)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load older messages'); }
  }
  return { selectedEvent, session, activeThread, draft, updateDraft, sendMessage, loadOlder, busy, error };
}
