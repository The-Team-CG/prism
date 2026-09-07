"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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
import type { PrismAuthenticatedSession, PrismCommunicationThread } from "@prism/types";
import { prismApi } from "@/lib/prism-api";


import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

export function MessagesPage({ session, selectedRequests }: { session: PrismAuthenticatedSession; selectedRequests: PrismSupplierQuoteRequest[] }) {
  const eventId = selectedRequests[0]?.eventId;
  const [threads, setThreads] = useState<PrismCommunicationThread[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!eventId) return;
    void prismApi.communicationThreads(eventId, session).then((next) => { setThreads(next); setActiveId(next[0]?.id); }).catch((e: unknown) => setError(e instanceof Error ? e.message : "Unable to load messages"));
  }, [eventId, session]);
  const active = threads.find((thread) => thread.id === activeId);
  async function send() {
    if (!active || !draft.trim()) return;
    const message = await prismApi.sendCommunicationMessage(active.id, draft.trim(), `supplier-${active.id}-${Date.now()}`, session);
    setThreads((current) => current.map((thread) => thread.id === active.id ? { ...thread, messages: [...thread.messages, message] } : thread));
    setDraft("");
  }
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
          <div className="flex flex-wrap gap-2">{threads.map((thread) => <Button key={thread.id} variant={thread.id === active.id ? "default" : "outline"} onClick={() => setActiveId(thread.id)}>{thread.subject}</Button>)}</div>
          <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-border p-3">{active.messages.map((message) => <p key={message.id} className="text-sm"><strong>{message.senderRole}:</strong> {message.body}</p>)}</div>
          <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); void send(); }}><Input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Reply to PMCM" /><Button type="submit" disabled={!draft.trim()}>Send</Button></form>
        </div> : <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description={eventId ? "PMCM will send messages here regarding clarifications, revisions, and event-day coordination." : "Messages appear after a supplier assignment is linked to an event."}
        />}
      </CardBody>
    </Card>
  );
}

