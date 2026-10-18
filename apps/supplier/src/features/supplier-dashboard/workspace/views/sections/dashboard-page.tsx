"use client";

import {
  BadgeCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  FileCheck2,
  FileText,
  Send,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";
import {
  bookingsNavDesc,
  dashboardGreetingCopy,
  firstNameFrom,
  fmt,
  greetingForHour,
  quoteRequestsNavDesc,
  readinessTone,
} from "../../model/supplier-workspace-rules";
import type { PrismAuthenticatedSession } from "@prism/types";
import type {
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  SupplierDashboardSection,
  SupplierWorkspace,
} from "../../model/supplier-workspace-types";
import { Card, CardBody, CardHeader, SectionAccent, StatCell } from "./shell-ui";

function DashboardGreeting({
  session,
  needsActionCount,
  quoteNeedingSubmission,
  openRequestCount,
  handoffPending,
  onNavigate,
}: {
  session: PrismAuthenticatedSession;
  needsActionCount: number;
  quoteNeedingSubmission: number;
  openRequestCount: number;
  handoffPending: number;
  onNavigate: (s: SupplierDashboardSection) => void;
}) {
  const greeting = greetingForHour(new Date().getHours());
  const firstName = firstNameFrom(session.name);
  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
      <div className="relative z-10">
        <p className="text-sm font-semibold text-white/70">P.R.I.S.M Supplier Portal</p>
        <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
          {greeting}, {firstName}.
        </h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
          {dashboardGreetingCopy({ needsActionCount, quoteNeedingSubmission, openRequestCount })}
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {quoteNeedingSubmission > 0 ? (
            <Button className="rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90" onClick={() => onNavigate("requests")}>
              <ClipboardList className="size-4" /> Submit quotes
            </Button>
          ) : null}
          {handoffPending > 0 ? (
            <Button variant="ghost" className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white" onClick={() => onNavigate("bookings")}>
              Complete handoff
            </Button>
          ) : null}
        </div>
      </div>
      <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
      <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
    </div>
  );
}

function DashboardReadinessBoard({
  readinessBoard,
  onNavigate,
}: {
  readinessBoard: PrismSupplierReadinessBoard | null;
  onNavigate: (s: SupplierDashboardSection) => void;
}) {
  if (!readinessBoard) {
    return (
      <Card>
        <CardHeader>
          <SectionAccent>Readiness board</SectionAccent>
          <h2 className="mt-1 text-lg font-black text-foreground">Readiness data unavailable</h2>
          <p className="mt-1 text-sm text-muted-foreground" role="status">
            Persisted handoff status is still loading or could not be reached. No urgency is inferred from local workspace data.
          </p>
        </CardHeader>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <SectionAccent>Readiness board</SectionAccent>
          <h2 className="mt-1 text-lg font-black text-foreground">Supplier-scoped handoff state</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Quote, assignment, contract, readiness, and event-day status from the shared API contract.
          </p>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center text-xs">
          {(["critical", "warning", "attention", "info"] as const).map((key) => (
            <span key={key} className={`rounded-xl border px-3 py-2 ${readinessTone(key)}`}>
              <span className="block text-base font-black">{readinessBoard.counts[key]}</span>
              <span className="capitalize">{fmt(key)}</span>
            </span>
          ))}
        </div>
      </CardHeader>
      <CardBody className="grid gap-3">
        {readinessBoard.items.length ? (
          readinessBoard.items.slice(0, 4).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.quoteStatus === "selected" ? "bookings" : "requests")}
              className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-(--prism-signal)/30 hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--prism-signal) focus-visible:ring-inset"
            >
              <span className="min-w-0">
                <span className="block text-sm font-black text-foreground">{item.eventName ?? "Assigned event"}</span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                  {item.category} · quote {fmt(item.quoteStatus)} · assignment {fmt(item.assignmentStatus ?? "pending")} · readiness {fmt(item.readinessStatus ?? "not confirmed")}
                </span>
              </span>
              <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase ${readinessTone(item.priority)}`}>
                {fmt(item.priority)}
              </span>
            </button>
          ))
        ) : (
          <p className="text-sm text-muted-foreground">No supplier readiness items are open.</p>
        )}
      </CardBody>
    </Card>
  );
}

function dashboardQuickNavItems(input: {
  quoteNeedingSubmission: number;
  openRequestCount: number;
  handoffPending: number;
  selectedRequestCount: number;
  quoteCount: number;
}): Array<{ id: SupplierDashboardSection; icon: LucideIcon; title: string; desc: string; badge?: number }> {
  return [
    {
      id: "requests",
      icon: ClipboardList,
      title: "Quote requests",
      desc: quoteRequestsNavDesc(input.quoteNeedingSubmission, input.openRequestCount),
      badge: input.openRequestCount || undefined,
    },
    {
      id: "bookings",
      icon: BadgeCheck,
      title: "Bookings",
      desc: bookingsNavDesc(input.handoffPending, input.selectedRequestCount),
      badge: input.handoffPending || undefined,
    },
    { id: "quotations", icon: FileText, title: "Quotations", desc: `${input.quoteCount} quote record(s) on file` },
    { id: "calendar", icon: CalendarDays, title: "Calendar", desc: "Deadlines, event dates, and milestones" },
    { id: "payments", icon: Wallet, title: "Payments", desc: "Payment milestones and billing status" },
    { id: "files", icon: FileCheck2, title: "Files", desc: "Uploaded contracts, review status, and certifications" },
  ];
}

function DashboardQuickNav({
  items,
  onNavigate,
}: {
  items: Array<{ id: SupplierDashboardSection; icon: LucideIcon; title: string; desc: string; badge?: number }>;
  onNavigate: (s: SupplierDashboardSection) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map((item) => (
        <QuickNavCard key={item.id} item={item} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

function QuickNavCard({
  item,
  onNavigate,
}: {
  item: { id: SupplierDashboardSection; icon: LucideIcon; title: string; desc: string; badge?: number };
  onNavigate: (s: SupplierDashboardSection) => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={() => onNavigate(item.id)}
      className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-(--prism-signal)/30 hover:shadow-md"
    >
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal) transition group-hover:bg-(--prism-signal) group-hover:text-white">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold text-foreground">{item.title}</p>
          {item.badge != null ? (
            <span className="rounded-full bg-(--prism-amber)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">{item.badge}</span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
      </div>
    </button>
  );
}

export function DashboardPage({
  session,
  workspace,
  openRequests,
  selectedRequests,
  selectedQuotes,
  quoteNeedingSubmission,
  handoffPending,
  needsActionCount,
  eventsThisMonth,
  readinessBoard,
  onNavigate,
}: {
  session: PrismAuthenticatedSession;
  workspace: SupplierWorkspace;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  openRequests: PrismSupplierQuoteRequest[];
  selectedRequests: PrismSupplierQuoteRequest[];
  selectedQuotes: PrismSupplierQuote[];
  quoteNeedingSubmission: number;
  handoffPending: number;
  needsActionCount: number;
  eventsThisMonth: number;
  readinessBoard: PrismSupplierReadinessBoard | null;
  onNavigate: (s: SupplierDashboardSection) => void;
}) {
  return (
    <div className="space-y-6">
      <DashboardGreeting
        session={session}
        needsActionCount={needsActionCount}
        quoteNeedingSubmission={quoteNeedingSubmission}
        openRequestCount={openRequests.length}
        handoffPending={handoffPending}
        onNavigate={onNavigate}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell label="Quotes to submit" value={quoteNeedingSubmission} sub={`${openRequests.length - quoteNeedingSubmission} revision windows`} icon={ClipboardList} accent={quoteNeedingSubmission > 0} />
        <StatCell label="Quotes submitted" value={workspace.supplierQuotes.length} sub="All submitted records" icon={Send} />
        <StatCell label="Active bookings" value={selectedQuotes.length} sub={handoffPending ? `${handoffPending} handoff pending` : "Handoff clear"} icon={BadgeCheck} accent={handoffPending > 0} />
        <StatCell label="Events this month" value={eventsThisMonth} icon={CalendarClock} />
      </div>
      <DashboardReadinessBoard readinessBoard={readinessBoard} onNavigate={onNavigate} />
      <DashboardQuickNav
        items={dashboardQuickNavItems({
          quoteNeedingSubmission,
          openRequestCount: openRequests.length,
          handoffPending,
          selectedRequestCount: selectedRequests.length,
          quoteCount: workspace.supplierQuotes.length,
        })}
        onNavigate={onNavigate}
      />
    </div>
  );
}
