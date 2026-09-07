"use client";
import { useEffect, useRef, useState } from 'react';
import type { PrismAuthenticatedSession, PrismCommunicationThread } from '@prism/types';
import { supplierMessagesRepository } from '../data/supplier-messages-repository';

export function useSupplierMessagesViewModel({ eventId, session }: { eventId?: string; session: PrismAuthenticatedSession }) {
  const [threads, setThreads] = useState<PrismCommunicationThread[]>([]); const [activeId, setActiveId] = useState<string>(); const [draft, setDraft] = useState(''); const [error, setError] = useState<string | null>(null); const [busy, setBusy] = useState(false); const pendingKey = useRef<string | null>(null);
  useEffect(() => { if (!eventId) { setThreads([]); return; } void supplierMessagesRepository.list(eventId, session).then((next) => { setThreads(next); setActiveId(next[0]?.id); }).catch((reason: unknown) => setError(reason instanceof Error ? reason.message : 'Unable to load messages')); }, [eventId, session]);
  const active = threads.find((thread) => thread.id === activeId);
  useEffect(() => { if (active) void supplierMessagesRepository.markRead(active.id, session); }, [active?.id, session]);
  function updateDraft(value: string) { setDraft(value); if (value.trim() && !pendingKey.current) pendingKey.current = crypto.randomUUID(); }
  async function send() { if (!active || !draft.trim() || busy) return; const key = pendingKey.current ?? crypto.randomUUID(); pendingKey.current = key; setBusy(true); setError(null); try { const message = await supplierMessagesRepository.send(active.id, draft.trim(), key, session); setThreads((current) => current.map((thread) => thread.id === active.id ? { ...thread, messages: [...thread.messages, message], unreadCount: 0 } : thread)); setDraft(''); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to send message'); } finally { pendingKey.current = null; setBusy(false); } }
  async function loadOlder() { if (!active?.messagesNextCursor) return; try { const page = await supplierMessagesRepository.listOlder(active.id, active.messagesNextCursor, session); setThreads((current) => current.map((thread) => thread.id === active.id ? { ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor } : thread)); } catch (reason) { setError(reason instanceof Error ? reason.message : 'Unable to load older messages'); } }
  return { threads, active, activeId, setActiveId, draft, updateDraft, send, loadOlder, busy, error };
}
