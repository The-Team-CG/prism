import type { ChatMessageRecord, ChatThreadRecord } from "./chat-display";

type MessagePage = { items: ChatMessageRecord[]; nextCursor?: string | null };
/** The open conversation and its latest page, when the source can fetch one (an inbox row carries only its last message). */
export type OpenConversation = {
  threadId?: string;
  page: MessagePage | null;
  /** True only for a conversation this viewer started in this session, which a list fetched earlier can lack. */
  started?: boolean;
};

function byCreatedAt(a: ChatMessageRecord, b: ChatMessageRecord) {
  return a.createdAt.localeCompare(b.createdAt);
}

/** Messages already on screen keep their place; an incoming message is added only when its id is not present yet. */
export function addNewMessages(shown: ChatMessageRecord[], incoming: ChatMessageRecord[]): ChatMessageRecord[] {
  const known = new Set(shown.map((message) => message.id));
  const added = incoming.filter((message) => {
    if (known.has(message.id)) return false;
    known.add(message.id);
    return true;
  });
  return added.length ? [...shown, ...added].sort(byCreatedAt) : shown;
}

function mergeThread(previous: ChatThreadRecord, fresh: ChatThreadRecord, page: MessagePage | null, open: boolean): ChatThreadRecord {
  return {
    ...fresh,
    messages: addNewMessages(previous.messages, [...fresh.messages, ...(page?.items ?? [])]),
    // History already loaded keeps its cursor; a conversation that has not loaded its history takes the one it is given.
    messagesNextCursor: previous.messagesNextCursor ?? page?.nextCursor ?? fresh.messagesNextCursor ?? null,
    // The open conversation is on screen, so what arrived in it is read.
    unreadCount: open ? 0 : fresh.unreadCount,
  };
}

/** Whether a conversation sorts after the given one in the list: less recent, or equally recent with a smaller id. */
function sortsAfter(thread: ChatThreadRecord, anchor: ChatThreadRecord) {
  return thread.updatedAt < anchor.updatedAt || (thread.updatedAt === anchor.updatedAt && thread.id < anchor.id);
}

/**
 * Folds a refreshed first page into the list on screen. Older history, drafts and the open conversation are kept; only
 * messages whose ids are new are appended, and order, previews, membership, status and unread counts come from the refresh.
 * Conversations loaded further down stay, because they sort after the refreshed page's last row. A conversation that
 * sorts within that page but is missing from it has left the list (for example, its viewer was removed).
 */
export function mergeRefreshedThreads(current: ChatThreadRecord[], incoming: ChatThreadRecord[], open: OpenConversation): ChatThreadRecord[] {
  const previous = new Map(current.map((thread) => [thread.id, thread]));
  const listed = new Set(incoming.map((thread) => thread.id));
  const refreshed = incoming.map((thread) => {
    const isOpen = thread.id === open.threadId;
    return mergeThread(previous.get(thread.id) ?? { ...thread, messages: [] }, thread, isOpen ? open.page : null, isOpen);
  });
  const tail = incoming[incoming.length - 1];
  // A conversation the viewer just started can be missing from a list fetched before it was created; it stays open.
  const kept = current.filter((thread) => !listed.has(thread.id) && ((tail !== undefined && sortsAfter(thread, tail)) || (open.started && thread.id === open.threadId)));
  return [...refreshed, ...kept];
}
