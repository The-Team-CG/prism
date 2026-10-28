"use client";
import { formatPortalDateTime } from "@prism/ui/format-date";

import { MessageSquareText, Send } from "lucide-react";
import { Input } from "@/app/components/ui/input";
import { cn } from "@/app/components/ui/utils";
import { formatStatusLabel, useClientWorkspace } from "../../workspace/shared";
import { ClientAccountEventPicker } from "../../workspace/views/sections/client-account-event-picker";
import { useClientMessagesViewModel } from "../view-models/use-client-messages-view-model";

type MessagesVm = ReturnType<typeof useClientMessagesViewModel>;

function ConversationPicker({ vm }: { vm: MessagesVm }) {
  if (vm.threads.length <= 1) return null;
  return (
    <section aria-label="Conversations" className="border-b border-border p-4 md:w-64 md:shrink-0 md:border-b-0 md:border-r">
      <h2 className="mb-3 text-sm font-bold">Conversations</h2>
      <div className="space-y-1">
        {vm.threads.map((thread) => (
          <button key={thread.id} type="button" aria-pressed={thread.id === vm.activeThread?.id} onClick={() => vm.selectThread(thread.id)} className={cn("w-full rounded-lg px-3 py-2 text-left text-sm", thread.id === vm.activeThread?.id ? "bg-primary-soft font-semibold text-primary" : "hover:bg-muted")}>
            <span className="block break-words">{thread.subject}</span>
            {thread.unreadCount ? <span className="text-xs text-muted-foreground">{thread.unreadCount} unread</span> : null}
          </button>
        ))}
      </div>
    </section>
  );
}

function Conversation({ vm }: { vm: MessagesVm }) {
  const thread = vm.activeThread;
  if (!thread || !vm.selectedEvent) return <p className="flex min-h-48 flex-1 items-center justify-center p-5 text-sm text-muted-foreground">Choose a conversation to read its messages.</p>;
  const clientInitials = vm.session.name.split(" ").map((name) => name[0]).join("").slice(0, 2).toUpperCase();
  const participants = [...new Set(thread.participants.filter((person) => person.active).map((person) => formatStatusLabel(person.actorRole)))];

  return (
    <section aria-label="Conversation" className="flex min-h-96 min-w-0 flex-1 flex-col">
      <div className="border-b border-border px-5 py-4">
        <h2 className="font-bold text-foreground">{thread.subject}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{vm.selectedEvent.eventName}{participants.length ? ` · Participants: ${participants.join(", ")}` : ""}</p>
      </div>
      <div className="flex-1 space-y-4 px-5 py-5">
        {thread.messagesNextCursor ? <button type="button" className="text-sm font-semibold text-primary" onClick={() => void vm.loadOlder()}>Load older messages</button> : null}
        {thread.messages.map((message) => {
          const fromClient = message.senderRole === "client";
          return (
            <div key={message.id} className={cn("flex items-end gap-3", fromClient && "flex-row-reverse")}>
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-2xs font-bold text-muted-foreground">{fromClient ? clientInitials : formatStatusLabel(message.senderRole).slice(0, 2).toUpperCase()}</span>
              <div className={cn("flex max-w-[80%] flex-col gap-1", fromClient && "items-end")}>
                <p className={cn("whitespace-pre-wrap break-words rounded-xl px-4 py-2.5 text-sm", fromClient ? "bg-primary text-white" : "bg-muted text-foreground")}>{message.body}</p>
                <span className="text-xs text-muted-foreground">{formatStatusLabel(message.senderRole)} · {formatPortalDateTime(message.createdAt)}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t border-border p-4">
        {vm.error ? <p role="alert" className="mb-2 text-sm text-destructive">{vm.error}</p> : null}
        <div className="flex gap-2">
          <Input aria-label="Message" placeholder="Message the event team…" disabled={vm.busy} value={vm.draft} onChange={(event) => vm.updateDraft(event.target.value)} />
          <button type="button" aria-label="Send message" disabled={!vm.draft.trim() || vm.busy} onClick={() => void vm.sendMessage()} className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary text-white disabled:opacity-50"><Send aria-hidden="true" className="size-4" /></button>
        </div>
      </div>
    </section>
  );
}

function MessagesBody({ vm, hasEvents }: { vm: MessagesVm; hasEvents: boolean }) {
  if (!vm.selectedEvent) {
    return hasEvents ? null : <p className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Messages will appear when your event workspace is available.</p>;
  }
  if (vm.status === "loading") return <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Loading conversations…</p>;
  if (vm.status === "error") return (
    <div role="alert" className="rounded-xl border border-border bg-card p-5 text-sm">
      <p>{vm.error}</p>
      <button type="button" onClick={vm.retry} className="mt-3 font-semibold text-primary">Try again</button>
    </div>
  );
  if (vm.threads.length === 0) return (
    <div className="rounded-xl border border-border bg-card px-5 py-10 text-center">
      <MessageSquareText aria-hidden="true" className="mx-auto size-6 text-muted-foreground" />
      <h2 className="mt-3 font-bold text-foreground">No messages yet</h2>
      <p className="mt-1 text-sm text-muted-foreground">Messaging becomes available when PMCM opens a conversation for {vm.selectedEvent.eventName}.</p>
    </div>
  );
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm md:flex">
      <ConversationPicker vm={vm} />
      <Conversation vm={vm} />
    </div>
  );
}

export function ClientMessagesView() {
  const { events, isEventScopedView } = useClientWorkspace();
  const vm = useClientMessagesViewModel(isEventScopedView);
  return (
    <div className="space-y-4">
      {!isEventScopedView ? <ClientAccountEventPicker purpose="messages" destination="messages" /> : null}
      {isEventScopedView || events.length === 0 ? <MessagesBody vm={vm} hasEvents={events.length > 0} /> : null}
    </div>
  );
}
