"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Loader2, MessageSquareText } from "lucide-react";
import { Button } from "../components/ui/button";
import { cn } from "../utils";
import { type ChatThread } from "./chat-display";
import { Conversation, PaneState } from "./conversation";
import { ConversationList } from "./conversation-list";
import { NewConversation, type ChatCompose } from "./new-conversation";

export type ChatWorkspaceProps = {
  ariaLabel: string;
  threads: ChatThread[];
  visibleThreads?: ChatThread[];
  viewerId?: string;
  activeThreadId?: string;
  onOpenThread: (id: string) => void;
  /** A conversation is on screen. On a phone that is only once it is opened from the list. */
  onThreadShown?: (id: string) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
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
};

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

/**
 * Messenger-style conversations: a chat list beside the open conversation. On a phone the list fills the
 * page and an opened conversation takes the whole screen, so the composer is always in view.
 * Presentation only; portals own loading, sending and who may start threads.
 */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  const { threads, compose, loading, onThreadShown } = props;
  const [phonePane, setPhonePane] = useState<"list" | "chat">("list");
  const twoPanes = useTwoPanes();
  const [sectionRef, pageOffset] = usePageOffset<HTMLElement>();
  const composing = Boolean(compose && (compose.open || (threads.length === 0 && !loading)));
  const active = composing ? undefined : threads.find((thread) => thread.id === props.activeThreadId) ?? threads[0];
  const chatOnScreen = twoPanes === true || (twoPanes === false && phonePane === "chat");
  const shownId = chatOnScreen ? active?.id : undefined;
  const fullScreen = twoPanes === false && phonePane === "chat";

  useEffect(() => {
    if (shownId) onThreadShown?.(shownId);
  }, [shownId, onThreadShown]);

  // The page behind a full-screen conversation must not scroll with it.
  useEffect(() => {
    if (!fullScreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullScreen]);

  const frame = cn("min-h-[22rem] overflow-hidden rounded-xl border border-border bg-card", pageOffset === undefined && "h-[calc(100dvh-13rem)]", props.className);
  const fill = pageOffset === undefined ? undefined : { height: `calc(100dvh - ${pageOffset}px - 2rem)` };

  if (!loading && threads.length === 0 && !compose) {
    return (
      <section ref={sectionRef} aria-label={props.ariaLabel} className={cn(frame, "flex")} style={fill}>
        {props.error ? (
          <PaneState
            icon={<MessageSquareText />}
            title="Couldn't load conversations"
            body={props.error}
            action={props.onRetry ? <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>Try again</Button> : null}
          />
        ) : (
          <PaneState icon={<MessageSquareText />} title={props.empty?.title ?? "No conversations yet"} body={props.empty?.body} />
        )}
      </section>
    );
  }

  const back = () => setPhonePane("list");
  return (
    <section ref={sectionRef} aria-label={props.ariaLabel} className={cn(frame, "grid grid-cols-1 md:grid-cols-[21rem_minmax(0,1fr)]")} style={fill}>
      <ConversationList
        threads={props.visibleThreads ?? threads}
        viewerId={props.viewerId}
        activeId={active?.id}
        query={props.query}
        onQueryChange={props.onQueryChange}
        loading={loading}
        error={props.error}
        className={phonePane === "chat" ? "hidden md:flex" : "flex"}
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
      <div className={cn("min-h-0 min-w-0 flex-col bg-background md:flex", phonePane === "chat" ? "flex max-md:fixed max-md:inset-0 max-md:z-50" : "hidden")}>
        {loading ? (
          <PaneState icon={<Loader2 className="animate-spin" />} title="Loading conversations…" />
        ) : composing && compose ? (
          <NewConversation compose={compose} canCancel={threads.length > 0} busy={props.busy} error={props.error} onBack={back} />
        ) : active ? (
          <Conversation
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
              placeholder: props.composerPlaceholder?.(active) ?? `Message ${active.subject}`,
              enterSends: twoPanes !== false,
            }}
          />
        ) : props.error ? (
          <PaneState
            icon={<MessageSquareText />}
            title="Couldn't load conversations"
            body={props.error}
            action={props.onRetry ? <Button type="button" variant="outline" size="sm" onClick={props.onRetry}>Try again</Button> : null}
          />
        ) : (
          <PaneState icon={<MessageSquareText />} title={props.empty?.title ?? "No conversations yet"} body={props.empty?.body} />
        )}
      </div>
    </section>
  );
}
