"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  FileCheck2,
  LockKeyhole,
  LogOut,
  PackageCheck,
  RefreshCcw,
  Send,
  ShieldCheck,
  Truck,
  Warehouse,
} from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  PrismAppShell,
  PrismEmptyState,
  PrismMetricTile,
  PrismNoticeBanner,
  PrismSectionPanel,
  PrismTextarea,
  RolePageHeader,
} from "@prism/ui";
import { mvpApi, type MvpSupplierQuote, type MvpSupplierQuoteRequest, type SupplierSession, type SupplierWorkspace } from "@/lib/mvp-api";

const SESSION_KEY = "prism:supplier-session";

type QuoteFormState = {
  amount: string;
  inclusions: string;
  paymentTerms: string;
  notes: string;
};

const money = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", maximumFractionDigits: 0 });
const dateOnly = new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", year: "numeric" });
const dateTime = new Intl.DateTimeFormat("en-PH", {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

const eventStatusActions = [
  { status: "arrived", label: "Arrived", helper: "Onsite at venue" },
  { status: "set_up_ready", label: "Set up and ready", helper: "Setup is complete" },
  { status: "done_leaving", label: "Done and leaving", helper: "Egress started" },
] as const;

function readSession() {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as SupplierSession;
  } catch {
    window.localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function fmt(value: string) {
  return value.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "No deadline set";
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return dateOnly.format(new Date(year, month - 1, day));
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return value.includes("T") ? dateTime.format(parsed) : dateOnly.format(parsed);
}

function isPastDate(value?: string | null) {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.getTime() < Date.now();
}

function initialForm(quote?: MvpSupplierQuote): QuoteFormState {
  return {
    amount: quote ? String(quote.amount) : "",
    inclusions: quote?.inclusions.join("\n") ?? "",
    paymentTerms: quote?.paymentTerms ?? "",
    notes: quote?.notes ?? "",
  };
}

export default function SupplierDashboard() {
  const router = useRouter();
  const [session, setSession] = useState<SupplierSession | null>(null);
  const [workspace, setWorkspace] = useState<SupplierWorkspace | null>(null);
  const [forms, setForms] = useState<Record<string, QuoteFormState>>({});
  const [readinessNotes, setReadinessNotes] = useState<Record<string, string>>({});
  const [statusNotes, setStatusNotes] = useState<Record<string, string>>({});
  const [contractFiles, setContractFiles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    const current = readSession();
    if (!current) {
      router.replace("/sign-in?next=/dashboard");
      return;
    }
    setSession(current);
  }, [router]);

  async function refresh(current = session) {
    if (!current) return;
    setError(null);
    setBusy("refresh");
    try {
      const next = await mvpApi.supplierWorkspace(current);
      setWorkspace(next);
      setForms((existing) => {
        const quoteByRequest = new Map(next.supplierQuotes.map((q) => [q.requestId, q]));
        const merged: Record<string, QuoteFormState> = {};
        next.quoteRequests.forEach((req) => {
          merged[req.id] = existing[req.id] ?? initialForm(quoteByRequest.get(req.id));
        });
        return merged;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load supplier workspace");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    if (session) void refresh(session);
  }, [session?.email]);

  const quoteByRequest = useMemo(
    () => new Map((workspace?.supplierQuotes ?? []).map((q) => [q.requestId, q])),
    [workspace],
  );
  const openRequests = workspace?.quoteRequests.filter((r) => !["closed", "expired", "selected"].includes(r.status)) ?? [];
  const selectedQuotes = workspace?.supplierQuotes.filter((q) => ["selected", "locked"].includes(q.status)) ?? [];
  const openDeadlines = workspace?.quoteRequests.filter((r) => r.dueDate && !["closed", "expired", "selected"].includes(r.status)).length ?? 0;
  const quoteRequestsNeedingSubmission = openRequests.filter((request) => !quoteByRequest.get(request.id)).length;
  const openRevisionWindows = openRequests.length - quoteRequestsNeedingSubmission;
  const selectedAssignments = workspace?.quoteRequests.filter((r) => {
    const q = quoteByRequest.get(r.id);
    return r.status === "selected" || ["selected", "locked"].includes(q?.status ?? "");
  }) ?? [];
  const selectedAssignmentsNeedingHandoff = selectedAssignments.filter((request) =>
    request.assignmentStatus !== "confirmed" || request.readinessStatus !== "confirmed" || !request.contractDocumentId,
  ).length;
  const needsActionCount = quoteRequestsNeedingSubmission + selectedAssignmentsNeedingHandoff;

  function updateForm(requestId: string, patch: Partial<QuoteFormState>) {
    setForms((cur) => ({
      ...cur,
      [requestId]: { ...(cur[requestId] ?? initialForm()), ...patch },
    }));
  }

  async function submitQuote(ev: FormEvent<HTMLFormElement>, request: MvpSupplierQuoteRequest) {
    ev.preventDefault();
    const form = forms[request.id] ?? initialForm();
    const amount = Number(form.amount);
    if (!amount || amount <= 0) {
      setError("Quote amount must be greater than zero.");
      return;
    }
    const quote = quoteByRequest.get(request.id);
    const input = {
      amount,
      inclusions: form.inclusions.split("\n").map((s) => s.trim()).filter(Boolean),
      paymentTerms: form.paymentTerms,
      notes: form.notes,
    };
    setBusy(request.id);
    setError(null);
    setNotice(null);
    try {
      if (quote) {
        await mvpApi.reviseQuote(request.accessToken, input);
        setNotice("Quote revision saved in the supplier portal for PMCM review.");
      } else {
        await mvpApi.submitQuote(request.accessToken, input);
        setNotice("Quote submitted in the supplier portal for PMCM review.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit quote in the supplier portal");
    } finally {
      setBusy(null);
    }
  }

  async function runAction(request: MvpSupplierQuoteRequest, action: string, task: () => Promise<unknown>, success: string) {
    setBusy(`${request.id}:${action}`);
    setError(null);
    setNotice(null);
    try {
      await task();
      setNotice(success);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  if (!session || (!workspace && !error)) {
    return (
      <main className="grid min-h-screen place-items-center bg-background">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-secondary" />
      </main>
    );
  }

  if (session.role !== "supplier") {
    return (
      <main className="grid min-h-screen place-items-center bg-background px-6">
        <section className="w-full max-w-md rounded-lg border border-border bg-card p-7 shadow-md">
          <span className="grid size-11 place-items-center rounded-lg bg-amber-50 text-amber-600">
            <ShieldCheck className="size-5" />
          </span>
          <h1 className="mt-5 text-xl font-black text-foreground">Wrong portal for this account.</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Supplier dashboard access requires an approved supplier account.</p>
          <Button className="mt-5 rounded-md font-bold" onClick={() => router.replace("/sign-in")}>
            Use supplier sign-in
          </Button>
        </section>
      </main>
    );
  }

  const signOut = () => {
    window.localStorage.removeItem(SESSION_KEY);
    router.replace("/sign-in");
  };

  const scrollToQueue = () => document.getElementById("quote-queue")?.scrollIntoView({ behavior: "smooth" });
  const scrollToReadiness = () => document.getElementById("supplier-readiness")?.scrollIntoView({ behavior: "smooth" });
  const scrollToFiles = () => document.getElementById("supplier-contract-metadata")?.scrollIntoView({ behavior: "smooth" });
  const scrollToEventDay = () => document.getElementById("supplier-event-day")?.scrollIntoView({ behavior: "smooth" });
  const readinessPending = selectedAssignments.some((request) => request.readinessStatus !== "confirmed");
  const selectedAnchorRequestId = selectedAssignments[0]?.id;

  return (
    <PrismAppShell
      roleLabel="Supplier portal"
      eyebrow="Supplier dashboard"
      title={`Hello, ${session.name}.`}
      description={`${workspace?.supplier.categoryName ?? session.organization} workspace`}
      activeItemId="dashboard"
      navItems={[
        { id: "dashboard", label: "Dashboard", icon: Warehouse, badge: needsActionCount || undefined },
        { id: "quote-requests", label: "Quote requests", icon: ClipboardList, badge: openRequests.length || undefined },
        { id: "readiness", label: "Readiness", icon: PackageCheck },
        { id: "files", label: "Files", icon: FileCheck2 },
      ]}
      onNavSelect={(id) => {
        if (id === "quote-requests") scrollToQueue();
        if (id === "readiness") scrollToReadiness();
        if (id === "files") scrollToFiles();
      }}
      user={{ name: session.name, detail: session.organization }}
      searchPlaceholder="Search quotes..."
      commandActions={[
        {
          id: "quotes",
          label: quoteRequestsNeedingSubmission
            ? `${quoteRequestsNeedingSubmission} quote(s) need submission`
            : `${openRevisionWindows} open revision window(s)`,
          description: "Only this supplier account's requests and quote records are visible here.",
          icon: ClipboardList,
          status: quoteRequestsNeedingSubmission ? "pending" : "completed",
          onSelect: scrollToQueue,
        },
        {
          id: "readiness",
          label: selectedAssignmentsNeedingHandoff ? "Selected handoff needs confirmation" : "Selected handoff is clear",
          description: "Confirm assignment, contract metadata, readiness, and event-day portal status.",
          icon: PackageCheck,
          status: selectedAssignmentsNeedingHandoff ? "pending" : "confirmed",
          onSelect: scrollToReadiness,
        },
      ]}
      onSignOut={signOut}
      headerActions={
        <>
          <Button variant="outline" size="icon" disabled={busy === "refresh"} onClick={() => refresh()} className="size-9 rounded-md" aria-label="Refresh supplier workspace">
            <RefreshCcw className="size-3.5" />
          </Button>
          <Badge variant="outline" className="hidden h-9 rounded-md border-(--prism-success)/25 bg-(--prism-success)/8 px-3 text-(--prism-success) sm:inline-flex">
            Approved
          </Badge>
        </>
      }
      mobileActions={[
        { id: "quotes", label: "Quote queue", icon: ClipboardList, active: true, onSelect: scrollToQueue },
        { id: "event-day", label: "Event day", icon: Truck, onSelect: scrollToEventDay },
        { id: "logout", label: "Sign out", icon: LogOut, onSelect: signOut },
      ]}
      rightRail={
        <aside className="rounded-lg border border-primary/20 bg-(--prism-ink) p-5 text-sidebar-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-(--prism-amber)">Supplier profile</p>
              <h2 className="mt-1.5 text-xl font-black">{workspace?.supplier.name ?? session.organization}</h2>
            </div>
            <Truck className="size-7 text-(--prism-amber)" />
          </div>
          <div className="mt-5 flex flex-col gap-3">
            <div className="rounded-lg bg-white/8 p-3">
              <p className="text-xs font-black text-(--prism-amber)">{fmt(workspace?.supplier.tier ?? "supplier")}</p>
              <p className="mt-1 text-sm font-bold">{workspace?.supplier.contactName || session.name}</p>
              <p className="mt-0.5 text-xs text-sidebar-foreground/70">{workspace?.supplier.email || session.email}</p>
            </div>
            <div className="rounded-lg bg-white/8 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-sidebar-foreground/60">Service inclusions</p>
              <p className="mt-1.5 text-sm leading-5 text-sidebar-foreground/80">{workspace?.supplier.serviceInclusions || "No inclusions saved yet."}</p>
            </div>
            <div className="rounded-lg bg-white/8 p-3">
              <p className="text-xs font-bold uppercase tracking-wide text-sidebar-foreground/60">Certifications</p>
              {workspace?.supplier.certifications.length === 0 ? (
                <p className="mt-1.5 text-sm text-sidebar-foreground/60">No certifications recorded.</p>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {workspace?.supplier.certifications.map((cert) => (
                    <div key={cert.id} className="flex items-start gap-2 text-sm">
                      <FileCheck2 className="mt-0.5 size-3.5 shrink-0 text-(--prism-amber)" />
                      <span>
                        <span className="block font-bold">{cert.fileName}</span>
                        <span className="text-xs text-sidebar-foreground/60">{cert.documentType || "Document"}{cert.status ? ` - ${fmt(cert.status)}` : ""}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {selectedQuotes.map((quote) => (
              <div key={quote.id} className="rounded-lg bg-(--prism-success)/15 p-3">
                <p className="flex items-center gap-2 text-sm font-bold text-(--prism-success)">
                  <CheckCircle2 className="size-4" /> Selected assignment
                </p>
                <p className="mt-1 text-xs text-sidebar-foreground/70">{quote.category} - {money.format(quote.amount)}</p>
              </div>
            ))}
          </div>
        </aside>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <PrismNoticeBanner tone="danger">{error}</PrismNoticeBanner>}
        {notice && <PrismNoticeBanner tone="success">{notice}</PrismNoticeBanner>}
        <PrismNoticeBanner tone="info" title="Supplier privacy boundary">
          This portal shows only your assigned request records and your submitted quote. PMCM comparison, acceptable-range review, private ratings, and other supplier quotes stay in the PMCM command app. Portal actions update this supplier workspace for PMCM review.
        </PrismNoticeBanner>

        <div className="grid gap-3 md:grid-cols-4">
          <PrismMetricTile label="Needs first quote" value={String(quoteRequestsNeedingSubmission)} icon={ClipboardList} detail={`${openRevisionWindows} revision window(s) open`} />
          <PrismMetricTile label="Selected work" value={String(selectedQuotes.length)} icon={BadgeCheck} detail={`${selectedAssignmentsNeedingHandoff} handoff item(s) pending`} />
          <PrismMetricTile label="Readiness" value={readinessPending ? "Pending" : "Clear"} icon={PackageCheck} detail={openDeadlines ? `${openDeadlines} active deadline(s)` : "No dated deadline"} />
          <PrismMetricTile label="Certifications" value={String(workspace?.supplier.certifications.length ?? 0)} icon={CalendarClock} detail="Supplier profile only" />
        </div>

        <RolePageHeader
          eyebrow="Supplier action path"
          title={needsActionCount ? `${needsActionCount} required supplier action(s)` : "Required supplier actions are clear"}
          description="Submit first quotes before the deadline. While a request is open, revise only your own quote. Once PMCM selects it, pricing locks and the remaining work is assignment confirmation, contract metadata, readiness, and event-day portal status."
          meta={["Supplier-scoped", "Portal/local updates", workspace?.supplier.categoryName ?? session.organization]}
        />

        <PrismSectionPanel
          title="Quote and assignment queue"
          icon={Warehouse}
          description="Deadlines, submit/revise/locked states, selected assignments, readiness, contract metadata, and large event-day buttons."
          contentClassName="flex flex-col gap-4"
        >
          <div id="quote-queue" className="scroll-mt-24" />
          {!workspace?.quoteRequests.length ? (
            <PrismEmptyState
              icon={ClipboardList}
              title="No quote requests yet"
              description="PMCM will send scoped quote requests to this supplier account."
            />
          ) : (
            workspace.quoteRequests.map((request) => {
              const quote = quoteByRequest.get(request.id);
              const form = forms[request.id] ?? initialForm(quote);
              const quoteStatus = quote?.status ?? request.status;
              const closed = ["selected", "closed", "expired"].includes(request.status) || ["selected", "locked", "not_selected"].includes(quote?.status ?? "");
              const selected = request.status === "selected" || ["selected", "locked"].includes(quote?.status ?? "");
              const deadlinePast = isPastDate(request.dueDate) && !closed;
              const formTitle = closed ? "Quote editing locked" : quote ? "Revise your quote" : "Submit your quote";
              const formHelper = closed
                ? "The quote fields stay visible for reference, but edits are disabled after PMCM closes or selects the request."
                : quote
                  ? "Your current quote is saved. Use revision only while PMCM keeps this request open."
                  : "Add your amount, inclusions, payment terms, and notes before the portal deadline.";
              const closedReason = request.status === "expired"
                ? "The deadline passed. This request is no longer accepting portal quote edits."
                : ["selected", "locked"].includes(quote?.status ?? "") || request.status === "selected"
                  ? "PMCM selected this quote. Pricing is locked; complete assignment, contract metadata, readiness, and event-day actions below."
                  : quote?.status === "not_selected"
                    ? "PMCM did not select this quote. Comparison details and other supplier quotes remain private to PMCM."
                    : "PMCM closed this request. Quote editing is locked in this portal.";

              return (
                <div key={request.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">{request.category}</h3>
                        {closed ? (
                          <Badge variant="outline" className="rounded-full bg-card text-xs">
                            <LockKeyhole className="size-3" /> Locked
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{request.message}</p>
                      <p className={`mt-1 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${deadlinePast ? "bg-(--prism-danger)/10 text-(--prism-danger)" : "bg-card text-muted-foreground"}`}>
                        <Clock3 className="size-3.5" />
                        {deadlinePast ? "Past deadline" : "Quote deadline"}: {formatDate(request.dueDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {request.confidentialBid && (
                        <Badge variant="outline" className="rounded-full bg-card text-xs">Confidential to PMCM</Badge>
                      )}
                      <StatusBadge status={quoteStatus} />
                    </div>
                  </div>

                  {quote && (
                    <div className="mt-3 grid gap-3 rounded-lg border border-border bg-card p-3 text-sm sm:grid-cols-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Amount</p>
                        <p className="mt-1 font-bold">{money.format(quote.amount)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Revision</p>
                        <p className="mt-1 font-bold">#{quote.revisionNumber ?? 1}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Supplier-visible state</p>
                        <p className="mt-1 font-bold capitalize">{fmt(quote.status)}</p>
                      </div>
                    </div>
                  )}

                  {closed && (
                    <div className="mt-3 rounded-md border border-primary/15 bg-card px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
                      {closedReason}
                    </div>
                  )}

                  <form onSubmit={(ev) => submitQuote(ev, request)} className="mt-4 grid gap-3">
                    <div>
                      <p className="text-sm font-black text-foreground">{formTitle}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{formHelper}</p>
                    </div>
                    <label className="grid gap-1.5 text-sm font-bold text-foreground">
                      <span>Quote amount (PHP)</span>
                      <Input disabled={closed} value={form.amount} onChange={(ev) => updateForm(request.id, { amount: ev.target.value })} type="number" min="1" className="h-11 rounded-md" placeholder="Example: 75000" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-bold text-foreground">
                      <span>Inclusions</span>
                      <PrismTextarea disabled={closed} value={form.inclusions} onChange={(ev) => updateForm(request.id, { inclusions: ev.target.value })} placeholder="One inclusion per line, e.g. ingress crew, lights, operator" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-bold text-foreground">
                      <span>Payment terms</span>
                      <Input disabled={closed} value={form.paymentTerms} onChange={(ev) => updateForm(request.id, { paymentTerms: ev.target.value })} className="h-11 rounded-md" placeholder="Example: 50% downpayment, balance after event" />
                    </label>
                    <label className="grid gap-1.5 text-sm font-bold text-foreground">
                      <span>Supplier notes</span>
                      <PrismTextarea disabled={closed} value={form.notes} onChange={(ev) => updateForm(request.id, { notes: ev.target.value })} className="min-h-20" placeholder="Availability notes, exclusions, setup assumptions, or concerns" />
                    </label>
                    <Button disabled={closed || busy === request.id} className="h-11 w-full justify-center rounded-md font-bold sm:w-auto sm:justify-self-start" type="submit">
                      <Send className="size-4" /> {quote ? "Save quote revision" : "Submit quote"}
                    </Button>
                  </form>

                  {selected && (
                    <div className="mt-4 flex flex-col gap-4 rounded-lg border border-border bg-card p-4">
                      {request.id === selectedAnchorRequestId ? <div id="supplier-readiness" className="scroll-mt-24" /> : null}
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-black text-foreground">Selected assignment handoff</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Pricing is locked after PMCM selection. Confirm the assignment, save portal contract metadata, mark readiness, then update event-day status for PMCM verification.
                          </p>
                        </div>
                        <Badge variant="outline" className="rounded-full bg-secondary text-xs">
                          {request.contractDocumentId ? "Contract metadata saved" : "Contract metadata needed"}
                        </Badge>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                        <div className="rounded-md border border-border bg-secondary/35 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Assignment</p>
                          <div className="mt-1"><StatusBadge status={request.assignmentStatus ?? "pending_confirmation"} label={fmt(request.assignmentStatus ?? "pending_confirmation")} /></div>
                          <p className="mt-1 text-xs text-muted-foreground">{request.assignmentConfirmedAt ? `Confirmed ${formatDate(request.assignmentConfirmedAt)}` : "Waiting for supplier confirmation"}</p>
                        </div>
                        <div className="rounded-md border border-border bg-secondary/35 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Readiness</p>
                          <div className="mt-1"><StatusBadge status={request.readinessStatus ?? "not_requested"} label={fmt(request.readinessStatus ?? "not_requested")} /></div>
                          <p className="mt-1 text-xs text-muted-foreground">{request.readinessConfirmedAt ? `Confirmed ${formatDate(request.readinessConfirmedAt)}` : "Confirm before event day"}</p>
                        </div>
                        <div className="rounded-md border border-border bg-secondary/35 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Contract metadata</p>
                          <p className="mt-1 text-sm font-black text-foreground">{request.contractDocumentId ? "Saved" : "Needed"}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{request.contractDocumentId ? "Portal file hub record exists" : "Save filename metadata below"}</p>
                        </div>
                        <div className="rounded-md border border-border bg-secondary/35 p-3">
                          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Event day</p>
                          <div className="mt-1"><StatusBadge status={request.eventDayStatus ?? "not_started"} label={fmt(request.eventDayStatus ?? "not_started")} /></div>
                          <p className="mt-1 text-xs text-muted-foreground">{request.eventDayStatusAt ? `Updated ${formatDate(request.eventDayStatusAt)}` : "Use the large buttons onsite"}</p>
                        </div>
                      </div>

                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <label className="grid gap-1.5 text-sm font-bold text-foreground">
                          <span>Readiness notes or concerns</span>
                          <Input value={readinessNotes[request.id] ?? request.readinessNotes ?? ""} onChange={(ev) => setReadinessNotes((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-11 rounded-md" placeholder="Setup constraints, ingress needs, or no concerns" />
                        </label>
                        <Button type="button" variant="outline" disabled={!session || request.readinessStatus === "confirmed" || busy === `${request.id}:readiness`} onClick={() => session && runAction(request, "readiness", () => mvpApi.confirmReadiness(session, request.id, readinessNotes[request.id] ?? request.readinessNotes ?? ""), "Readiness confirmed in the supplier portal.")} className="h-11 w-full self-end rounded-md font-bold sm:w-auto">
                          <PackageCheck className="size-4" /> Confirm readiness
                        </Button>
                      </div>

                      {request.id === selectedAnchorRequestId ? <div id="supplier-contract-metadata" className="scroll-mt-24" /> : null}
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <label className="grid gap-1.5 text-sm font-bold text-foreground">
                          <span>Contract metadata filename</span>
                          <Input value={contractFiles[request.id] ?? "supplier-contract.pdf"} onChange={(ev) => setContractFiles((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-11 rounded-md" placeholder="supplier-contract.pdf" />
                        </label>
                        <Button type="button" variant="outline" disabled={!session || request.assignmentStatus === "confirmed" || busy === `${request.id}:assignment`} onClick={() => session && runAction(request, "assignment", () => mvpApi.confirmAssignment(session, request.id), "Assignment confirmed in the supplier portal.")} className="h-11 w-full self-end rounded-md font-bold sm:w-auto">
                          <CheckCircle2 className="size-4" /> Confirm assignment
                        </Button>
                        <Button type="button" variant="outline" disabled={!session || busy === `${request.id}:contract`} onClick={() => session && runAction(request, "contract", () => mvpApi.uploadContract(session, request.id, contractFiles[request.id] ?? "supplier-contract.pdf"), "Contract metadata saved in the supplier portal.")} className="h-11 w-full self-end rounded-md font-bold sm:w-auto">
                          <FileCheck2 className="size-4" /> Save metadata
                        </Button>
                      </div>

                      {request.id === selectedAnchorRequestId ? <div id="supplier-event-day" className="scroll-mt-24" /> : null}
                      <div className="flex flex-col gap-3 rounded-md border border-primary/10 bg-secondary/25 p-3">
                        <div>
                          <p className="text-sm font-black text-foreground">Event-day status</p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">Large buttons are sized for phone use at the venue. These update the portal record for PMCM to verify.</p>
                        </div>
                        <label className="grid gap-1.5 text-sm font-bold text-foreground">
                          <span>Status note</span>
                          <Input value={statusNotes[request.id] ?? request.eventDayNotes ?? ""} onChange={(ev) => setStatusNotes((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-11 rounded-md bg-card" placeholder="Optional note for PMCM verification" />
                        </label>
                        <div className="grid gap-2 sm:grid-cols-3">
                          {eventStatusActions.map(({ status, label, helper }) => (
                            <Button key={status} type="button" variant={request.eventDayStatus === status ? "default" : "outline"} disabled={!session || busy === `${request.id}:${status}`} onClick={() => session && runAction(request, status, () => mvpApi.updateEventStatus(session, request.id, status, statusNotes[request.id] ?? request.eventDayNotes ?? ""), `Portal event-day status updated: ${label}.`)} className="h-16 w-full justify-start rounded-md px-4 text-left font-bold sm:justify-center sm:text-center">
                              <Truck className="size-4" />
                              <span className="flex flex-col leading-tight">
                                <span>{label}</span>
                                <span className="text-[11px] font-semibold opacity-75">{helper}</span>
                              </span>
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </PrismSectionPanel>
      </div>
    </PrismAppShell>
  );
}
