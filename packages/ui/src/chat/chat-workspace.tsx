"use client";

import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { ArrowLeft, Check, Loader2, MessageSquareText, PenSquare, Search, Send, Users } from "lucide-react";
import { formatPortalDateTime, formatPortalTime } from "../format-date";
import { cn } from "../utils";
import {
  daySeparatorLabel,
  initials,
  lastMessage,
  listTimestamp,
  messageRuns,
  roleName,
  senderName,
  threadMembers,
  threadPreview,
  type ChatPerson,
  type ChatThread,
  type ParticipantDirectory,
} from "./chat-display";

const AVATAR_TONES = ["bg-primary/12 text-primary", "bg-attention-soft text-attention", "bg-success-soft text-success", "bg-info-soft text-info", "bg-muted text-foreground"];
const NO_PEOPLE: ParticipantDirectory = new Map();

function avatarTone(seed: string) {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_TONES[hash % AVATAR_TONES.length];
}

export function ChatAvatar({ name, seed, size = "md" }: { name: string; seed?: string; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-semibold",
        size === "sm" ? "size-7 text-[11px]" : size === "lg" ? "size-11 text-sm" : "size-10 text-xs",
        avatarTone(seed ?? name),
      )}
    >
      {initials(name)}
    </span>
  );
}

/** Starting a conversation is optional: only portals whose actors may open threads pass this. */
export type ChatCompose = {
  open: boolean;
  onStart: () => void;
  onCancel: () => void;
  contextLabel: string;
  participants: ChatPerson[];
  subject: string;
  onSubjectChange: (value: string) => void;
  selected: string[];
  onToggle: (id: string) => void;
  onCreate: () => void;
};

export type ChatWorkspaceProps = {
  ariaLabel: string;
  threads: ChatThread[];
  visibleThreads?: ChatThread[];
  people?: ParticipantDirectory;
  viewerId?: string;
  activeThreadId?: string;
  onOpenThread: (id: string) => void;
  query?: string;
  onQueryChange?: (value: string) => void;
  loading: boolean;
  error?: string | null;
  onRetry?: () => void;
  busy: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onLoadOlder: () => void;
  composerPlaceholder?: (thread: ChatThread) => string;
  /** Shown in the conversation pane when there are no threads and the viewer cannot start one. */
  empty?: { title: string; body: string };
  compose?: ChatCompose;
  className?: string;
};

/**
 * Messenger-style conversations: a chat list beside the open conversation, collapsing to one
 * pane on phones. Presentation only; portals own loading, sending and who may start threads.
 */
export function ChatWorkspace(props: ChatWorkspaceProps) {
  const { threads, compose, loading } = props;
  const people = props.people ?? NO_PEOPLE;
  const [mobilePane, setMobilePane] = useState<"list" | "chat">("list");
  const active = compose?.open ? undefined : threads.find((thread) => thread.id === props.activeThreadId) ?? threads[0];
  const showCompose = Boolean(compose && (compose.open || threads.length === 0));

  return (
    <section
      aria-label={props.ariaLabel}
      className={cn("grid h-[calc(100dvh-11rem)] min-h-[32rem] overflow-hidden rounded-xl border border-border bg-card md:grid-cols-[21rem_minmax(0,1fr)]", props.className)}
    >
      <ConversationList
        {...props}
        people={people}
        activeId={active?.id}
        hidden={mobilePane === "chat"}
        onOpen={(id) => {
          props.onOpenThread(id);
          setMobilePane("chat");
        }}
        onCompose={
          compose
            ? () => {
                compose.onStart();
                setMobilePane("chat");
              }
            : undefined
        }
      />
      <div className={cn("min-h-0 min-w-0 flex-col bg-background md:flex", mobilePane === "chat" ? "flex" : "hidden")}>
        <ChatPane {...props} people={people} active={active} showCompose={showCompose} onBack={() => setMobilePane("list")} />
      </div>
    </section>
  );
}

/** The right-hand pane: loading, a new conversation, the open conversation, an error, or the empty state. */
function ChatPane(props: ChatWorkspaceProps & { people: ParticipantDirectory; active?: ChatWorkspaceProps["threads"][number]; showCompose: boolean; onBack: () => void }) {
  const { loading, compose, active, showCompose, threads, onBack } = props;
  if (loading) return <PaneMessage icon={<Loader2 className="size-5 animate-spin" />} title="Loading conversations…" />;
  if (showCompose && compose) return <NewConversation compose={compose} canCancel={threads.length > 0} busy={props.busy} error={props.error} onBack={onBack} />;
  if (active) return <Conversation {...props} thread={active} onBack={onBack} />;
  if (props.error) {
    return (
      <PaneMessage
        icon={<MessageSquareText className="size-5" />}
        title="Couldn't load conversations"
        body={props.error}
        action={props.onRetry ? <button type="button" onClick={props.onRetry} className="text-sm font-semibold text-primary">Try again</button> : null}
      />
    );
  }
  return <PaneMessage icon={<MessageSquareText className="size-5" />} title={props.empty?.title ?? "No conversations yet"} body={props.empty?.body} />;
}

function PaneMessage({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-muted-foreground">
      <span className="grid size-12 place-items-center rounded-full bg-muted">{icon}</span>
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {body ? <p className="max-w-sm text-sm">{body}</p> : null}
      {action}
    </div>
  );
}

function ConversationList({
  threads,
  visibleThreads,
  people,
  query,
  onQueryChange,
  loading,
  error,
  activeId,
  hidden,
  onOpen,
  onCompose,
}: ChatWorkspaceProps & { people: ParticipantDirectory; activeId?: string; hidden: boolean; onOpen: (id: string) => void; onCompose?: () => void }) {
  const shown = visibleThreads ?? threads;
  return (
    <aside className={cn("min-h-0 flex-col border-border md:flex md:border-r", hidden ? "hidden" : "flex")}>
      <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
        <h2 className="text-lg font-bold text-foreground">Chats</h2>
        {onCompose ? (
          <button
            type="button"
            onClick={onCompose}
            className="grid size-9 place-items-center rounded-full text-primary transition-colors hover:bg-primary/10"
            aria-label="New conversation"
            title="New conversation"
          >
            <PenSquare className="size-4.5" />
          </button>
        ) : null}
      </div>
      {onQueryChange ? (
        <label className="relative mx-4 mb-2 block">
          <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query ?? ""}
            onChange={(input) => onQueryChange(input.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="h-9 w-full rounded-full bg-muted pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
      ) : null}
      {error && threads.length === 0 && !loading ? (
        <p role="alert" className="mx-4 rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">{error}</p>
      ) : null}
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {loading ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-muted-foreground">{query ? "No conversation matches." : "No conversations yet."}</li>
        ) : (
          shown.map((thread) => <ConversationListItem key={thread.id} thread={thread} people={people} active={thread.id === activeId} onOpen={onOpen} />)
        )}
      </ul>
    </aside>
  );
}

function ConversationListItem({ thread, people, active, onOpen }: { thread: ChatThread; people: ParticipantDirectory; active: boolean; onOpen: (id: string) => void }) {
  const last = lastMessage(thread);
  const unread = thread.unreadCount ?? 0;
  return (
    <li>
      <button
        type="button"
        onClick={() => onOpen(thread.id)}
        aria-current={active ? "true" : undefined}
        className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors", active ? "bg-primary/10" : "hover:bg-muted")}
      >
        <ChatAvatar name={thread.subject} seed={thread.id} />
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate text-sm text-foreground", unread ? "font-bold" : "font-semibold")}>{thread.subject}</span>
            <span className={cn("shrink-0 text-xs", unread ? "font-semibold text-primary" : "text-muted-foreground")}>{listTimestamp(last?.createdAt ?? thread.updatedAt)}</span>
          </span>
          <span className="mt-0.5 flex items-center justify-between gap-2">
            <span className={cn("truncate text-sm", unread ? "font-medium text-foreground" : "text-muted-foreground")}>{threadPreview(thread, people)}</span>
            {unread ? (
              <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </span>
        </span>
      </button>
    </li>
  );
}

function Conversation(props: ChatWorkspaceProps & { people: ParticipantDirectory; thread: ChatThread; onBack: () => void }) {
  const { thread, people, viewerId, onBack } = props;
  const members = threadMembers(thread, people, viewerId);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = lastMessage(thread)?.id;

  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [thread.id, lastId]);

  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </button>
        <ChatAvatar name={thread.subject} seed={thread.id} size="lg" />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-foreground">{thread.subject}</p>
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{members.length ? `You, ${[...new Set(members)].join(", ")}` : "Only you"}</span>
          </p>
        </div>
      </header>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-6">
        {thread.messagesNextCursor ? (
          <div className="mb-3 text-center">
            <button type="button" onClick={props.onLoadOlder} className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
              Load earlier messages
            </button>
          </div>
        ) : null}
        {thread.messages.length === 0 ? (
          <PaneMessage icon={<MessageSquareText className="size-5" />} title="No messages yet" body="Say hello to start the conversation." />
        ) : (
          <MessageRuns thread={thread} people={people} />
        )}
      </div>

      <Composer
        draft={props.draft}
        onDraftChange={props.onDraftChange}
        onSend={props.onSend}
        busy={props.busy}
        error={props.error}
        placeholder={props.composerPlaceholder?.(thread) ?? `Message ${thread.subject}`}
      />
    </>
  );
}

function MessageRuns({ thread, people }: { thread: ChatThread; people: ParticipantDirectory }) {
  const runs = messageRuns(thread.messages);
  return (
    <ol className="space-y-3" aria-label={`Messages in ${thread.subject}`}>
      {runs.map((run, index) => {
        const newDay = index === 0 || runs[index - 1].dayKey !== run.dayKey;
        const name = senderName(run.messages[0], people);
        return (
          <Fragment key={run.key}>
            {newDay ? (
              <li className="flex justify-center py-1">
                <span className="rounded-full bg-muted px-3 py-0.5 text-xs font-medium text-muted-foreground">{daySeparatorLabel(run.dayKey)}</span>
              </li>
            ) : null}
            <li className={cn("flex items-end gap-2", run.mine ? "justify-end" : "justify-start")}>
              {run.mine ? null : <ChatAvatar name={name} seed={run.senderId} size="sm" />}
              <div className={cn("flex max-w-[min(36rem,78%)] flex-col gap-0.5", run.mine ? "items-end" : "items-start")}>
                {run.mine ? null : (
                  <span className="px-3 text-xs font-medium text-muted-foreground">
                    {name}
                    {name !== roleName(run.messages[0].senderRole) ? <span className="font-normal"> · {roleName(run.messages[0].senderRole)}</span> : null}
                  </span>
                )}
                {run.messages.map((message, position) => {
                  const lastInRun = position === run.messages.length - 1;
                  return (
                    <div
                      key={message.id}
                      title={formatPortalDateTime(message.createdAt)}
                      className={cn(
                        "whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed",
                        run.mine ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground" : "rounded-2xl rounded-bl-md bg-card text-foreground ring-1 ring-border",
                        lastInRun ? "" : run.mine ? "rounded-br-2xl" : "rounded-bl-2xl",
                      )}
                    >
                      {message.body}
                      <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-0.5 whitespace-nowrap align-bottom text-[11px]", run.mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        <time dateTime={message.createdAt}>{formatPortalTime(message.createdAt)}</time>
                        {run.mine ? <Check className="size-3" aria-label="Sent" /> : null}
                      </span>
                    </div>
                  );
                })}
              </div>
            </li>
          </Fragment>
        );
      })}
    </ol>
  );
}

function Composer({
  draft,
  onDraftChange,
  onSend,
  busy,
  error,
  placeholder,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  busy: boolean;
  error?: string | null;
  placeholder: string;
}) {
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const node = inputRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [draft]);

  function onKeyDown(input: KeyboardEvent<HTMLTextAreaElement>) {
    if (input.key === "Enter" && !input.shiftKey && !input.nativeEvent.isComposing) {
      input.preventDefault();
      onSend();
    }
  }

  return (
    <div className="border-t border-border bg-card px-3 py-3 sm:px-4">
      {error ? <p role="alert" className="mb-2 text-xs text-danger">{error}</p> : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          rows={1}
          value={draft}
          onChange={(input) => onDraftChange(input.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Message"
          className="max-h-40 min-h-10 flex-1 resize-none rounded-2xl bg-muted px-4 py-2.5 text-sm leading-5 outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
        />
        <button
          type="button"
          disabled={!draft.trim() || busy}
          onClick={onSend}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground transition-opacity disabled:opacity-40"
          aria-label="Send message"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </button>
      </div>
      <p className="mt-1.5 hidden px-1 text-[11px] text-muted-foreground sm:block">Enter to send · Shift + Enter for a new line</p>
    </div>
  );
}

function NewConversation({ compose, canCancel, busy, error, onBack }: { compose: ChatCompose; canCancel: boolean; busy: boolean; error?: string | null; onBack: () => void }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-3 sm:px-4">
        <button type="button" onClick={onBack} className="grid size-9 place-items-center rounded-full hover:bg-muted md:hidden" aria-label="Back to conversations">
          <ArrowLeft className="size-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-foreground">New conversation</p>
          <p className="truncate text-xs text-muted-foreground">{compose.contextLabel}</p>
        </div>
        {canCancel ? (
          <button type="button" onClick={compose.onCancel} className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
            Cancel
          </button>
        ) : null}
      </header>
      <form
        className="flex min-h-0 flex-1 flex-col"
        onSubmit={(submit) => {
          submit.preventDefault();
          compose.onCreate();
        }}
      >
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            Topic
            <input
              value={compose.subject}
              onChange={(input) => compose.onSubjectChange(input.target.value)}
              placeholder="e.g. Stage setup timing"
              className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
            />
          </label>
          <fieldset className="grid gap-1.5">
            <legend className="mb-1.5 text-sm font-medium text-foreground">
              People <span className="font-normal text-muted-foreground">· {compose.selected.length} selected</span>
            </legend>
            {compose.participants.length === 0 ? (
              <p className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">No verified participants yet.</p>
            ) : (
              <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
                {compose.participants.map((person) => {
                  const selected = compose.selected.includes(person.id);
                  return (
                    <li key={person.id}>
                      <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/60">
                        <input type="checkbox" className="sr-only" checked={selected} onChange={() => compose.onToggle(person.id)} />
                        <ChatAvatar name={person.name} seed={person.id} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-foreground">{person.name}</span>
                          <span className="block truncate text-xs text-muted-foreground">{[person.role ? roleName(person.role) : null, person.email].filter(Boolean).join(" · ")}</span>
                        </span>
                        <span aria-hidden className={cn("grid size-5 place-items-center rounded-full border", selected ? "border-primary bg-primary text-primary-foreground" : "border-border")}>
                          {selected ? <Check className="size-3" /> : null}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </fieldset>
          {error ? <p role="alert" className="text-sm text-danger">{error}</p> : null}
        </div>
        <div className="border-t border-border bg-card p-3 sm:px-6">
          <button
            type="submit"
            disabled={!compose.subject.trim() || compose.selected.length === 0 || busy}
            className="inline-flex h-10 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <MessageSquareText className="size-4" />}
            Start conversation
          </button>
        </div>
      </form>
    </div>
  );
}
