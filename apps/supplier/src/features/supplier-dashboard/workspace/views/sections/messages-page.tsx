"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ChatWorkspace } from "@prism/ui/chat";
import { EmptyState } from "@/app/components/ui/empty-state";
import { supplierMessageEvents } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";

type MessageEvent = ReturnType<typeof supplierMessageEvents>[number];

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

export function MessagesPage({ session, selectedRequests, readinessBoard }: { session: PrismAuthenticatedSession; selectedRequests: PrismSupplierQuoteRequest[]; readinessBoard: PrismSupplierReadinessBoard | null }) {
  const events = supplierMessageEvents(selectedRequests, readinessBoard?.items ?? []);
  const [chosenEventId, setChosenEventId] = useState<string>();
  // One booking names its event; several require a choice instead of silently using the first.
  const event = events.length === 1 ? events[0] : events.find((item) => item.eventId === chosenEventId);
  const vm = useSupplierMessagesViewModel({ eventId: event?.eventId, session });
  const choiceRequired = !event && events.length > 1;
  return (
    <div className="space-y-4">
      {events.length > 1 ? (
        <MessageEventSelect events={events} selectedId={event?.eventId} onChoose={setChosenEventId} />
      ) : (
        <p className="break-words text-sm text-muted-foreground">
          {event ? <>Conversations with PMCM about <span className="font-medium text-foreground">{event.eventName}</span></> : "No booked event yet"}
        </p>
      )}
      {choiceRequired || !event ? (
        <EmptyState
          icon={MessageSquare}
          title={choiceRequired ? "Choose an event" : "No messages yet"}
          description={choiceRequired ? "You have bookings for several events. Choose one above to see its messages." : "Messages appear after a booking is linked to an event."}
        />
      ) : (
        <ChatWorkspace
          ariaLabel={`Messages for ${event.eventName}`}
          threads={vm.chatThreads}
          visibleThreads={vm.visibleThreads}
          viewerId={session.id}
          activeThreadId={vm.active?.id}
          onOpenThread={vm.setActiveId}
          query={vm.query}
          onQueryChange={vm.setQuery}
          loading={vm.loading}
          error={vm.error}
          onRetry={vm.retry}
          busy={vm.busy}
          draft={vm.draft}
          onDraftChange={vm.updateDraft}
          onSend={() => void vm.send()}
          onLoadOlder={() => void vm.loadOlder()}
          composerPlaceholder={() => "Reply to PMCM"}
          empty={{ title: "No messages yet", body: "PMCM will message you here about clarifications, revisions and event-day coordination." }}
        />
      )}
    </div>
  );
}
