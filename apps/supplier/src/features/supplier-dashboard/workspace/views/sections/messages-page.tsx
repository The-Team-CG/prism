"use client";

import { FormEvent, useState } from "react";
import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Circle,
  ClipboardList,
  Clock3,
  FileCheck2,
  FileText,
  HelpCircle,
  LockKeyhole,
  LogOut,
  MessageSquare,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
  User,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { PrismDashboardShell } from "@prism/ui";
import {
  EVENT_STATUS_ACTIONS,
  buildBookingSteps,
  buildCalendarEvents,
  closedRequestReason,
  firstNameFrom,
  formatDate,
  formatMoney,
  fmt,
  greetingForHour,
  initialForm,
  isPastDate,
  isRequestClosed,
  readinessTone,
  supplierMessageEvents,
} from "../../model/supplier-workspace-rules";
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

type MessageEvent = ReturnType<typeof supplierMessageEvents>[number];
type MessagesViewModel = ReturnType<typeof useSupplierMessagesViewModel>;

function MessageEventChoice({ events, selectedId, onChoose }: { events: MessageEvent[]; selectedId?: string; onChoose: (id: string) => void }) {
  if (events.length < 2) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose an event">
      {events.map((item) => (
        <Button key={item.eventId} size="sm" variant={item.eventId === selectedId ? "default" : "outline"} aria-pressed={item.eventId === selectedId} onClick={() => onChoose(item.eventId)}>
          {item.eventName}
        </Button>
      ))}
    </div>
  );
}

function MessageThreads({ vm, event, choiceRequired }: { vm: MessagesViewModel; event?: MessageEvent; choiceRequired: boolean }) {
  const { threads, active, draft, updateDraft, send, loadOlder, busy, error } = vm;
  if (error) return <p className="text-sm text-destructive">{error}</p>;
  if (choiceRequired) {
    return <EmptyState icon={MessageSquare} title="Choose an event" description="You have bookings for several events. Choose one to see its messages." />;
  }
  if (!active) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No messages yet"
        description={event ? "PMCM will send messages here regarding clarifications, revisions, and event-day coordination." : "Messages appear after a supplier assignment is linked to an event."}
      />
    );
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">{threads.map((thread) => <Button key={thread.id} variant={thread.id === active.id ? "default" : "outline"} onClick={() => vm.setActiveId(thread.id)}>{thread.subject}</Button>)}</div>
      {active.messagesNextCursor ? <button type="button" className="text-xs text-primary" onClick={() => void loadOlder()}>Load older messages</button> : null}
      <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-border p-3">{active.messages.map((message) => <p key={message.id} className="text-sm"><strong>{message.senderRole}:</strong> {message.body}</p>)}</div>
      <form className="flex gap-2" onSubmit={(formEvent: FormEvent) => { formEvent.preventDefault(); void send(); }}><Input value={draft} onChange={(changeEvent) => updateDraft(changeEvent.target.value)} placeholder="Reply to PMCM" /><Button type="submit" disabled={!draft.trim() || busy}>Send</Button></form>
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
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-primary" />
          <h2 className="text-sm font-bold text-foreground">{event ? `Messages for ${event.eventName}` : "Messages"}</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Direct communication with the PMCM team about your bookings.</p>
        <MessageEventChoice events={events} selectedId={event?.eventId} onChoose={setChosenEventId} />
      </CardHeader>
      <CardBody>
        <MessageThreads vm={vm} event={event} choiceRequired={!event && events.length > 1} />
      </CardBody>
    </Card>
  );
}
