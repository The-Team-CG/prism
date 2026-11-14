"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../utils";
import { type ChatThread } from "./chat-display";
import { Conversation, PaneState } from "./conversation";
import { ConversationList, type ThreadStatusTab } from "./conversation-list";
import { NewConversation, type ChatCompose } from "./new-conversation";

export type ChatWorkspaceProps = {
  ariaLabel: string;
  threads: ChatThread[];
  visibleThreads?: ChatThread[];
  viewerId?: string;
  activeThreadId?: string;
  /** The conversation a link opened. On a phone it opens straight onto that conversation instead of the list. */
  linkedThreadId?: string;
  onOpenThread: (id: string) => void;
  /** A conversation is on screen. On a phone that is only once it is opened from the list. */
  onThreadShown?: (id: string) => void;
  onThreadHidden?: () => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  /** Open or Closed. The portal owns the list, so the server applies it. */
  statusTab?: ThreadStatusTab;
  onStatusTabChange?: (tab: ThreadStatusTab) => void;
  hasMore?: boolean;
  loadingMore?: boolean;
  onLoadMore?: () => void;
  loading: boolean;
  /** The open conversation's earlier messages are still being fetched. */
  historyLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  busy: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onLoadOlder: () => void;
  composerPlaceholder?: (thread: ChatThread) => string;
  /** Shown instead of the two panes when there are no threads and the viewer cannot start one. */
  empty?: { title: string; body: string };
  compose?: ChatCompose;
  className?: string;
  notificationPrompt?: ReactNode;
  showReadReceipts?: boolean;
  /** Header controls for the open conversation. Portals pass these only for a role that may manage it. */
  renderHeaderActions?: (thread: ChatThread) => ReactNode;
  /** Controls in the closed note under the conversation (for PMCM, Reopen). */
  renderClosedAction?: (thread: ChatThread) => ReactNode;
};

type PhonePane = "list" | "chat";

/** True from the `md` breakpoint up, where the list and the conversation sit side by side. Unknown until measured. */
function useTwoPanes() {
  const [twoPanes, setTwoPanes] = useState<boolean>();
  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      setTwoPanes(true);
      return;
    }
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setTwoPanes(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return twoPanes;
}

/** How far the element starts from the top of the page, so it can take exactly the rest of the viewport. */
function usePageOffset<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [offset, setOffset] = useState<number>();
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setOffset(Math.round(node.getBoundingClientRect().top + window.scrollY));
    measure();
    window.addEventListener("resize", measure);
    // Content above the chat can appear or wrap after the first paint.
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(measure) : undefined;
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("resize", measure);
      observer?.disconnect();
    };
  }, []);
  return [ref, offset] as const;
}

function isComposing(compose: ChatCompose | undefined, threads: ChatThread[], loading: boolean) {
  return Boolean(compose && (compose.open || (threads.length === 0 && !loading)));
}

function findActiveThread(threads: ChatThread[], activeThreadId: string | undefined, composing: boolean) {
  if (composing) return undefined;
  return threads.find((thread) => thread.id === activeThreadId) ?? threads[0];
}

function isFullScreen(twoPanes: boolean | undefined, phonePane: PhonePane) {
  return twoPanes === false && phonePane === "chat";
}

/** Nothing to list and nothing to start: the whole workspace is one empty or error state. */
function hasNothingToShow({ threads, loading, compose }: Pick<ChatWorkspaceProps, "threads" | "loading" | "compose">) {
  return !loading && threads.length === 0 && !compose;
}

function frameClass(pageOffset: number | undefined, className: string | undefined) {
  return cn("min-h-[22rem] overflow-hidden rounded-xl border border-border bg-card", pageOffset === undefined && "h-[calc(100dvh-13rem)]", className);
}

function frameStyle(pageOffset: number | undefined) {
  return pageOffset === undefined ? undefined : { height: `calc(100dvh - ${pageOffset}px - 2rem)` };
}

function listPaneClass(phonePane: PhonePane) {
  return phonePane === "chat" ? "hidden md:flex" : "flex";
}

function chatPaneClass(phonePane: PhonePane) {
  return cn("min-h-0 min-w-0 flex-col bg-background md:flex", phonePane === "chat" ? "flex max-md:fixed max-md:inset-0 max-md:z-50" : "hidden");
}

/** The message shown when there is nothing to open: a load error with a retry, or the portal's empty copy. */
function EmptyState({ error, onRetry, empty }: Pick<ChatWorkspaceProps, "error" | "onRetry" | "empty">) {
  if (error) {
    return (
      <PaneState
        icon={<MessageSquareText />}
        title="Couldn't load conversations"
        body={error}
        action={onRetry ? <Button type="button" variant="outline" size="sm" onClick={onRetry}>Try again</Button> : null}
      />
    );
  }
  return <PaneState icon={<MessageSquareText />} title={empty?.title ?? "No conversations yet"} body={empty?.body} />;
}

/** The right-hand pane: loading, starting a conversation, the open conversation, or the empty state. */
function ChatDetail({ props, twoPanes, active, composing, back }: { props: ChatWorkspaceProps; twoPanes?: boolean; active?: ChatThread; composing: boolean; back: () => void }) {
  const { compose, loading } = props;
  if (loading) return <PaneState icon={<Loader2 className="animate-spin" />} title="Loading conversations…" />;
  if (composing && compose) {
    return <NewConversation compose={compose} canCancel={props.threads.length > 0} busy={props.busy} error={props.error} onBack={back} />;
  }
  if (!active) return <EmptyState error={props.error} onRetry={props.onRetry} empty={props.empty} />;
  return (
    <Conversation
      showReadReceipts={props.showReadReceipts}
      headerActions={props.renderHeaderActions?.(active)}
      closedAction={props.renderClosedAction?.(active)}
      thread={active}
      viewerId={props.viewerId}
      historyLoading={props.historyLoading}
      onLoadOlder={props.onLoadOlder}
      onBack={back}
      composer={{
        draft: props.draft,
        onDraftChange: props.onDraftChange,
        onSend: props.onSend,
        busy: props.busy,
        error: props.error,
        // Short enough to stay on one line in a phone composer; the header already names the conversation.
        placeholder: props.composerPlaceholder?.(active) ?? "Write a message",
        enterSends: twoPanes !== false,
      }}
    />
  );
}

/**
 * Messenger-style conversations: a chat list beside the open conversation. On a phone the list fills the
 * page and an opened conversation takes the whole screen, so the composer is always in view.
 * Presentation only; portals own loading, sending and who may start threads.
 */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  const { threads, compose, loading, onThreadShown } = props;
  const [phonePane, setPhonePane] = useState<PhonePane>("list");

  const twoPanes = useTwoPanes();
  const [sectionRef, pageOffset] = usePageOffset<HTMLElement>();
  const composing = isComposing(compose, threads, loading);
  const active = findActiveThread(threads, props.activeThreadId, composing);
  const fullScreen = isFullScreen(twoPanes, phonePane);
  const chatOnScreen = twoPanes === true || fullScreen;
  const shownId = chatOnScreen ? active?.id : undefined;

  useEffect(() => {
    if (shownId) onThreadShown?.(shownId);
  }, [shownId, onThreadShown]);

  const linkedThreadId = props.linkedThreadId;
  useEffect(() => {
    if (linkedThreadId) setPhonePane("chat");
  }, [linkedThreadId]);

  // The page behind a full-screen conversation must not scroll with it.
  useEffect(() => {
    if (!fullScreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullScreen]);

  const frame = frameClass(pageOffset, props.className);
  const fill = frameStyle(pageOffset);

  if (hasNothingToShow({ threads, loading, compose })) {
    return (
      <section ref={sectionRef} aria-label={props.ariaLabel} className={cn(frame, "flex flex-col")} style={fill}>
        <EmptyState error={props.error} onRetry={props.onRetry} empty={props.empty} />
        {props.notificationPrompt}
      </section>
    );
  }

  const back = () => {
    setPhonePane("list");
    props.onThreadHidden?.();
  };
  return (
    <section ref={sectionRef} aria-label={props.ariaLabel} className={cn(frame, "grid grid-cols-1 md:grid-cols-[21rem_minmax(0,1fr)]")} style={fill}>
      <ConversationList
        notice={props.notificationPrompt}
        threads={props.visibleThreads ?? threads}
        viewerId={props.viewerId}
        activeId={active?.id}
        query={props.query}
        onQueryChange={props.onQueryChange}
        loading={loading}
        error={props.error}
        statusTab={props.statusTab ?? "open"}
        onStatusTabChange={(tab) => props.onStatusTabChange?.(tab)}
        hasMore={props.hasMore}
        loadingMore={props.loadingMore}
        onLoadMore={props.onLoadMore}
        className={listPaneClass(phonePane)}
        onOpen={(id) => {
          props.onOpenThread(id);
          setPhonePane("chat");
        }}
        onCompose={
          compose
            ? () => {
                compose.onStart();
                setPhonePane("chat");
              }
            : undefined
        }
      />
      <div className={chatPaneClass(phonePane)}>
        <ChatDetail props={props} twoPanes={twoPanes} active={active} composing={composing} back={back} />
      </div>
    </section>
  );
}
