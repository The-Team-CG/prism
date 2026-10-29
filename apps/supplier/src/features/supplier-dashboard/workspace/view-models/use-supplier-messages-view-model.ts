"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PrismAuthenticatedSession, PrismCommunicationThread } from "@prism/types";
import { threadPreview, toChatThreads } from "@prism/ui/chat";
import { supplierMessagesRepository } from "../data/supplier-messages-repository";

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function useSupplierMessagesViewModel({ eventId, session }: { eventId?: string; session: PrismAuthenticatedSession }) {
  const [threads, setThreads] = useState<PrismCommunicationThread[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    if (!eventId) {
      setThreads([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void supplierMessagesRepository
      .list(eventId, session)
      .then((next) => {
        if (cancelled) return;
        setThreads(next);
        setActiveId(undefined);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setError(errorText(reason, "Unable to load messages"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId, session, reload]);

  const chatThreads = useMemo(() => toChatThreads(threads, session.id), [threads, session.id]);
  const needle = query.trim().toLowerCase();
  const visibleThreads = needle ? chatThreads.filter((thread) => `${thread.subject} ${threadPreview(thread, new Map())}`.toLowerCase().includes(needle)) : chatThreads;
  const active = threads.find((thread) => thread.id === (activeId ?? chatThreads[0]?.id));

  useEffect(() => {
    if (!active) return;
    void supplierMessagesRepository.markRead(active.id, session).catch(() => undefined);
    if (active.unreadCount) setThreads((current) => current.map((thread) => (thread.id === active.id ? { ...thread, unreadCount: 0 } : thread)));
  }, [active?.id, session]);

  function updateDraft(value: string) {
    setDraft(value);
    if (value.trim() && !pendingKey.current) pendingKey.current = crypto.randomUUID();
  }

  async function send() {
    if (!active || !draft.trim() || busy) return;
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setError(null);
    try {
      const message = await supplierMessagesRepository.send(active.id, draft.trim(), key, session);
      setThreads((current) => current.map((thread) => (thread.id === active.id ? { ...thread, messages: [...thread.messages, message], updatedAt: message.createdAt, unreadCount: 0 } : thread)));
      setDraft("");
    } catch (reason) {
      setError(errorText(reason, "Unable to send message"));
    } finally {
      pendingKey.current = null;
      setBusy(false);
    }
  }

  async function loadOlder() {
    if (!active?.messagesNextCursor) return;
    try {
      const page = await supplierMessagesRepository.listOlder(active.id, active.messagesNextCursor, session);
      setThreads((current) => current.map((thread) => (thread.id === active.id ? { ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor } : thread)));
    } catch (reason) {
      setError(errorText(reason, "Unable to load older messages"));
    }
  }

  return {
    threads,
    chatThreads,
    visibleThreads,
    query,
    setQuery,
    active,
    activeId,
    setActiveId,
    draft,
    updateDraft,
    send,
    loadOlder,
    loading,
    busy,
    error,
    retry: () => setReload((value) => value + 1),
  };
}
