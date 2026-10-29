"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PrismCommunicationParticipantChoice, PrismCommunicationThread, PrismEvent } from "@prism/types";
import type { EventSession } from "@/app/lib/session";
import { eventMessagesRepository } from "../data/event-messages-repository";
import { threadPreview, toChatThreads, type ChatThread } from "@prism/ui/chat";

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

export function useEventMessagesViewModel({ event, session }: { event: PrismEvent; session: EventSession }) {
  const [persistedThreads, setPersistedThreads] = useState<PrismCommunicationThread[]>([]);
  const [participants, setParticipants] = useState<PrismCommunicationParticipantChoice[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string>();
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState("");
  const [subject, setSubject] = useState("");
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pendingKey = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError(null);
    void eventMessagesRepository
      .list(event.id)
      .then((next) => {
        if (cancelled) return;
        setPersistedThreads(next);
        setActiveThreadId(undefined);
      })
      .catch((reason: unknown) => {
        if (!cancelled) setLoadError(errorText(reason, "Unable to load conversations"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    void eventMessagesRepository.participants(event.id).then(setParticipants).catch(() => setParticipants([]));
    return () => {
      cancelled = true;
    };
  }, [event.id]);

  const people = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants]);
  const threads: ChatThread[] = useMemo(() => toChatThreads(persistedThreads, session.id), [persistedThreads, session.id]);
  const needle = query.trim().toLowerCase();
  const visibleThreads = needle
    ? threads.filter((thread) => `${thread.subject} ${threadPreview(thread, people)}`.toLowerCase().includes(needle))
    : threads;
  const activeThread = composing ? undefined : threads.find((thread) => thread.id === activeThreadId) ?? threads[0];

  useEffect(() => {
    if (!activeThread?.id) return;
    void eventMessagesRepository.markRead(activeThread.id).catch(() => undefined);
    setPersistedThreads((current) => current.map((thread) => (thread.id === activeThread.id && thread.unreadCount ? { ...thread, unreadCount: 0 } : thread)));
  }, [activeThread?.id]);

  function openThread(id: string) {
    setComposing(false);
    setActiveThreadId(id);
  }

  function startNewConversation() {
    setComposing(true);
    setLoadError(null);
  }

  function toggleParticipant(id: string) {
    setSelectedParticipants((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  }

  function updateDraft(value: string) {
    setDraft(value);
    if (value.trim() && !pendingKey.current) pendingKey.current = crypto.randomUUID();
  }

  async function sendMessage() {
    if (!activeThread || !draft.trim() || busy) return;
    const key = pendingKey.current ?? crypto.randomUUID();
    pendingKey.current = key;
    setBusy(true);
    setLoadError(null);
    try {
      const message = await eventMessagesRepository.send(activeThread.id, draft.trim(), key);
      setPersistedThreads((current) =>
        current.map((thread) =>
          thread.id === activeThread.id ? { ...thread, messages: [...thread.messages, message], updatedAt: message.createdAt, unreadCount: 0 } : thread,
        ),
      );
      setDraft("");
    } catch (reason) {
      setLoadError(errorText(reason, "Unable to send message"));
    } finally {
      pendingKey.current = null;
      setBusy(false);
    }
  }

  async function createThread() {
    if (!subject.trim() || selectedParticipants.length === 0 || busy) return;
    setBusy(true);
    setLoadError(null);
    try {
      const thread = await eventMessagesRepository.create(event.id, subject.trim(), selectedParticipants);
      setPersistedThreads((current) => [thread, ...current]);
      setActiveThreadId(thread.id);
      setComposing(false);
      setSubject("");
      setSelectedParticipants([]);
    } catch (reason) {
      setLoadError(errorText(reason, "Unable to start conversation"));
    } finally {
      setBusy(false);
    }
  }

  async function loadOlder() {
    if (!activeThread?.messagesNextCursor) return;
    try {
      const page = await eventMessagesRepository.listOlder(activeThread.id, activeThread.messagesNextCursor);
      setPersistedThreads((current) =>
        current.map((thread) => (thread.id === activeThread.id ? { ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor } : thread)),
      );
    } catch (reason) {
      setLoadError(errorText(reason, "Unable to load older messages"));
    }
  }

  return {
    threads,
    visibleThreads,
    people,
    participants: participants.filter((participant) => participant.id !== session.id),
    viewerId: session.id,
    activeThread,
    openThread,
    composing,
    startNewConversation,
    cancelNewConversation: () => setComposing(false),
    query,
    setQuery,
    subject,
    setSubject,
    selectedParticipants,
    toggleParticipant,
    draft,
    updateDraft,
    sendMessage,
    createThread,
    loadOlder,
    loading,
    loadError,
    busy,
  };
}

export type EventMessagesViewModel = ReturnType<typeof useEventMessagesViewModel>;
