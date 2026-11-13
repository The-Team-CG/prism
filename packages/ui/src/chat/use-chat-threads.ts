"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { linkedConversationId } from "../portal-path";
import type { PrismCommunicationReadReceipt } from "@prism/types";
import { useConversationReadReceipts } from "./use-conversation-read-receipts";
import { threadMatches, toChatThreads, type ChatMessageRecord, type ChatThread, type ChatThreadRecord } from "./chat-display";
import { mergeRefreshedThreads, type OpenConversation } from "./merge-refreshed-threads";
import { useVisibleRefresh } from "./use-visible-refresh";

export type ChatMessagePage = { items: ChatMessageRecord[]; nextCursor?: string | null };

/** Where a portal's conversations come from. The hook owns the state; the portal owns the requests. */
export type ChatSource = {
  list(): Promise<ChatThreadRecord[]>;
  /** Set when `list` returns only each conversation's latest message: loads the rest once it is on screen. */
  history?(threadId: string): Promise<ChatMessagePage>;
  older(threadId: string, cursor: string): Promise<ChatMessagePage>;
  send(threadId: string, body: string, idempotencyKey: string): Promise<ChatMessageRecord>;
  markRead(threadId: string): Promise<unknown>;
  readReceipts?(threadId: string): Promise<PrismCommunicationReadReceipt[]>;
};

type Loaded = { scope: string; status: "loading" | "ready" | "error"; threads: ChatThreadRecord[]; error?: string };
type ActionError = { scope: string; threadId: string; message: string };

const NO_THREADS: ChatThreadRecord[] = [];

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

/** Until the list has loaded for this scope, the viewer sees "loading"; with no scope there is nothing to load. */
function listStatus(scope: string | undefined, current: Loaded | null): Loaded["status"] | "idle" {
  if (!scope) return "idle";
  return current?.status ?? "loading";
}

/** A failed load is shown for the list; a failed action is shown only while its conversation is the open one. */
function visibleError(current: Loaded | null, actionError: ActionError | null, scope: string | undefined, activeId: string | undefined) {
  return current?.error ?? (actionError && actionError.scope === scope && actionError.threadId === activeId ? actionError.message : null);
}

/** A background refresh never shows loading or an error: it folds into a list that is already on screen. */
function refreshedLoaded(previous: Loaded | null, scope: string, listed: ChatThreadRecord[], open: OpenConversation): Loaded | null {
  if (!previous || previous.scope !== scope || previous.status === "loading") return previous;
  return { scope, status: "ready", threads: mergeRefreshedThreads(previous.threads, listed, open) };
}

/** The conversation named in the link, once it is in the list. */
function openedLinkId(linkedId: string | undefined, threads: ChatThread[]) {
  return linkedId && threads.some((thread) => thread.id === linkedId) ? linkedId : undefined;
}

/**
 * One list of conversations and the open one: loading, search, a draft per conversation, sending and paging.
 * `scope` names the list (an event, or the whole inbox); a response for a scope the viewer has left is dropped.
 */
export function useChatThreads({ scope, source, viewerId }: { scope: string | undefined; source: ChatSource; viewerId: string | undefined }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<{ scope: string; threadId: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [query, setQuery] = useState("");
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string>();
  // A notice link names one conversation in the URL fragment; it is the open one until the viewer picks another.
  const [linkedId, setLinkedId] = useState<string>();
  // A retry of the same text reuses its key, so a send that reached the server is not stored twice.
  const attempts = useRef(new Map<string, { text: string; key: string }>());
  const sending = useRef(false);
  const withHistory = useRef(new Set<string>());
  const latest = useRef(source);

  useEffect(() => {
    latest.current = source;
  });

  useEffect(() => {
    const read = () => setLinkedId(linkedConversationId(window.location.hash, window.location.search));
    read();
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    return () => { window.removeEventListener("hashchange", read); window.removeEventListener("popstate", read); };
  }, []);

  useEffect(() => {
    if (!scope) return;
    let active = true;
    withHistory.current = new Set();
    setLoaded({ scope, status: "loading", threads: [] });
    void latest.current
      .list()
      .then((threads) => {
        if (active) setLoaded({ scope, status: "ready", threads });
      })
      .catch((reason: unknown) => {
        if (active) setLoaded({ scope, status: "error", threads: [], error: errorText(reason, "Unable to load conversations") });
      });
    return () => {
      active = false;
    };
  }, [scope, reload]);

  const current = loaded?.scope === scope ? loaded : null;
  const records = current?.threads ?? NO_THREADS;
  const listedShownId = records.find((thread) => thread.id === shownId)?.id;
  const receipts = useConversationReadReceipts({ scope: `${scope}:${viewerId}`, threadId: listedShownId, load: source.readReceipts });
  const threads = useMemo(() => toChatThreads(records.map((thread) => thread.id === shownId && receipts ? {
    ...thread, participants: thread.participants.map((person) => ({ ...person, lastReadAt: receipts.find((receipt) => receipt.actorId === person.actorId)?.lastReadAt })),
  } : thread), viewerId), [records, viewerId, receipts, shownId]);
  const visibleThreads = threads.filter((thread) => threadMatches(thread, query));
  const selectedId = selected && selected.scope === scope ? selected.threadId : linkedId;
  // Like a phone's chat list, the most recent conversation is the open one until another is chosen.
  const active = threads.find((thread) => thread.id === selectedId) ?? threads[0];
  const draft = active ? drafts[active.id] ?? "" : "";
  const status = listStatus(scope, current);

  const updateThread = useCallback((forScope: string, threadId: string, update: (thread: ChatThreadRecord) => ChatThreadRecord) => {
    setLoaded((previous) => (previous?.scope === forScope ? { ...previous, threads: previous.threads.map((thread) => (thread.id === threadId ? update(thread) : thread)) } : previous));
  }, []);

  /** A conversation is on screen, so it counts as read. */
  const showThread = useCallback(
    (threadId: string) => {
      if (!scope) return;
      setShownId(threadId);
      void latest.current.markRead(threadId).catch(() => undefined);
      updateThread(scope, threadId, (thread) => (thread.unreadCount ? { ...thread, unreadCount: 0 } : thread));
    },
    [scope, updateThread],
  );

  // When the list carried only a preview, the conversation on screen fetches its history, again after each reload.
  const shownIsListed = current?.status === "ready" && records.some((thread) => thread.id === shownId);
  useEffect(() => {
    const history = latest.current.history;
    if (!scope || !shownId || !shownIsListed || !history || withHistory.current.has(shownId)) return;
    withHistory.current.add(shownId);
    setHistoryLoading(shownId);
    void history(shownId)
      .then((page) => {
        const fetched = new Set(page.items.map((message) => message.id));
        updateThread(scope, shownId, (thread) => ({
          ...thread,
          messages: [...page.items, ...thread.messages.filter((message) => !fetched.has(message.id))],
          messagesNextCursor: page.nextCursor ?? null,
        }));
      })
      .catch((reason: unknown) => {
        withHistory.current.delete(shownId);
        setActionError({ scope, threadId: shownId, message: errorText(reason, "Unable to load this conversation") });
      })
      .finally(() => setHistoryLoading((loading) => (loading === shownId ? null : loading)));
  }, [scope, shownId, shownIsListed, updateThread]);

  // Refreshes read the open conversation from a ref, so a refresh started before a switch still names the right one.
  const shownRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    shownRef.current = shownId;
  }, [shownId]);

  /** Fetches the list and, when the open conversation has its own history, its latest page; then folds both in. */
  const refreshConversations = async () => {
    if (!scope) return;
    const open = shownRef.current;
    const history = open ? latest.current.history : undefined;
    const [listed, page] = await Promise.all([latest.current.list(), open && history ? history(open).catch(() => null) : null]);
    setLoaded((previous) => refreshedLoaded(previous, scope, listed, { threadId: open, page }));
    if (open && listed.some((thread) => thread.id === open && (thread.unreadCount ?? 0) > 0)) void latest.current.markRead(open).catch(() => undefined);
  };
  useVisibleRefresh(refreshConversations, Boolean(scope));

  function openThread(threadId: string) {
    if (scope) setSelected({ scope, threadId });
  }

  function updateDraft(value: string) {
    if (active) setDrafts((all) => ({ ...all, [active.id]: value }));
  }

  async function send() {
    if (!scope || !active || !draft.trim() || sending.current) return;
    const threadId = active.id;
    const text = draft.trim();
    const attempt = attempts.current.get(threadId);
    const key = attempt?.text === text ? attempt.key : crypto.randomUUID();
    attempts.current.set(threadId, { text, key });
    sending.current = true;
    setBusy(true);
    setActionError(null);
    try {
      const message = await latest.current.send(threadId, text, key);
      updateThread(scope, threadId, (thread) => (thread.messages.some((item) => item.id === message.id) ? thread : { ...thread, messages: [...thread.messages, message], unreadCount: 0 }));
      setDrafts((all) => (all[threadId] === draft ? { ...all, [threadId]: "" } : all));
      attempts.current.delete(threadId);
    } catch (reason) {
      setActionError({ scope, threadId, message: errorText(reason, "Unable to send message") });
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function loadOlder() {
    if (!scope || !active?.messagesNextCursor) return;
    const threadId = active.id;
    try {
      const page = await latest.current.older(threadId, active.messagesNextCursor);
      updateThread(scope, threadId, (thread) => ({ ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor ?? null }));
    } catch (reason) {
      setActionError({ scope, threadId, message: errorText(reason, "Unable to load older messages") });
    }
  }

  /** A conversation the viewer just started: it joins the list and opens, with nothing more to fetch. */
  function addThread(thread: ChatThreadRecord) {
    if (!scope) return;
    withHistory.current.add(thread.id);
    setLoaded((previous) => (previous?.scope === scope ? { ...previous, threads: [thread, ...previous.threads] } : previous));
    setSelected({ scope, threadId: thread.id });
  }

  const retry = () => setReload((value) => value + 1);
  const error = visibleError(current, actionError, scope, active?.id);

  return {
    status,
    threads,
    active,
    addThread,
    send,
    /** Spread onto `ChatWorkspace`. */
    workspace: {
      threads,
      visibleThreads,
      viewerId,
      activeThreadId: active?.id,
      linkedThreadId: openedLinkId(linkedId, threads),
      onOpenThread: openThread,
      onThreadShown: showThread,
      onThreadHidden: () => setShownId(undefined),
      query,
      onQueryChange: setQuery,
      loading: status === "loading",
      historyLoading: Boolean(active) && historyLoading === active?.id,
      error,
      onRetry: retry,
      busy,
      draft,
      onDraftChange: updateDraft,
      onSend: () => void send(),
      onLoadOlder: () => void loadOlder(),
    },
  };
}
