"use client";

import { useEffect, useRef, useState } from "react";
import type { PrismCommunicationThread } from "@prism/types";
import { useClientWorkspace } from "../../workspace/shared";
import { clientMessagesRepository } from "../data/client-messages-repository";

type EventThreads = {
  eventId: string;
  status: "loading" | "ready" | "error";
  threads: PrismCommunicationThread[];
  error?: string;
};

export function useClientMessagesViewModel(enabled = true) {
  const { selectedEvent, session } = useClientWorkspace();
  const eventId = enabled ? selectedEvent?.id : undefined;
  const [eventThreads, setEventThreads] = useState<EventThreads | null>(null);
  const [selectedThreads, setSelectedThreads] = useState<Record<string, string>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<{ eventId: string; threadId: string; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const attempts = useRef(new Map<string, { text: string; key: string }>());
  const sending = useRef(false);

  useEffect(() => {
    if (!eventId) return;
    let active = true;
    setEventThreads({ eventId, status: "loading", threads: [] });
    void clientMessagesRepository.list(eventId)
      .then((threads) => { if (active) setEventThreads({ eventId, status: "ready", threads }); })
      .catch((reason: unknown) => {
        if (active) setEventThreads({ eventId, status: "error", threads: [], error: reason instanceof Error ? reason.message : "Unable to load messages" });
      });
    return () => { active = false; };
  }, [eventId, reload]);

  const current = eventThreads?.eventId === eventId ? eventThreads : null;
  const threads = current?.threads ?? [];
  const selectedThread = eventId ? threads.find((thread) => thread.id === selectedThreads[eventId]) : undefined;
  const activeThread = selectedThread ?? (threads.length === 1 ? threads[0] : undefined);
  const draft = activeThread ? drafts[activeThread.id] ?? "" : "";

  useEffect(() => {
    if (activeThread) void clientMessagesRepository.markRead(activeThread.id).catch(() => undefined);
  }, [activeThread?.id]);

  function updateDraft(value: string) {
    if (activeThread) setDrafts((currentDrafts) => ({ ...currentDrafts, [activeThread.id]: value }));
  }

  function updateThreads(forEventId: string, update: (thread: PrismCommunicationThread) => PrismCommunicationThread) {
    setEventThreads((previous) => previous?.eventId === forEventId
      ? { ...previous, threads: previous.threads.map(update) }
      : previous);
  }

  async function sendMessage() {
    if (!eventId || !activeThread || !draft.trim() || sending.current) return;
    const threadId = activeThread.id;
    const text = draft.trim();
    const attempt = attempts.current.get(threadId);
    const key = attempt?.text === text ? attempt.key : crypto.randomUUID();
    attempts.current.set(threadId, { text, key });
    sending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const message = await clientMessagesRepository.send(threadId, text, key);
      updateThreads(eventId, (thread) => thread.id === threadId && !thread.messages.some((item) => item.id === message.id) ? { ...thread, messages: [...thread.messages, message], unreadCount: 0 } : thread);
      setDrafts((currentDrafts) => currentDrafts[threadId] === draft ? { ...currentDrafts, [threadId]: "" } : currentDrafts);
      attempts.current.delete(threadId);
    } catch (reason) {
      setActionError({ eventId, threadId, message: reason instanceof Error ? reason.message : "Unable to send message" });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function loadOlder() {
    if (!eventId || !activeThread?.messagesNextCursor) return;
    const threadId = activeThread.id;
    try {
      const page = await clientMessagesRepository.listOlder(threadId, activeThread.messagesNextCursor);
      updateThreads(eventId, (thread) => thread.id === threadId ? { ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor } : thread);
    } catch (reason) {
      setActionError({ eventId, threadId, message: reason instanceof Error ? reason.message : "Unable to load older messages" });
    }
  }

  return {
    selectedEvent,
    session,
    threads,
    activeThread,
    selectThread: (threadId: string) => { if (eventId) setSelectedThreads((currentSelections) => ({ ...currentSelections, [eventId]: threadId })); },
    status: eventId ? current?.status ?? "loading" : "idle",
    error: current?.error ?? (actionError && actionError.eventId === eventId && actionError.threadId === activeThread?.id ? actionError.message : null),
    retry: () => setReload((value) => value + 1),
    draft,
    updateDraft,
    sendMessage,
    loadOlder,
    busy,
  };
}
