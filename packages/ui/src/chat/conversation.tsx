import { Fragment, useLayoutEffect, useRef, type ReactNode } from "react";
import { ArrowLeft, MessageSquareText, Users } from "lucide-react";
import { MessageReceipt } from './message-receipt';
import { Button } from "../components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../components/ui/empty";
import { Skeleton } from "../components/ui/skeleton";
import { formatPortalTime } from "../format-date";
import { cn } from "../utils";
import { ChatAvatar, ThreadAvatar } from "./chat-avatar";
import { daySeparatorLabel, lastMessage, messageRuns, roleName, senderName, threadMembers, type ChatThread } from "./chat-display";
import { Composer, type ComposerProps } from "./composer";

/** The one empty, loading and error look for every pane of the chat. */
export function PaneState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <Empty className="p-6">
      <EmptyHeader>
        <EmptyMedia variant="icon">{icon}</EmptyMedia>
        <EmptyTitle className="text-sm">{title}</EmptyTitle>
        {body ? <EmptyDescription>{body}</EmptyDescription> : null}
      </EmptyHeader>
      {action}
    </Empty>
  );
}

export function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <Button type="button" variant="ghost" size="icon" onClick={onBack} className="-ml-1 shadow-none md:hidden" aria-label="Back to conversations">
      <ArrowLeft />
    </Button>
  );
}

export type ConversationProps = {
  thread: ChatThread;
  viewerId?: string;
  historyLoading?: boolean;
  onLoadOlder: () => void;
  onBack: () => void;
  composer: ComposerProps;
  showReadReceipts?: boolean;
};

/** The open conversation: who it is with, its messages, and the composer pinned underneath. */
export function Conversation({ thread, viewerId, historyLoading, onLoadOlder, onBack, composer, showReadReceipts }: ConversationProps) {
  const members = [...new Set(threadMembers(thread, viewerId).map((member) => member.name))];
  const people = members.length ? `You, ${members.join(", ")}` : "Only you";
  return (
    <>
      <header className="flex items-center gap-3 border-b border-border bg-card px-3 py-2.5 sm:px-4">
        <BackButton onBack={onBack} />
        <ThreadAvatar thread={thread} viewerId={viewerId} size="lg" />
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-sans text-base font-semibold leading-tight text-foreground">{thread.subject}</h2>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{thread.context ? `${thread.context} · ${people}` : people}</span>
          </p>
        </div>
      </header>
      <MessageScroller thread={thread} historyLoading={historyLoading} onLoadOlder={onLoadOlder} showReadReceipts={showReadReceipts} />
      <Composer {...composer} />
    </>
  );
}

/**
 * Messages sit against the composer, as in a messenger. The view follows new messages only while the reader
 * is already at the bottom (or sent the message), and stays put when earlier messages load above.
 */
function MessageScroller({ thread, historyLoading, onLoadOlder, showReadReceipts }: Pick<ConversationProps, "thread" | "historyLoading" | "onLoadOlder" | "showReadReceipts">) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const before = useRef<{ threadId: string; firstId?: string; lastId?: string; height: number } | null>(null);
  const firstId = thread.messages[0]?.id;
  const last = lastMessage(thread);

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const previous = before.current;
    const sameThread = previous?.threadId === thread.id;
    if (sameThread && previous.firstId !== firstId && previous.lastId === last?.id) {
      node.scrollTop += node.scrollHeight - previous.height;
    } else if (!sameThread || atBottom.current || last?.mine) {
      node.scrollTop = node.scrollHeight;
      atBottom.current = true;
    }
    before.current = { threadId: thread.id, firstId, lastId: last?.id, height: node.scrollHeight };
  }, [thread.id, firstId, last?.id, last?.mine, historyLoading]);

  return (
    <div
      ref={scrollRef}
      onScroll={(scroll) => {
        const node = scroll.currentTarget;
        atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
      }}
      className="min-h-0 flex-1 overflow-y-auto overscroll-contain"
    >
      <div className="flex min-h-full flex-col justify-end px-3 py-4 sm:px-6">
        {historyLoading ? (
          <HistorySkeleton />
        ) : thread.messages.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <PaneState icon={<MessageSquareText />} title="No messages yet" body="Say hello to start the conversation." />
          </div>
        ) : (
          <>
            {thread.messagesNextCursor ? (
              <div className="mb-3 text-center">
                <Button type="button" variant="secondary" size="sm" onClick={onLoadOlder} className="rounded-full shadow-none">Load earlier messages</Button>
              </div>
            ) : null}
            <MessageRuns thread={thread} showReadReceipts={showReadReceipts} />
          </>
        )}
      </div>
    </div>
  );
}

function HistorySkeleton() {
  return (
    <div aria-label="Loading messages" className="space-y-3">
      <Skeleton className="h-9 w-3/5 rounded-2xl" />
      <Skeleton className="ml-auto h-9 w-2/5 rounded-2xl" />
      <Skeleton className="h-9 w-1/2 rounded-2xl" />
    </div>
  );
}

function MessageRuns({ thread, showReadReceipts = false }: { thread: ChatThread; showReadReceipts?: boolean }) {
  const runs = messageRuns(thread.messages);
  return (
    <ol className="space-y-3" aria-label={`Messages in ${thread.subject}`}>
      {runs.map((run, index) => {
        const newDay = index === 0 || runs[index - 1].dayKey !== run.dayKey;
        const name = senderName(run.messages[0]);
        const role = roleName(run.messages[0].senderRole);
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
                    {name !== role ? <span className="font-normal"> · {role}</span> : null}
                  </span>
                )}
                {run.messages.map((message, position) => {
                  const lastInRun = position === run.messages.length - 1;
                  return (
                    <div
                      key={message.id}
                      className={cn(
                        "whitespace-pre-wrap break-words px-3.5 py-2 text-sm leading-relaxed",
                        run.mine ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground" : "rounded-2xl rounded-bl-md bg-card text-foreground ring-1 ring-border",
                        lastInRun ? "" : run.mine ? "rounded-br-2xl" : "rounded-bl-2xl",
                      )}
                    >
                      {message.body}
                      <span className={cn("ml-2 inline-flex translate-y-0.5 items-center gap-0.5 whitespace-nowrap align-bottom text-[11px]", run.mine ? "text-primary-foreground/75" : "text-muted-foreground")}>
                        <time dateTime={message.createdAt}>{formatPortalTime(message.createdAt)}</time>
                        {run.mine ? <MessageReceipt thread={thread} message={message} enabled={showReadReceipts} /> : null}
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
