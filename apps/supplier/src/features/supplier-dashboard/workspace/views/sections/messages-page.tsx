"use client";

import { useState } from "react";
import { MessageSquare } from "lucide-react";
import { ChatWorkspace } from "@prism/ui/chat";
import { Card, CardContent } from "@prism/ui/components/card";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Field, FieldLabel } from "@prism/ui/components/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { supplierMessageEvents } from "../../model/supplier-workspace-rules";
import type { PrismSupplierQuoteRequest, PrismSupplierReadinessBoard } from "../../model/supplier-workspace-types";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";

type MessageEvent = ReturnType<typeof supplierMessageEvents>[number];

/** One labelled select keeps long event names readable and never widens the page. */
function MessageEventSelect({ events, selectedId, onChoose }: { events: MessageEvent[]; selectedId?: string; onChoose: (id: string) => void }) {
  if (events.length < 2) return null;
  return (
    <Field className="max-w-md">
      <FieldLabel htmlFor="supplier-message-event">Event</FieldLabel>
      <Select value={selectedId} onValueChange={onChoose}>
        <SelectTrigger id="supplier-message-event" className="h-11 w-full min-w-0">
          <SelectValue placeholder="Choose an event" />
        </SelectTrigger>
        <SelectContent>
          {events.map((item) => <SelectItem key={item.eventId} value={item.eventId}>{item.eventName}</SelectItem>)}
        </SelectContent>
      </Select>
    </Field>
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
        <Card>
          <CardContent>
            <Empty className="border-0 p-6 md:p-8">
              <EmptyHeader>
                <EmptyMedia variant="icon"><MessageSquare /></EmptyMedia>
                <EmptyTitle>{choiceRequired ? "Choose an event" : "No messages yet"}</EmptyTitle>
                <EmptyDescription>{choiceRequired ? "You have bookings for several events. Choose one above to see its messages." : "Messages appear after a booking is linked to an event."}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          </CardContent>
        </Card>
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
          compose={{
            open: vm.composing,
            onStart: () => vm.setComposing(true),
            onCancel: () => vm.setComposing(false),
            contextLabel: event.eventName,
            recipient: "PMCM team",
            subject: vm.subject,
            onSubjectChange: vm.setSubject,
            onCreate: () => void vm.createThread(),
          }}
        />
      )}
    </div>
  );
}
