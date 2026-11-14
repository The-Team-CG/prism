"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { linkedConversationId } from "../portal-path";
import type { PrismCommunicationReadReceipt } from "@prism/types";
import { useConversationReadReceipts } from "./use-conversation-read-receipts";
import { toChatThreads, type ChatMessageRecord, type ChatThread, type ChatThreadRecord } from "./chat-display";
import { addNewMessages, mergeRefreshedThreads, type OpenConversation } from "./merge-refreshed-threads";
import type { ThreadStatusTab } from "./conversation-list";
import { useVisibleRefresh } from "./use-visible-refresh";

export type ChatMessagePage = { items: ChatMessageRecord[]; nextCursor?: string | null };
/** One page of conversations: the server sorts them, filters them by status and search, and says whether more follow. */
export type ChatThreadPage = { items: ChatThreadRecord[]; nextCursor: string | null; hasMore: boolean };
export type ChatThreadListRequest = { cursor?: string; q?: string; status: ThreadStatusTab };

/** Where a portal's conversations come from. The hook owns the state; the portal owns the requests. */
export type ChatSource = {
  list(request: ChatThreadListRequest): Promise<ChatThreadPage>;
  /** One conversation by id, for a link that names a conversation outside the first page. */
  thread?(threadId: string): Promise<ChatThreadRecord>;
  /** Set when `list` returns only each conversation's latest message: loads the rest once it is on screen. */
  history?(threadId: string): Promise<ChatMessagePage>;
  older(threadId: string, cursor: string): Promise<ChatMessagePage>;
  send(threadId: string, body: string, idempotencyKey: string): Promise<ChatMessageRecord>;
  markRead(threadId: string): Promise<unknown>;
  readReceipts?(threadId: string): Promise<PrismCommunicationReadReceipt[]>;
};

/** The loaded list. `key` names the list (scope, status and search); a response for another key is dropped. */
type Loaded = { key: string; status: "loading" | "ready" | "error"; threads: ChatThreadRecord[]; nextCursor: string | null; hasMore: boolean; loadingMore?: boolean; error?: string };
type ActionError = { scope: string; threadId: string; message: string };

const NO_THREADS: ChatThreadRecord[] = [];
const SEARCH_DEBOUNCE_MS = 300;

function errorText(reason: unknown, fallback: string) {
  return reason instanceof Error ? reason.message : fallback;
}

function listKeyOf(scope: string | undefined, status: ThreadStatusTab, q: string) {
  return scope ? JSON.stringify([scope, status, q]) : undefined;
}

/** Until the list has loaded for this key, the viewer sees "loading"; with no scope there is nothing to load. */
function listStatus(key: string | undefined, current: Loaded | null): Loaded["status"] | "idle" {
  if (!key) return "idle";
  return current?.status ?? "loading";
}

/** A failed load is shown for the list; a failed action is shown only while its conversation is the open one. */
function visibleError(current: Loaded | null, actionError: ActionError | null, scope: string | undefined, activeId: string | undefined) {
  return current?.error ?? (actionError && actionError.scope === scope && actionError.threadId === activeId ? actionError.message : null);
}

/** A background refresh never shows loading or an error: it folds into a list that is already on screen. */
function refreshedLoaded(previous: Loaded | null, key: string, listed: ChatThreadRecord[], open: OpenConversation): Loaded | null {
  if (!previous || previous.key !== key || previous.status === "loading") return previous;
  return { ...previous, status: "ready", threads: mergeRefreshedThreads(previous.threads, listed, open) };
}

/** Appends a further page, skipping any conversation already on screen. */
function appendThreads(shown: ChatThreadRecord[], incoming: ChatThreadRecord[]) {
  const known = new Set(shown.map((thread) => thread.id));
  return [...shown, ...incoming.filter((thread) => !known.has(thread.id))];
}

/** The conversation named in the link, once it is in the list. */
function openedLinkId(linkedId: string | undefined, threads: ChatThread[]) {
  return linkedId && threads.some((thread) => thread.id === linkedId) ? linkedId : undefined;
}

/** The open conversation's latest page, when its history can be fetched on its own. */
function openHistoryPage(history: ChatSource["history"], open: string | undefined) {
  return open && history ? history(open).catch(() => null) : null;
}

/** Once a refresh lists the open conversation it no longer needs the "started here" guard, and an unread arrival in it is read. */
function settleOpened(open: string | undefined, listed: ChatThreadRecord[], started: Set<string>, markRead: ChatSource["markRead"]) {
  if (!open || !listed.some((thread) => thread.id === open)) return;
  started.delete(open);
  if (listed.some((thread) => thread.id === open && (thread.unreadCount ?? 0) > 0)) void markRead(open).catch(() => undefined);
}

/** Waits for the search text to settle, so a keystroke burst costs one request. */
function useSettledSearch(search: string) {
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);
  return settled;
}

/**
 * One list of conversations and the open one: loading, paging, server search, Open / Closed, a draft per conversation,
 * sending and history paging. `scope` names the list (an event, or the whole inbox); a response for a list the viewer
 * has left is dropped.
 */
export function useChatThreads({ scope, source, viewerId }: { scope: string | undefined; source: ChatSource; viewerId: string | undefined }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [selected, setSelected] = useState<{ scope: string; threadId: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<ActionError | null>(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [tab, setTab] = useState<ThreadStatusTab>("open");
  const [search, setSearch] = useState("");
  const [historyLoading, setHistoryLoading] = useState<string | null>(null);
  const [shownId, setShownId] = useState<string>();
  // A notice link names one conversation in the URL fragment; it is the open one until the viewer picks another.
  const [linkedId, setLinkedId] = useState<string>();
  // A retry of the same text reuses its key, so a send that reached the server is not stored twice.
  const attempts = useRef(new Map<string, { text: string; key: string }>());
  const sending = useRef(false);
  const withHistory = useRef(new Set<string>());
  // Conversations this viewer started here, which a refresh fetched before their creation can omit.
  const startedHere = useRef(new Set<string>());
  const latest = useRef(source);
  const q = useSettledSearch(search);
  const listKey = listKeyOf(scope, tab, q);

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
    if (!listKey) return;
    let active = true;
    withHistory.current = new Set();
    setLoaded({ key: listKey, status: "loading", threads: [], nextCursor: null, hasMore: false });
    void latest.current
      .list({ status: tab, q: q || undefined })
      .then((page) => {
        if (active) setLoaded({ key: listKey, status: "ready", threads: page.items, nextCursor: page.nextCursor, hasMore: page.hasMore });
      })
      .catch((reason: unknown) => {
        if (active) setLoaded({ key: listKey, status: "error", threads: [], nextCursor: null, hasMore: false, error: errorText(reason, "Unable to load conversations") });
      });
    return () => {
      active = false;
    };
  }, [listKey, reload]);

  const current = loaded?.key === listKey ? loaded : null;
  const records = current?.threads ?? NO_THREADS;
  const listedShownId = records.find((thread) => thread.id === shownId)?.id;
  const receipts = useConversationReadReceipts({ scope: `${scope}:${viewerId}`, threadId: listedShownId, load: source.readReceipts });
  const threads = useMemo(() => toChatThreads(records.map((thread) => thread.id === shownId && receipts ? {
    ...thread, participants: thread.participants.map((person) => ({ ...person, lastReadAt: receipts.find((receipt) => receipt.actorId === person.actorId)?.lastReadAt })),
  } : thread), viewerId), [records, viewerId, receipts, shownId]);
  const selectedId = selected && selected.scope === scope ? selected.threadId : linkedId;
  // Like a phone's chat list, the most recent conversation is the open one until another is chosen.
  const active = threads.find((thread) => thread.id === selectedId) ?? threads[0];
  const draft = active ? drafts[active.id] ?? "" : "";
  const status = listStatus(listKey, current);

  const updateThread = useCallback((forKey: string, threadId: string, update: (thread: ChatThreadRecord) => ChatThreadRecord) => {
    setLoaded((previous) => (previous?.key === forKey ? { ...previous, threads: previous.threads.map((thread) => (thread.id === threadId ? update(thread) : thread)) } : previous));
  }, []);

  /** A conversation is on screen, so it counts as read. */
  const showThread = useCallback(
    (threadId: string) => {
      if (!scope || !listKey) return;
      setShownId(threadId);
      void latest.current.markRead(threadId).catch(() => undefined);
      updateThread(listKey, threadId, (thread) => (thread.unreadCount ? { ...thread, unreadCount: 0 } : thread));
    },
    [scope, listKey, updateThread],
  );

  // When the list carried only a preview, the conversation on screen fetches its history, again after each reload.
  const shownIsListed = current?.status === "ready" && records.some((thread) => thread.id === shownId);
  useEffect(() => {
    const history = latest.current.history;
    if (!listKey || !shownId || !shownIsListed || !history || withHistory.current.has(shownId)) return;
    withHistory.current.add(shownId);
    setHistoryLoading(shownId);
    void history(shownId)
      .then((page) => {
        const fetched = new Set(page.items.map((message) => message.id));
        updateThread(listKey, shownId, (thread) => ({
          ...thread,
          messages: [...page.items, ...thread.messages.filter((message) => !fetched.has(message.id))],
          messagesNextCursor: page.nextCursor ?? null,
        }));
      })
      .catch((reason: unknown) => {
        withHistory.current.delete(shownId);
        if (scope) setActionError({ scope, threadId: shownId, message: errorText(reason, "Unable to load this conversation") });
      })
      .finally(() => setHistoryLoading((loading) => (loading === shownId ? null : loading)));
  }, [scope, listKey, shownId, shownIsListed, updateThread]);

  // A link can name a conversation beyond the loaded pages: that one is fetched and added, so it still opens.
  const linkMissing = Boolean(listKey && linkedId && current?.status === "ready" && !records.some((thread) => thread.id === linkedId));
  useEffect(() => {
    const fetchThread = latest.current.thread;
    if (!listKey || !linkedId || !linkMissing || !fetchThread) return;
    let active = true;
    void fetchThread(linkedId)
      .then((fresh) => {
        if (active) setLoaded((previous) => (previous?.key === listKey && !previous.threads.some((thread) => thread.id === fresh.id) ? { ...previous, threads: [...previous.threads, fresh] } : previous));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [listKey, linkedId, linkMissing]);

  // Refreshes read the open conversation from a ref, so a refresh started before a switch still names the right one.
  const shownRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    shownRef.current = shownId;
  }, [shownId]);

  /** Fetches the first page of the current list and, when the open conversation has its own history, its latest page; then folds both in. */
  const refreshConversations = async () => {
    if (!scope || !listKey) return;
    const open = shownRef.current;
    const [page, openPage] = await Promise.all([latest.current.list({ status: tab, q: q || undefined }), openHistoryPage(latest.current.history, open)]);
    setLoaded((previous) => refreshedLoaded(previous, listKey, page.items, { threadId: open, page: openPage, started: startedHere.current.has(open ?? "") }));
    settleOpened(open, page.items, startedHere.current, latest.current.markRead);
  };
  useVisibleRefresh(refreshConversations, Boolean(scope));

  /** Appends the next page of the list, when the server says there is one. */
  async function loadMore() {
    if (!listKey || !current || current.status !== "ready" || !current.hasMore || !current.nextCursor || current.loadingMore) return;
    const key = listKey;
    setLoaded((previous) => (previous?.key === key ? { ...previous, loadingMore: true } : previous));
    try {
      const page = await latest.current.list({ cursor: current.nextCursor, status: tab, q: q || undefined });
      setLoaded((previous) => (previous?.key === key ? { ...previous, loadingMore: false, threads: appendThreads(previous.threads, page.items), nextCursor: page.nextCursor, hasMore: page.hasMore } : previous));
    } catch {
      setLoaded((previous) => (previous?.key === key ? { ...previous, loadingMore: false } : previous));
    }
  }

  function openThread(threadId: string) {
    if (scope) setSelected({ scope, threadId });
  }

  function updateDraft(value: string) {
    if (active) setDrafts((all) => ({ ...all, [active.id]: value }));
  }

  async function send() {
    if (!scope || !listKey || !active || !draft.trim() || sending.current) return;
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
      updateThread(listKey, threadId, (thread) => (thread.messages.some((item) => item.id === message.id) ? thread : { ...thread, messages: [...thread.messages, message], unreadCount: 0 }));
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
    if (!scope || !listKey || !active?.messagesNextCursor) return;
    const threadId = active.id;
    try {
      const page = await latest.current.older(threadId, active.messagesNextCursor);
      updateThread(listKey, threadId, (thread) => ({ ...thread, messages: [...page.items, ...thread.messages], messagesNextCursor: page.nextCursor ?? null }));
    } catch (reason) {
      setActionError({ scope, threadId, message: errorText(reason, "Unable to load older messages") });
    }
  }

  /** A conversation the viewer just started: it joins the list and opens, with nothing more to fetch. */
  function addThread(thread: ChatThreadRecord) {
    if (!scope || !listKey) return;
    withHistory.current.add(thread.id);
    startedHere.current.add(thread.id);
    setLoaded((previous) => (previous?.key === listKey ? { ...previous, threads: [thread, ...previous.threads] } : previous));
    setSelected({ scope, threadId: thread.id });
  }

  /**
   * A conversation changed by a portal action (membership, status): its fresh state replaces the listed one in place.
   * Messages already on screen and the unread count stay as they were.
   */
  function replaceThread(fresh: ChatThreadRecord) {
    if (!listKey) return;
    updateThread(listKey, fresh.id, (previous) => ({
      ...previous,
      ...fresh,
      messages: addNewMessages(previous.messages, fresh.messages),
      messagesNextCursor: previous.messagesNextCursor ?? fresh.messagesNextCursor ?? null,
      unreadCount: previous.unreadCount,
    }));
  }

  const retry = () => setReload((value) => value + 1);
  const error = visibleError(current, actionError, scope, active?.id);

  return {
    status,
    threads,
    active,
    addThread,
    replaceThread,
    send,
    /** Spread onto `ChatWorkspace`. */
    workspace: {
      threads,
      visibleThreads: threads,
      viewerId,
      activeThreadId: active?.id,
      linkedThreadId: openedLinkId(linkedId, threads),
      onOpenThread: openThread,
      onThreadShown: showThread,
      onThreadHidden: () => setShownId(undefined),
      query: search,
      onQueryChange: setSearch,
      statusTab: tab,
      onStatusTabChange: setTab,
      hasMore: Boolean(current?.hasMore),
      loadingMore: Boolean(current?.loadingMore),
      onLoadMore: () => void loadMore(),
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
