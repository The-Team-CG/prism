"use client";

import { FormEvent, useMemo } from "react";
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
} from "../model/supplier-workspace-rules";
import type {
  PrismSupplier,
  PrismSupplierQuote,
  PrismSupplierQuoteRequest,
  PrismSupplierReadinessBoard,
  QuoteFormState,
  SupplierDashboardSection,
  SupplierSession,
  SupplierWorkspace,
} from "../model/supplier-workspace-types";
import { useSupplierWorkspaceViewModel } from "../view-models/use-supplier-workspace-view-model";

type Section = SupplierDashboardSection;

/* ── Shared card primitives ──────────────────────────────────── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>;
}
function CardHeader({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`border-b border-border px-6 py-4 ${className}`}>{children}</div>;
}
function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}
function SectionAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}

function StatCell({
  label, value, sub, icon: Icon, accent = false,
}: { label: string; value: string | number; sub?: string; icon: LucideIcon; accent?: boolean }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <span className={`grid size-11 shrink-0 place-items-center rounded-xl ${accent ? "bg-(--prism-signal) text-white" : "bg-muted text-(--prism-signal)"}`}>
        <Icon className="size-5" />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-black leading-none text-foreground">{value}</p>
        <p className="mt-1 text-xs font-semibold text-muted-foreground">{label}</p>
        {sub && <p className="mt-0.5 text-[10px] text-muted-foreground">{sub}</p>}
      </div>
    </div>
  );
}

/* ── Page: Dashboard ─────────────────────────────────────────── */

function DashboardPage({
  session, workspace, quoteByRequest, openRequests, selectedRequests,
  selectedQuotes, quoteNeedingSubmission, handoffPending, needsActionCount,
  eventsThisMonth, readinessBoard, onNavigate,
}: {
  session: SupplierSession;
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
  onNavigate: (s: Section) => void;
}) {
  const greeting = greetingForHour(new Date().getHours());
  const firstName = firstNameFrom(session.name);

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
        <div className="relative z-10">
          <p className="text-sm font-semibold text-white/70">P.R.I.S.M Supplier Portal</p>
          <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
            {greeting}, {firstName}.
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
            {needsActionCount > 0
              ? `${needsActionCount} action${needsActionCount === 1 ? "" : "s"} need your attention — ${quoteNeedingSubmission > 0 ? `${quoteNeedingSubmission} quote${quoteNeedingSubmission === 1 ? "" : "s"} to submit` : "handoff items pending"}.`
              : openRequests.length > 0
                ? `${openRequests.length} open request${openRequests.length === 1 ? "" : "s"} — all quotes submitted and up to date.`
                : "No open requests right now. PMCM will notify you when a new quote request arrives."}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {quoteNeedingSubmission > 0 && (
              <Button className="rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90" onClick={() => onNavigate("requests")}>
                <ClipboardList className="size-4" /> Submit quotes
              </Button>
            )}
            {handoffPending > 0 && (
              <Button variant="ghost" className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white" onClick={() => onNavigate("bookings")}>
                Complete handoff
              </Button>
            )}
          </div>
        </div>
        <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
        <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
      </div>

      {/* Stats */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCell label="Quotes to submit" value={quoteNeedingSubmission} sub={`${openRequests.length - quoteNeedingSubmission} revision windows`} icon={ClipboardList} accent={quoteNeedingSubmission > 0} />
        <StatCell label="Quotes submitted" value={workspace.supplierQuotes.length} sub="All submitted records" icon={Send} />
        <StatCell label="Active bookings" value={selectedQuotes.length} sub={handoffPending ? `${handoffPending} handoff pending` : "Handoff clear"} icon={BadgeCheck} accent={handoffPending > 0} />
        <StatCell label="Events this month" value={eventsThisMonth} icon={CalendarClock} />
      </div>

      {readinessBoard && (
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
            {readinessBoard.items.length ? readinessBoard.items.slice(0, 4).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onNavigate(item.quoteStatus === "selected" ? "bookings" : "requests")}
                className="flex items-start justify-between gap-4 rounded-xl border border-border bg-background px-4 py-3 text-left transition hover:border-(--prism-signal)/30 hover:bg-muted/35"
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
            )) : (
              <p className="text-sm text-muted-foreground">No supplier readiness items are open.</p>
            )}
          </CardBody>
        </Card>
      )}

      {/* Quick nav cards */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {([
          { id: "requests" as Section, icon: ClipboardList, title: "Quote requests", desc: quoteNeedingSubmission ? `${quoteNeedingSubmission} quote(s) need submission` : openRequests.length ? `${openRequests.length} open request(s)` : "No open requests", badge: openRequests.length || undefined },
          { id: "bookings" as Section, icon: BadgeCheck, title: "Bookings", desc: handoffPending ? `${handoffPending} handoff item(s) pending` : selectedRequests.length ? "All steps complete" : "No active bookings", badge: handoffPending || undefined },
          { id: "quotations" as Section, icon: FileText, title: "Quotations", desc: `${workspace.supplierQuotes.length} quote record(s) on file`, badge: undefined },
          { id: "calendar" as Section, icon: CalendarDays, title: "Calendar", desc: "Deadlines, event dates, and milestones", badge: undefined },
          { id: "payments" as Section, icon: Wallet, title: "Payments", desc: "Payment milestones and billing status", badge: undefined },
          { id: "files" as Section, icon: FileCheck2, title: "Files", desc: "Contract metadata and uploaded documents", badge: undefined },
        ] as { id: Section; icon: LucideIcon; title: string; desc: string; badge?: number }[]).map(({ id, icon: Icon, title, desc, badge }) => (
          <button key={id} type="button" onClick={() => onNavigate(id)}
            className="group flex items-start gap-3 rounded-2xl border border-border bg-card p-5 text-left shadow-sm transition hover:border-(--prism-signal)/30 hover:shadow-md"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal) transition group-hover:bg-(--prism-signal) group-hover:text-white">
              <Icon className="size-5" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-foreground">{title}</p>
                {badge != null && (
                  <span className="rounded-full bg-(--prism-amber)/10 px-2 py-0.5 text-[10px] font-bold text-(--prism-amber)">{badge}</span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ── Page: Requests ──────────────────────────────────────────── */

function RequestsPage({
  workspace, quoteByRequest, forms, busy,
  onUpdateForm, onSubmitQuote,
}: {
  workspace: SupplierWorkspace;
  quoteByRequest: Map<string, PrismSupplierQuote>;
  forms: Record<string, QuoteFormState>;
  busy: string | null;
  onUpdateForm: (id: string, patch: Partial<QuoteFormState>) => void;
  onSubmitQuote: (ev: FormEvent<HTMLFormElement>, req: PrismSupplierQuoteRequest) => void;
}) {
  if (!workspace.quoteRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={ClipboardList} title="No quote requests yet." description="PMCM will send scoped quote requests when events are ready." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-4">
      {workspace.quoteRequests.map((req) => {
        const quote = quoteByRequest.get(req.id);
        const form = forms[req.id] ?? initialForm(quote);
        const closed = isRequestClosed(req, quote);
        const deadlinePast = isPastDate(req.dueDate) && !closed;
        const quoteStatus = quote?.status ?? req.status;
        const closedReason = closedRequestReason(req, quote);

        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-bold text-foreground">{req.category}</h3>
                    {closed && <Badge variant="outline" className="rounded-full text-[10px]"><LockKeyhole className="size-3" /> Locked</Badge>}
                    {req.confidentialBid && <Badge variant="outline" className="rounded-full text-[10px]">Confidential</Badge>}
                  </div>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{req.message}</p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold ${deadlinePast ? "bg-(--prism-danger)/10 text-(--prism-danger)" : "bg-muted text-muted-foreground"}`}>
                    <Clock3 className="size-3.5" />
                    {deadlinePast ? "Past deadline" : "Due"}: {formatDate(req.dueDate)}
                  </span>
                  <StatusBadge status={quoteStatus} />
                </div>
              </div>
            </CardHeader>

            {quote && (
              <div className="grid grid-cols-3 divide-x divide-border border-b border-border">
                {[{ label: "Amount", value: formatMoney(quote.amount) }, { label: "Revision", value: `#${quote.revisionNumber ?? 1}` }, { label: "Status", value: fmt(quote.status) }].map(({ label, value }) => (
                  <div key={label} className="px-5 py-3">
                    <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-sm font-bold capitalize text-foreground">{value}</p>
                  </div>
                ))}
              </div>
            )}

            {closed && (
              <div className="border-b border-border bg-muted/30 px-6 py-3">
                <p className="text-xs leading-5 text-muted-foreground">{closedReason}</p>
              </div>
            )}

            <CardBody>
              <form onSubmit={(ev) => onSubmitQuote(ev, req)} className="space-y-4">
                <div>
                  <p className="text-sm font-bold text-foreground">{closed ? "Quote on file (read-only)" : quote ? "Revise your quote" : "Submit your quote"}</p>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    {closed ? "Locked after selection or closure." : quote ? "Revise while this request is open." : "Fill in all fields before the deadline."}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Quote amount (PHP)
                    <Input disabled={closed} value={form.amount} onChange={(e) => onUpdateForm(req.id, { amount: e.target.value })} type="number" min="1" className="h-10 rounded-xl" placeholder="75000" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Payment terms
                    <Input disabled={closed} value={form.paymentTerms} onChange={(e) => onUpdateForm(req.id, { paymentTerms: e.target.value })} className="h-10 rounded-xl" placeholder="50% down, balance after event" />
                  </label>
                </div>
                <label className="grid gap-1.5 text-sm font-bold text-foreground">
                  Inclusions (one per line)
                  <textarea disabled={closed} value={form.inclusions} onChange={(e) => onUpdateForm(req.id, { inclusions: e.target.value })} rows={3}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--prism-signal)/30"
                    placeholder="Ingress crew, lights, operator…" />
                </label>
                <label className="grid gap-1.5 text-sm font-bold text-foreground">
                  Notes
                  <textarea disabled={closed} value={form.notes} onChange={(e) => onUpdateForm(req.id, { notes: e.target.value })} rows={2}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-(--prism-signal)/30"
                    placeholder="Availability notes, exclusions, setup assumptions…" />
                </label>
                {!closed && (
                  <Button type="submit" disabled={busy === req.id} className="rounded-xl font-bold">
                    <Send className="size-4" />{quote ? "Save revision" : "Submit quote"}
                  </Button>
                )}
              </form>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Page: Bookings ──────────────────────────────────────────── */

function BookingsPage({
  selectedRequests, session, readinessNotes, contractFiles, statusNotes, busy,
  onReadinessNoteChange, onContractFileChange, onStatusNoteChange,
  onConfirmAssignment, onConfirmReadiness, onSaveContract, onUpdateStatus,
}: {
  selectedRequests: PrismSupplierQuoteRequest[];
  session: SupplierSession;
  readinessNotes: Record<string, string>;
  contractFiles: Record<string, string>;
  statusNotes: Record<string, string>;
  busy: string | null;
  onReadinessNoteChange: (id: string, v: string) => void;
  onContractFileChange: (id: string, v: string) => void;
  onStatusNoteChange: (id: string, v: string) => void;
  onConfirmAssignment: (req: PrismSupplierQuoteRequest) => void;
  onConfirmReadiness: (req: PrismSupplierQuoteRequest) => void;
  onSaveContract: (req: PrismSupplierQuoteRequest) => void;
  onUpdateStatus: (req: PrismSupplierQuoteRequest, status: string) => void;
}) {
  if (!selectedRequests.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={BadgeCheck} title="No active bookings." description="When PMCM selects your quote, the booking appears here for handoff." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-5">
      {selectedRequests.map((req) => {
        const steps = buildBookingSteps(req);

        return (
          <Card key={req.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionAccent>Selected booking</SectionAccent>
                  <h3 className="mt-1 text-sm font-bold text-foreground">{req.category}</h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">{req.message}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 text-(--prism-success)">
                  <BadgeCheck className="size-3" /> Selected
                </Badge>
              </div>
            </CardHeader>

            {/* Progress */}
            <div className="grid grid-cols-2 gap-3 border-b border-border px-6 py-5 sm:grid-cols-4">
              {steps.map((step) => (
                <div key={step.label} className="flex items-start gap-2.5">
                  <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${step.done ? "bg-(--prism-success) text-white" : "border-2 border-border bg-background"}`}>
                    {step.done ? <CheckCircle2 className="size-3" /> : <Circle className="size-3 text-muted-foreground" />}
                  </span>
                  <div className="min-w-0">
                    <p className={`text-xs font-bold ${step.done ? "text-(--prism-success)" : "text-muted-foreground"}`}>{step.label}</p>
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{step.meta}</p>
                  </div>
                </div>
              ))}
            </div>

            <CardBody className="space-y-4">
              {/* Step 1 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">1. Confirm assignment</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Acknowledge that you accept this assignment from PMCM.</p>
                <Button type="button" size="sm" variant={req.assignmentStatus === "confirmed" ? "outline" : "default"}
                  disabled={req.assignmentStatus === "confirmed" || busy === `${req.id}:assignment`}
                  onClick={() => onConfirmAssignment(req)} className="mt-3 rounded-xl font-bold">
                  <CheckCircle2 className="size-4" />
                  {req.assignmentStatus === "confirmed" ? "Assignment confirmed" : "Confirm assignment"}
                </Button>
              </div>

              {/* Step 2 */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">2. Readiness &amp; contract</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Confirm readiness and save your contract filename for PMCM records.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Readiness notes
                    <Input value={readinessNotes[req.id] ?? req.readinessNotes ?? ""} onChange={(e) => onReadinessNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Setup constraints or no concerns" />
                  </label>
                  <label className="grid gap-1.5 text-sm font-bold text-foreground">
                    Contract filename
                    <Input value={contractFiles[req.id] ?? "supplier-contract.pdf"} onChange={(e) => onContractFileChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="supplier-contract.pdf" />
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" size="sm" variant={req.readinessStatus === "confirmed" ? "outline" : "default"}
                    disabled={req.readinessStatus === "confirmed" || busy === `${req.id}:readiness`}
                    onClick={() => onConfirmReadiness(req)} className="rounded-xl font-bold">
                    <PackageCheck className="size-4" />{req.readinessStatus === "confirmed" ? "Readiness confirmed" : "Confirm readiness"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" disabled={busy === `${req.id}:contract`} onClick={() => onSaveContract(req)} className="rounded-xl font-bold">
                    <FileText className="size-4" /> Save contract
                  </Button>
                </div>
              </div>

              {/* Step 3 — event day */}
              <div className="rounded-xl border border-border bg-muted/30 p-4">
                <p className="text-sm font-bold text-foreground">3. Event day status</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Tap to update your onsite status for PMCM verification.</p>
                <label className="mt-3 grid gap-1.5 text-sm font-bold text-foreground">
                  Status note
                  <Input value={statusNotes[req.id] ?? req.eventDayNotes ?? ""} onChange={(e) => onStatusNoteChange(req.id, e.target.value)} className="h-10 rounded-xl" placeholder="Optional note for PMCM" />
                </label>
                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  {EVENT_STATUS_ACTIONS.map(({ status, label, helper }) => (
                    <button key={status} type="button" disabled={busy === `${req.id}:${status}`} onClick={() => onUpdateStatus(req, status)}
                      className={`flex h-20 w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 font-bold transition ${req.eventDayStatus === status ? "border-(--prism-signal) bg-(--prism-signal) text-white" : "border-border bg-card text-foreground hover:border-(--prism-signal)/40 hover:bg-muted/40"}`}>
                      <Truck className="size-5" />
                      <span className="text-sm">{label}</span>
                      <span className="text-[11px] font-semibold opacity-70">{helper}</span>
                    </button>
                  ))}
                </div>
              </div>
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Page: Calendar ──────────────────────────────────────────── */

function CalendarPage({ workspace }: { workspace: SupplierWorkspace; quoteByRequest: Map<string, PrismSupplierQuote> }) {
  const events = useMemo(() => buildCalendarEvents(workspace), [workspace]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Upcoming deadlines &amp; dates</h2>
          </div>
        </CardHeader>
        {events.length === 0 ? (
          <CardBody>
            <EmptyState icon={CalendarDays} title="No upcoming dates." description="Quote deadlines and event dates will appear here." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {events.map((ev, i) => {
              const past = ev.date < today;
              const isToday = ev.date === today;
              return (
                <div key={i} className="flex items-center gap-4 px-6 py-4">
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl text-center ${isToday ? "bg-(--prism-signal) text-white" : past ? "bg-muted text-muted-foreground" : "bg-muted/50 text-foreground"}`}>
                    <span className="text-[10px] font-bold uppercase leading-none">{new Date(ev.date + "T00:00:00").toLocaleString("en-PH", { month: "short" })}</span>
                    <span className="text-lg font-black leading-tight">{new Date(ev.date + "T00:00:00").getDate()}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-sm font-bold ${past ? "text-muted-foreground line-through" : "text-foreground"}`}>{ev.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{isToday ? "Today" : past ? "Past" : formatDate(ev.date)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${ev.type === "deadline" ? (past ? "bg-muted text-muted-foreground" : "bg-(--prism-amber)/10 text-(--prism-amber)") : "bg-(--prism-success)/10 text-(--prism-success)"}`}>
                    {ev.type === "deadline" ? "Quote deadline" : "Event day"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Page: Quotations ────────────────────────────────────────── */

function QuotationsPage({ workspace, quoteByRequest }: { workspace: SupplierWorkspace; quoteByRequest: Map<string, PrismSupplierQuote> }) {
  if (!workspace.supplierQuotes.length) {
    return (
      <Card><CardBody>
        <EmptyState icon={FileText} title="No quotations on file." description="Submitted quotes will appear here with their full history." />
      </CardBody></Card>
    );
  }

  return (
    <div className="space-y-4">
      {workspace.supplierQuotes.map((q) => {
        const req = workspace.quoteRequests.find((r) => r.id === q.requestId);
        return (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <SectionAccent>{q.category}</SectionAccent>
                  <p className="mt-1 text-xs text-muted-foreground">{req?.message ?? "Quote request"}</p>
                </div>
                <StatusBadge status={q.status} />
              </div>
            </CardHeader>
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border sm:grid-cols-4">
              {[
                { label: "Amount", value: formatMoney(q.amount) },
                { label: "Revision", value: `#${q.revisionNumber ?? 1}` },
                { label: "Submitted", value: formatDate(q.createdAt) },
                { label: "Last revised", value: q.revisedAt ? formatDate(q.revisedAt) : "—" },
              ].map(({ label, value }) => (
                <div key={label} className="px-5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1 text-sm font-bold text-foreground">{value}</p>
                </div>
              ))}
            </div>
            <CardBody>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Payment terms</p>
                  <p className="mt-1.5 text-sm text-foreground">{q.paymentTerms || "—"}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Inclusions</p>
                  {q.inclusions.length ? (
                    <ul className="mt-1.5 space-y-0.5">
                      {q.inclusions.map((inc, i) => (
                        <li key={i} className="flex items-center gap-1.5 text-sm text-foreground">
                          <span className="size-1.5 shrink-0 rounded-full bg-(--prism-signal)" /> {inc}
                        </li>
                      ))}
                    </ul>
                  ) : <p className="mt-1.5 text-sm text-muted-foreground">—</p>}
                </div>
              </div>
              {q.notes && (
                <div className="mt-4 rounded-xl bg-muted/40 px-4 py-3 text-xs leading-5 text-muted-foreground">{q.notes}</div>
              )}
            </CardBody>
          </Card>
        );
      })}
    </div>
  );
}

/* ── Page: Messages ──────────────────────────────────────────── */

function MessagesPage() {
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
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="PMCM will send messages here regarding clarifications, revisions, and event-day coordination."
        />
      </CardBody>
    </Card>
  );
}

/* ── Page: Files ─────────────────────────────────────────────── */

function FilesPage({ workspace }: { workspace: SupplierWorkspace }) {
  const fileRequests = workspace.quoteRequests.filter((r) => r.contractDocumentId);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Contract files</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contract metadata saved for each booking. Full documents are managed by PMCM.</p>
        </CardHeader>
        {fileRequests.length === 0 ? (
          <CardBody>
            <EmptyState icon={FileCheck2} title="No contract files saved." description="Save contract metadata in the Bookings section after PMCM selects your quote." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {fileRequests.map((req) => (
              <div key={req.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal)">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{req.contractDocumentId}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{req.category}</p>
                </div>
                <Badge variant="outline" className="rounded-full border-(--prism-success)/25 bg-(--prism-success)/8 text-[10px] text-(--prism-success)">Saved</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Certifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Certifications</h2>
          </div>
        </CardHeader>
        {workspace.supplier.certifications.length === 0 ? (
          <CardBody>
            <EmptyState icon={ShieldCheck} title="No certifications on file." description="PMCM will upload certification documents to your supplier record." />
          </CardBody>
        ) : (
          <div className="divide-y divide-border">
            {workspace.supplier.certifications.map((cert) => (
              <div key={cert.id} className="flex items-center gap-4 px-6 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-(--prism-signal)">
                  <FileCheck2 className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-foreground">{cert.fileName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {cert.documentType ?? "Document"}
                    {cert.issuer ? ` — ${cert.issuer}` : ""}
                    {cert.expiresAt ? ` — Expires ${formatDate(cert.expiresAt)}` : ""}
                  </p>
                </div>
                {cert.status && <StatusBadge status={cert.status} />}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ── Page: Payments ──────────────────────────────────────────── */

function PaymentsPage({ workspace }: { workspace: SupplierWorkspace }) {
  const selected = workspace.supplierQuotes.filter((q) => ["selected", "locked"].includes(q.status));

  return (
    <div className="space-y-4">
      {selected.length === 0 ? (
        <Card><CardBody>
          <EmptyState icon={Wallet} title="No payment milestones yet." description="Payment tracking becomes available once PMCM selects and locks your quote." />
        </CardBody></Card>
      ) : selected.map((q) => (
        <Card key={q.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <SectionAccent>Payment — {q.category}</SectionAccent>
                <p className="mt-1 text-xl font-black text-foreground">{formatMoney(q.amount)}</p>
              </div>
              <StatusBadge status={q.status} />
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { label: "Downpayment (50%)", value: formatMoney(q.amount * 0.5), status: q.lockedAt ? "paid" : "pending" },
                { label: "Balance (50%)", value: formatMoney(q.amount * 0.5), status: "pending" },
                { label: "Total locked", value: formatMoney(q.amount), status: q.lockedAt ? "locked" : "selected" },
              ].map(({ label, value, status }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-2 text-lg font-black text-foreground">{value}</p>
                  <div className="mt-2"><StatusBadge status={status} /></div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Payment terms: {q.paymentTerms || "As agreed with PMCM."} Actual payment schedule and release is managed by PMCM billing.
            </p>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

/* ── Page: Profile ───────────────────────────────────────────── */

function ProfilePage({ supplier, session }: { supplier: PrismSupplier; session: SupplierSession }) {
  return (
    <div className="space-y-4">
      {/* Identity */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Supplier profile</h2>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-center gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] text-xl font-black text-white">
              {supplier.name.slice(0, 2).toUpperCase()}
            </span>
            <div>
              <h3 className="text-lg font-bold text-foreground">{supplier.name}</h3>
              <p className="text-sm text-muted-foreground">{supplier.categoryName}</p>
              <span className="mt-1 inline-block rounded-full bg-(--prism-amber)/10 px-2.5 py-0.5 text-xs font-bold capitalize text-(--prism-amber)">
                {fmt(supplier.tier)}
              </span>
            </div>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            {[
              { label: "Contact name", value: supplier.contactName || session.name },
              { label: "Email", value: supplier.email || session.email },
              { label: "Phone", value: supplier.phone || "—" },
              { label: "Member since", value: formatDate(supplier.applicationDate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Service inclusions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Service inclusions</h2>
          </div>
        </CardHeader>
        <CardBody>
          {supplier.serviceInclusions ? (
            <p className="text-sm leading-6 text-foreground">{supplier.serviceInclusions}</p>
          ) : (
            <p className="text-sm text-muted-foreground">No service inclusions saved yet. PMCM manages your supplier record.</p>
          )}
        </CardBody>
      </Card>

      {/* Privacy notice */}
      <Card>
        <CardBody>
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-(--prism-signal)" />
            <div>
              <p className="text-sm font-bold text-foreground">Supplier privacy boundary</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                This portal shows only your assigned request records and your submitted quote. PMCM comparison, acceptable-range review, private ratings, and other supplier quotes remain private to the PMCM command app. Portal actions update your workspace for PMCM review only.
              </p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Page: Support ───────────────────────────────────────────── */

function SupportPage() {
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HelpCircle className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Supplier support</h2>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Contact the PMCM team for any portal issues, quote questions, or event concerns.</p>
        </CardHeader>
        <CardBody className="space-y-4">
          {[
            { title: "Quote submissions", body: "Submit your quote before the deadline shown on each request. Once PMCM closes or selects a request, editing is locked. Use the Requests section to submit or revise." },
            { title: "Assignment handoff", body: "After PMCM selects your quote, go to Bookings to confirm the assignment, save your contract filename, confirm readiness, and update event-day status." },
            { title: "Event day updates", body: "On the day of the event, use the Bookings section to mark Arrived, Set up and ready, and Done and leaving. These update your portal record for PMCM verification." },
            { title: "Payment inquiries", body: "Payment schedule and release is managed by PMCM billing. Check the Payments section for your selected quote amounts. Contact PMCM directly for payment timing." },
            { title: "Portal access issues", body: "If you cannot sign in or see incorrect data, contact your PMCM coordinator directly. Sample accounts: ops@xperto.test or flowers@bloom.test with password prism-supplier." },
          ].map(({ title, body }) => (
            <div key={title} className="rounded-xl border border-border bg-muted/30 p-4">
              <p className="text-sm font-bold text-foreground">{title}</p>
              <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{body}</p>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Main dashboard ──────────────────────────────────────────── */

export function SupplierWorkspaceView() {
  const vm = useSupplierWorkspaceViewModel();
  const {
    session,
    workspace,
    readinessBoard,
    section,
    setSection,
    forms,
    readinessNotes,
    contractFiles,
    statusNotes,
    error,
    notice,
    busy,
    derived,
    meta,
  } = vm;

  const {
    quoteByRequest,
    openRequests,
    selectedRequests,
    selectedQuotes,
    quoteNeedingSubmission,
    handoffPending,
    readinessNeedsActionCount,
    needsActionCount,
    eventsThisMonth,
  } = derived;

  /* Loading */
  if (!session || (!workspace && !error)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  /* Wrong role */
  if (session.role !== "supplier") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-sm">
          <ShieldCheck className="size-12 rounded-xl bg-amber-50 p-2.5 text-amber-600" />
          <h1 className="mt-5 text-xl font-bold text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Supplier dashboard access requires an approved supplier account.</p>
          <Button className="mt-5 rounded-xl font-bold" onClick={vm.goToSignIn}>Use supplier sign-in</Button>
        </div>
      </main>
    );
  }

  if (!meta) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-xl bg-muted" />
      </main>
    );
  }

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: Warehouse, badge: needsActionCount || undefined },
    { id: "requests", label: "Requests", icon: ClipboardList, badge: openRequests.length || undefined },
    { id: "bookings", label: "Bookings", icon: BadgeCheck, badge: handoffPending || undefined },
    { id: "calendar", label: "Calendar", icon: CalendarDays },
    { id: "quotations", label: "Quotations", icon: FileText },
    { id: "messages", label: "Messages", icon: MessageSquare },
    { id: "files", label: "Files", icon: FileCheck2 },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "profile", label: "Services / Profile", icon: User },
    { id: "support", label: "Support", icon: HelpCircle },
  ];

  return (
    <PrismDashboardShell
      roleLabel="Supplier portal"
      eyebrow={meta.eyebrow}
      title={meta.title}
      description={meta.description}
      activeItemId={section}
      navItems={navItems}
      sidebarMode="single"
      onNavSelect={(id) => setSection(id as Section)}
      user={{ name: session.name, detail: session.organization, initials: session.name.slice(0, 2).toUpperCase() }}
      searchPlaceholder="Search quotes, requests…"
      commandActions={[
        { id: "requests", label: quoteNeedingSubmission ? `${quoteNeedingSubmission} quote(s) need submission` : `${openRequests.length} open request(s)`, description: "Submit or revise before the deadline.", icon: ClipboardList, status: quoteNeedingSubmission ? "pending" : "completed", onSelect: () => setSection("requests") },
        { id: "bookings", label: handoffPending ? "Booking handoff needs action" : readinessBoard ? `${readinessBoard.counts.info} readiness item(s) monitored` : "Handoff is clear", description: "Confirm assignment, readiness, and contract.", icon: PackageCheck, status: handoffPending || readinessNeedsActionCount ? "pending" : "confirmed", onSelect: () => setSection("bookings") },
      ]}
      onSignOut={vm.signOut}
      headerActions={
        <>
          <Button variant="outline" size="icon" disabled={busy === "refresh"} onClick={() => void vm.refresh()} className="size-9 rounded-xl" aria-label="Refresh">
            <RefreshCcw className="size-3.5" />
          </Button>
          <Badge variant="outline" className="hidden h-9 rounded-xl border-(--prism-success)/25 bg-(--prism-success)/8 px-3 text-(--prism-success) sm:inline-flex">
            Approved
          </Badge>
        </>
      }
      mobileActions={[
        { id: "requests", label: "Requests", icon: ClipboardList, active: section === "requests", onSelect: () => setSection("requests") },
        { id: "bookings", label: "Bookings", icon: BadgeCheck, active: section === "bookings", onSelect: () => setSection("bookings") },
        { id: "logout", label: "Sign out", icon: LogOut, onSelect: vm.signOut },
      ]}
    >
      <div className="space-y-5">
        {error && (
          <div className="rounded-xl border border-(--prism-danger)/25 bg-(--prism-danger)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-danger)">{error}</div>
        )}
        {notice && (
          <div className="rounded-xl border border-(--prism-success)/25 bg-(--prism-success)/8 px-5 py-3.5 text-sm font-semibold text-(--prism-success)">{notice}</div>
        )}

        {section === "dashboard" && workspace && (
          <DashboardPage
            session={session} workspace={workspace} quoteByRequest={quoteByRequest}
            openRequests={openRequests} selectedRequests={selectedRequests}
            selectedQuotes={selectedQuotes} quoteNeedingSubmission={quoteNeedingSubmission}
            handoffPending={handoffPending} needsActionCount={needsActionCount}
            eventsThisMonth={eventsThisMonth} readinessBoard={readinessBoard} onNavigate={setSection}
          />
        )}

        {section === "requests" && workspace && (
          <RequestsPage
            workspace={workspace} quoteByRequest={quoteByRequest}
            forms={forms} busy={busy}
            onUpdateForm={vm.updateForm}
            onSubmitQuote={vm.submitQuote}
          />
        )}

        {section === "bookings" && workspace && (
          <BookingsPage
            selectedRequests={selectedRequests} session={session}
            readinessNotes={readinessNotes} contractFiles={contractFiles} statusNotes={statusNotes}
            busy={busy}
            onReadinessNoteChange={vm.setReadinessNote}
            onContractFileChange={vm.setContractFile}
            onStatusNoteChange={vm.setStatusNote}
            onConfirmAssignment={(req) => void vm.confirmAssignment(req)}
            onConfirmReadiness={(req) => void vm.confirmReadiness(req)}
            onSaveContract={(req) => void vm.saveContract(req)}
            onUpdateStatus={(req, status) => void vm.updateStatus(req, status)}
          />
        )}

        {section === "calendar" && workspace && (
          <CalendarPage workspace={workspace} quoteByRequest={quoteByRequest} />
        )}

        {section === "quotations" && workspace && (
          <QuotationsPage workspace={workspace} quoteByRequest={quoteByRequest} />
        )}

        {section === "messages" && <MessagesPage />}

        {section === "files" && workspace && <FilesPage workspace={workspace} />}

        {section === "payments" && workspace && <PaymentsPage workspace={workspace} />}

        {section === "profile" && workspace && (
          <ProfilePage supplier={workspace.supplier} session={session} />
        )}

        {section === "support" && <SupportPage />}

        {!workspace && error && (
          <Card><CardBody>
            <EmptyState icon={ShieldCheck} title="Unable to load workspace" description={error} />
          </CardBody></Card>
        )}
      </div>
    </PrismDashboardShell>
  );
}
