import type { ReactNode } from "react";
import { PenSquare, Search } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Skeleton } from "../components/ui/skeleton";
import { cn } from "../utils";
import { ThreadAvatar } from "./chat-avatar";
import { lastMessage, listTimestamp, threadPreview, type ChatThread } from "./chat-display";

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
};

/** The chat list: search, a way to start a conversation, and one row per conversation. */
export function ConversationList({ threads, viewerId, activeId, query, onQueryChange, loading, error, onOpen, onCompose, className, notice }: ConversationListProps) {
  const hasToolbar = Boolean(onQueryChange || onCompose);
  return (
    <aside className={cn("min-h-0 min-w-0 flex-col border-border md:border-r", className)}>
      {hasToolbar ? <ListToolbar query={query} onQueryChange={onQueryChange} onCompose={onCompose} /> : null}
      {notice}
      {error && threads.length === 0 && !loading ? (
        <p role="alert" className="mx-3 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
      <ul className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2", hasToolbar ? "" : "pt-2")}>
        {loading ? (
          <ListSkeleton />
        ) : threads.length === 0 ? (
          <EmptyList query={query} onCompose={onCompose} />
        ) : (
          threads.map((thread) => <ConversationRow key={thread.id} thread={thread} viewerId={viewerId} active={thread.id === activeId} onOpen={onOpen} />)
        )}
      </ul>
    </aside>
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

function EmptyList({ query, onCompose }: { query?: string; onCompose?: () => void }) {
  return (
    <li className="px-3 py-6 text-center text-sm text-muted-foreground">
      {query ? "No conversation matches." : "No conversations yet."}
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
