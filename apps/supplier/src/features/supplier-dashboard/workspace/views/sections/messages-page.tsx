"use client";

import { FormEvent, useState } from "react";
import { MessageSquare } from "lucide-react";
import { formatPortalDateTime } from "@prism/ui/format-date";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { EmptyState } from "@/app/components/ui/empty-state";
import { supplierMessageEvents } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";
import { Card, CardBody, CardHeader } from "./shell-ui";

type MessageEvent = ReturnType<typeof supplierMessageEvents>[number];
type MessagesViewModel = ReturnType<typeof useSupplierMessagesViewModel>;

const SENDER_LABELS: Record<string, string> = {
  supplier: "You",
  "pmcm-admin": "PMCM",
  pmcm: "PMCM",
  coordinator: "PMCM coordinator",
};

function senderLabel(role: string) {
  return SENDER_LABELS[role] ?? "PMCM";
}

/** One labelled native select keeps long event names readable and never widens the page. */
function MessageEventSelect({ events, selectedId, onChoose }: { events: MessageEvent[]; selectedId?: string; onChoose: (id: string) => void }) {
  if (events.length < 2) return null;
  return (
    <div className="grid gap-1.5">
      <label htmlFor="supplier-message-event" className="text-sm text-muted-foreground">Event</label>
      <select
        id="supplier-message-event"
        value={selectedId ?? ""}
        onChange={(event) => onChoose(event.target.value)}
        className="h-11 w-full min-w-0 rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:max-w-md"
      >
        <option value="" disabled>Choose an event</option>
        {events.map((item) => <option key={item.eventId} value={item.eventId}>{item.eventName}</option>)}
      </select>
    </div>
  );
}

function MessageThreads({ vm, event, choiceRequired }: { vm: MessagesViewModel; event?: MessageEvent; choiceRequired: boolean }) {
  const { threads, active, draft, updateDraft, send, loadOlder, busy, error } = vm;
  if (error) return <p role="alert" className="text-sm text-danger">{error}</p>;
  if (choiceRequired) {
    return <EmptyState icon={MessageSquare} title="Choose an event" description="You have bookings for several events. Choose one above to see its messages." />;
  }
  if (!active) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description={event ? "PMCM will message you here about clarifications, revisions and event-day coordination." : "Messages appear after a booking is linked to an event."}
      />
    );
  }
  return (
    <div className="space-y-4">
      {threads.length > 1 ? (
        <div className="flex gap-1 overflow-x-auto border-b border-border" role="tablist" aria-label="Conversations">
          {threads.map((thread) => {
            const selected = thread.id === active.id;
            return (
              <button
                key={thread.id}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => vm.setActiveId(thread.id)}
                className={`min-h-11 shrink-0 whitespace-nowrap px-3 text-sm transition-colors ${selected ? "font-semibold text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {thread.subject}
              </button>
            );
          })}
        </div>
      ) : (
        <h3 className="text-sm font-semibold text-foreground">{active.subject}</h3>
      )}
      {active.messagesNextCursor ? (
        <button type="button" className="min-h-11 text-sm text-primary hover:text-primary/80" onClick={() => void loadOlder()}>Load older messages</button>
      ) : null}
      <ol className="max-h-[28rem] space-y-3 overflow-y-auto" aria-label={`Messages in ${active.subject}`}>
        {active.messages.map((message) => {
          const mine = message.senderRole === "supplier";
          return (
            <li key={message.id} className={`max-w-[85%] rounded-lg px-3 py-2 ${mine ? "ml-auto bg-muted" : "border border-border bg-card"}`}>
              <p className="text-xs text-muted-foreground">
                {senderLabel(message.senderRole)} · <time dateTime={message.createdAt}>{formatPortalDateTime(message.createdAt)}</time>
              </p>
              <p className="mt-1 whitespace-pre-wrap break-words text-sm text-foreground">{message.body}</p>
            </li>
          );
        })}
      </ol>
      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(formEvent: FormEvent) => { formEvent.preventDefault(); void send(); }}>
        <label htmlFor="supplier-message-reply" className="sr-only">Reply to PMCM</label>
        <Input id="supplier-message-reply" value={draft} onChange={(changeEvent) => updateDraft(changeEvent.target.value)} placeholder="Reply to PMCM" className="h-11 min-w-0 flex-1" />
        <Button type="submit" disabled={!draft.trim() || busy} className="h-11">Send</Button>
      </form>
    </div>
  );
}

export function MessagesPage({ session, selectedRequests, readinessBoard }: { session: PrismAuthenticatedSession; selectedRequests: PrismSupplierQuoteRequest[]; readinessBoard: PrismSupplierReadinessBoard | null }) {
  const events = supplierMessageEvents(selectedRequests, readinessBoard?.items ?? []);
  const [chosenEventId, setChosenEventId] = useState<string>();
  // One booking names its event; several require a choice instead of silently using the first.
  const event = events.length === 1 ? events[0] : events.find((item) => item.eventId === chosenEventId);
  const vm = useSupplierMessagesViewModel({ eventId: event?.eventId, session });
  return (
    <Card>
      {/* The page title and description come from the workspace shell; this header only names the open event. */}
      <CardHeader>
        {events.length > 1 ? (
          <MessageEventSelect events={events} selectedId={event?.eventId} onChoose={setChosenEventId} />
        ) : (
          <p className="break-words text-sm text-muted-foreground">
            {event ? <>Conversation with PMCM about <span className="font-medium text-foreground">{event.eventName}</span></> : "No booked event yet"}
          </p>
        )}
      </CardHeader>
      <CardBody>
        <MessageThreads vm={vm} event={event} choiceRequired={!event && events.length > 1} />
      </CardBody>
    </Card>
  );
}
