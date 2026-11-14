import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { PenSquare, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../utils";
import { ThreadAvatar } from "./chat-avatar";
import { lastMessage, listTimestamp, threadPreview, type ChatThread } from "./chat-display";

export type ThreadStatusTab = "open" | "closed";

export type ConversationListProps = {
  threads: ChatThread[];
  viewerId?: string;
  activeId?: string;
  query?: string;
  onQueryChange?: (value: string) => void;
  loading: boolean;
  error?: string | null;
  onOpen: (id: string) => void;
  onCompose?: () => void;
  className?: string;
  notice?: ReactNode;
  statusTab: ThreadStatusTab;
  onStatusTabChange: (tab: ThreadStatusTab) => void;
  /** More conversations exist beyond the loaded pages. Scrolling near the end, or the button, loads the next page. */
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
};

/** The chat list: search, a way to start a conversation, Open / Closed, one row per conversation, and paging. */
export function ConversationList(props: ConversationListProps) {
  const { query, onQueryChange, loading, error, onCompose, className, notice, statusTab, onStatusTabChange, threads } = props;
  const hasToolbar = Boolean(onQueryChange || onCompose);
  return (
    <aside className={cn("min-h-0 min-w-0 flex-col border-border md:border-r", className)}>
      {hasToolbar ? <ListToolbar query={query} onQueryChange={onQueryChange} onCompose={onCompose} /> : null}
      <StatusTabs value={statusTab} onChange={onStatusTabChange} />
      {notice}
      {error && threads.length === 0 && !loading ? (
        <p role="alert" className="mx-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
      <ListBody {...props} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2", hasToolbar ? "" : "pt-2")} />
    </aside>
  );
}

/** The rows, the skeleton or the empty copy, and the end-of-list control that loads the next page. */
function ListBody({ className, threads, viewerId, activeId, query, loading, statusTab, onOpen, onCompose, hasMore, loadingMore, onLoadMore }: ConversationListProps & { className: string }) {
  const listRef = useRef<HTMLUListElement>(null);
  return (
    <ul ref={listRef} className={className}>
      {loading ? (
        <ListSkeleton />
      ) : threads.length === 0 ? (
        <EmptyList query={query} onCompose={onCompose} closed={statusTab === "closed"} />
      ) : (
        threads.map((thread) => <ConversationRow key={thread.id} thread={thread} viewerId={viewerId} active={thread.id === activeId} onOpen={onOpen} />)
      )}
      {hasMore && onLoadMore && !loading && threads.length > 0 ? <MoreConversations root={listRef} loading={Boolean(loadingMore)} onLoadMore={onLoadMore} /> : null}
    </ul>
  );
}

/** The end of the loaded list: a button for keyboard users, and a sentinel that loads the next page as it scrolls into view. */
function MoreConversations({ root, loading, onLoadMore }: { root: RefObject<HTMLUListElement | null>; loading: boolean; onLoadMore: () => void }) {
  const sentinel = useRef<HTMLLIElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  useEffect(() => {
    loadMoreRef.current = onLoadMore;
  });
  useEffect(() => {
    const node = sentinel.current;
    if (!node || loading || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMoreRef.current();
    }, { root: root.current, rootMargin: "120px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, [root, loading]);
  return (
    <li ref={sentinel} className="px-2 pt-2">
      <Button type="button" variant="outline" size="sm" className="w-full" disabled={loading} onClick={onLoadMore}>
        {loading ? "Loading conversations…" : "Show more"}
      </Button>
    </li>
  );
}

function ListToolbar({ query, onQueryChange, onCompose }: { query?: string; onQueryChange?: (value: string) => void; onCompose?: () => void }) {
  return (
    <div className="flex items-center gap-2 p-3">
      {onQueryChange ? <SearchField value={query ?? ""} onChange={onQueryChange} /> : <span className="flex-1" />}
      {onCompose ? (
        <Button type="button" variant="outline" size="icon" onClick={onCompose} aria-label="New conversation" title="New conversation">
          <PenSquare />
        </Button>
      ) : null}
    </div>
  );
}

function SearchField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <label className="relative block min-w-0 flex-1">
      <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input type="search" value={value} onChange={(input) => onChange(input.target.value)} placeholder="Search conversations" aria-label="Search conversations" className="pl-9" />
    </label>
  );
}

/** A plain two-way switch: finished conversations leave the main list for the Closed view. */
function StatusTabs({ value, onChange }: { value: ThreadStatusTab; onChange: (tab: ThreadStatusTab) => void }) {
  const tabs: Array<{ id: ThreadStatusTab; label: string }> = [{ id: "open", label: "Open" }, { id: "closed", label: "Closed" }];
  return (
    <div role="group" aria-label="Conversation status" className="mx-3 mb-2 flex gap-1 rounded-lg bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          aria-pressed={value === tab.id}
          onClick={() => onChange(tab.id)}
          className={cn("flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors", value === tab.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

function EmptyList({ query, onCompose, closed }: { query?: string; onCompose?: () => void; closed: boolean }) {
  return (
    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
      {query ? "No conversations match." : closed ? "No closed conversations." : "No conversations yet."}
      {!query && onCompose ? (
        <Button type="button" variant="link" onClick={onCompose} className="mx-auto mt-1 flex text-primary md:hidden">Start a conversation</Button>
      ) : null}
    </li>
  );
}

function ListSkeleton() {
  return (
    <li aria-label="Loading conversations" className="space-y-1">
      {[0, 1, 2].map((row) => (
        <div key={row} className="flex items-center gap-3 px-2.5 py-2.5">
          <Skeleton className="size-10 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/3" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </li>
  );
}

function ConversationRow({ thread, viewerId, active, onOpen }: { thread: ChatThread; viewerId?: string; active: boolean; onOpen: (id: string) => void }) {
  const last = lastMessage(thread);
  const unread = thread.unreadCount ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(thread.id)}
        aria-current={active ? "true" : undefined}
        className={cn(
          "flex w-full min-w-0 items-center gap-3 rounded-lg px-2.5 py-2.5 text-left outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/50",
          // On a phone the list is its own screen, so no row is "the open one" there.
          active ? "max-md:hover:bg-muted md:bg-primary/10" : "hover:bg-muted",
        )}
      >
        <ThreadAvatar thread={thread} viewerId={viewerId} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm text-foreground", unread ? "font-bold" : "font-semibold")}>{thread.subject}</span>
            <span className={cn("shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}>{listTimestamp(last?.createdAt ?? thread.updatedAt)}</span>
          </span>
          {thread.context ? <span className="block truncate text-xs text-muted-foreground">{thread.context}</span> : null}
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{threadPreview(thread)}</span>
            {unread ? (
              <Badge className="h-5 min-w-5 rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground" aria-label={`${unread} unread`}>
                {unread > 99 ? "99+" : unread}
              </Badge>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}
