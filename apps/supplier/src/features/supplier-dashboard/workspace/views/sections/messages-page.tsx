"use client";

import { FormEvent } from "react";
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
} from "../../model/supplier-workspace-rules";
import type { PrismSupplier, PrismSupplierQuote, PrismSupplierQuoteRequest, PrismSupplierReadinessBoard, QuoteFormState, SupplierDashboardSection, SupplierWorkspace } from "../../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../../view-models/use-supplier-workspace-view-model";
import type { PrismAuthenticatedSession } from "@prism/types";
import { useSupplierMessagesViewModel } from "../../view-models/use-supplier-messages-view-model";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function MessagesPage({ session, selectedRequests }: { session: PrismAuthenticatedSession; selectedRequests: PrismSupplierQuoteRequest[] }) {
  const eventId = selectedRequests[0]?.eventId;
  const vm = useSupplierMessagesViewModel({ eventId, session });
  const { threads, active, draft, updateDraft, send, loadOlder, busy, error } = vm;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Messages</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">Direct communication with the PMCM team regarding your quote requests and assignments.</p>
      </CardHeader>
      <CardBody>
        {error ? <p className="text-sm text-destructive">{error}</p> : active ? <div className="space-y-3">
          <div className="flex flex-wrap gap-2">{threads.map((thread) => <Button key={thread.id} variant={thread.id === active.id ? "default" : "outline"} onClick={() => vm.setActiveId(thread.id)}>{thread.subject}</Button>)}</div>
          {active.messagesNextCursor ? <button type="button" className="text-xs text-primary" onClick={() => void loadOlder()}>Load older messages</button> : null}
          <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-border p-3">{active.messages.map((message) => <p key={message.id} className="text-sm"><strong>{message.senderRole}:</strong> {message.body}</p>)}</div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}><Input value={draft} onChange={(event) => updateDraft(event.target.value)} placeholder="Reply to PMCM" /><Button type="submit" disabled={!draft.trim() || busy}>Send</Button></form>
        </div> : <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description={eventId ? "PMCM will send messages here regarding clarifications, revisions, and event-day coordination." : "Messages appear after a supplier assignment is linked to an event."}
        />}
      </CardBody>
    </Card>
  );
}

