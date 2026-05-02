"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
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
  const dueSoon = workspace?.quoteRequests.filter((r) => r.dueDate && !["closed", "expired", "selected"].includes(r.status)).length ?? 0;
  const selectedAssignments = workspace?.quoteRequests.filter((r) => {
    const q = quoteByRequest.get(r.id);
    return r.status === "selected" || ["selected", "locked"].includes(q?.status ?? "");
  }) ?? [];
  const needsActionCount = openRequests.length + selectedAssignments.filter((request) =>
    request.assignmentStatus !== "confirmed" || request.readinessStatus !== "confirmed" || !request.contractDocumentId,
  ).length;

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
        setNotice("Quote revision sent to PMCM.");
      } else {
        await mvpApi.submitQuote(request.accessToken, input);
        setNotice("Quote submitted to PMCM.");
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to submit quote");
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
  const readinessPending = selectedAssignments.some((request) => request.readinessStatus !== "confirmed");

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
        if (id !== "dashboard") scrollToQueue();
      }}
      user={{ name: session.name, detail: session.organization }}
      searchPlaceholder="Search quotes..."
      commandActions={[
        {
          id: "quotes",
          label: `${openRequests.length} open quote request(s)`,
          description: "Submit or revise supplier quote amounts before PMCM closes the request.",
          icon: ClipboardList,
          status: openRequests.length ? "pending" : "completed",
          onSelect: scrollToQueue,
        },
        {
          id: "readiness",
          label: readinessPending ? "Readiness needs confirmation" : "Readiness is clear",
          description: "Selected suppliers confirm assignment, contract metadata, and event-day readiness.",
          icon: PackageCheck,
          status: readinessPending ? "pending" : "confirmed",
          onSelect: scrollToQueue,
        },
      ]}
      onSignOut={signOut}
      headerActions={
        <>
          <Button variant="outline" size="icon" disabled={busy === "refresh"} onClick={() => refresh()} className="size-9 rounded-md">
            <RefreshCcw className="size-3.5" />
          </Button>
          <Badge variant="outline" className="hidden h-9 rounded-md border-(--prism-success)/25 bg-(--prism-success)/8 px-3 text-(--prism-success) sm:inline-flex">
            Approved
          </Badge>
        </>
      }
      mobileActions={[
        { id: "quotes", label: "Quotes", icon: ClipboardList, active: true, onSelect: scrollToQueue },
        { id: "ready", label: "Ready", icon: PackageCheck, onSelect: scrollToQueue },
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

        <div className="grid gap-3 md:grid-cols-4">
          <PrismMetricTile label="Open requests" value={String(openRequests.length)} icon={ClipboardList} />
          <PrismMetricTile label="Selected work" value={String(selectedQuotes.length)} icon={BadgeCheck} />
          <PrismMetricTile label="Readiness" value={readinessPending ? "Pending" : dueSoon ? "Due" : "Clear"} icon={PackageCheck} />
          <PrismMetricTile label="Certifications" value={String(workspace?.supplier.certifications.length ?? 0)} icon={CalendarClock} />
        </div>

        <RolePageHeader
          eyebrow="Supplier action path"
          title={needsActionCount ? `${needsActionCount} item(s) need supplier action` : "All supplier actions are clear"}
          description="Submit quotes before the deadline. Once PMCM selects the quote, confirm the assignment, save contract metadata, mark readiness, then use the event-day status buttons."
          meta={["PMCM-scoped", workspace?.supplier.categoryName ?? session.organization]}
        />

        <PrismSectionPanel
          title="Quote and assignment queue"
          icon={Warehouse}
          description="Quote deadlines, revise/locked states, selected assignments, readiness, contracts, and event-day supplier buttons."
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
              const closed = ["selected", "closed", "expired"].includes(request.status) || ["selected", "locked", "not_selected"].includes(quote?.status ?? "");
              const closedReason = request.status === "expired"
                ? "This quote request expired."
                : ["selected", "locked"].includes(quote?.status ?? "") || request.status === "selected"
                  ? "PMCM selected this quote. Quote editing is locked; complete assignment and readiness actions below."
                  : quote?.status === "not_selected"
                    ? "PMCM selected another quote for this category."
                    : "This request is closed.";

              return (
                <div key={request.id} className="rounded-lg border border-border bg-secondary/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-foreground">{request.category}</h3>
                      <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{request.message}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{request.dueDate ? `Due ${request.dueDate}` : "No deadline set"}</p>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {request.confidentialBid && (
                        <Badge variant="outline" className="rounded-full bg-card text-xs">Confidential</Badge>
                      )}
                      <StatusBadge status={quote?.status ?? request.status} />
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
                        <p className="mt-1 font-bold">{quote.revisionNumber ?? 1}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Range</p>
                        <p className="mt-1 font-bold">{quote.outsideAcceptableRange ? "Outside" : "Inside"}</p>
                      </div>
                    </div>
                  )}

                  {closed && (
                    <div className="mt-3 rounded-md border border-primary/15 bg-card px-3 py-2 text-xs font-semibold leading-5 text-muted-foreground">
                      {closedReason}
                    </div>
                  )}

                  <form onSubmit={(ev) => submitQuote(ev, request)} className="mt-3 grid gap-2">
                    <Input disabled={closed} value={form.amount} onChange={(ev) => updateForm(request.id, { amount: ev.target.value })} type="number" min="1" className="h-10 rounded-md" placeholder="Quote amount (PHP)" />
                    <PrismTextarea disabled={closed} value={form.inclusions} onChange={(ev) => updateForm(request.id, { inclusions: ev.target.value })} placeholder="Inclusions, one per line" />
                    <Input disabled={closed} value={form.paymentTerms} onChange={(ev) => updateForm(request.id, { paymentTerms: ev.target.value })} className="h-10 rounded-md" placeholder="Payment terms" />
                    <PrismTextarea disabled={closed} value={form.notes} onChange={(ev) => updateForm(request.id, { notes: ev.target.value })} className="min-h-16" placeholder="Supplier notes" />
                    <Button disabled={closed || busy === request.id} className="w-full justify-center rounded-md font-bold sm:w-auto sm:justify-self-start" type="submit">
                      <Send className="size-4" /> {quote ? "Send revision" : "Submit quote"}
                    </Button>
                  </form>

                  {(request.status === "selected" || ["selected", "locked"].includes(quote?.status ?? "")) && (
                    <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4">
                      <div className="flex flex-wrap gap-1.5">
                        <StatusBadge status={request.assignmentStatus ?? "pending_confirmation"} label={`Assignment ${fmt(request.assignmentStatus ?? "pending_confirmation")}`} />
                        <StatusBadge status={request.readinessStatus ?? "not_requested"} label={`Readiness ${fmt(request.readinessStatus ?? "not_requested")}`} />
                        <StatusBadge status={request.eventDayStatus ?? "not_started"} label={`Event day ${fmt(request.eventDayStatus ?? "not_started")}`} />
                        <Badge variant="outline" className="rounded-full text-xs">
                          {request.contractDocumentId ? "Contract saved" : "Contract pending"}
                        </Badge>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                        <Input value={readinessNotes[request.id] ?? request.readinessNotes ?? ""} onChange={(ev) => setReadinessNotes((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-10 rounded-md" placeholder="Readiness notes" />
                        <Button type="button" variant="outline" disabled={!session || request.readinessStatus === "confirmed" || busy === `${request.id}:readiness`} onClick={() => session && runAction(request, "readiness", () => mvpApi.confirmReadiness(session, request.id, readinessNotes[request.id] ?? request.readinessNotes ?? ""), "Readiness confirmed.")} className="h-10 rounded-md font-bold">
                          <PackageCheck className="size-4" /> Confirm readiness
                        </Button>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                        <Input value={contractFiles[request.id] ?? "supplier-contract.pdf"} onChange={(ev) => setContractFiles((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-10 rounded-md" placeholder="Contract filename" />
                        <Button type="button" variant="outline" disabled={!session || request.assignmentStatus === "confirmed" || busy === `${request.id}:assignment`} onClick={() => session && runAction(request, "assignment", () => mvpApi.confirmAssignment(session, request.id), "Assignment confirmed.")} className="h-10 rounded-md font-bold">
                          <CheckCircle2 className="size-4" /> Confirm
                        </Button>
                        <Button type="button" variant="outline" disabled={!session || busy === `${request.id}:contract`} onClick={() => session && runAction(request, "contract", () => mvpApi.uploadContract(session, request.id, contractFiles[request.id] ?? "supplier-contract.pdf"), "Contract saved.")} className="h-10 rounded-md font-bold">
                          <FileCheck2 className="size-4" /> Save contract
                        </Button>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Input value={statusNotes[request.id] ?? request.eventDayNotes ?? ""} onChange={(ev) => setStatusNotes((c) => ({ ...c, [request.id]: ev.target.value }))} className="h-10 rounded-md" placeholder="Event-day status notes" />
                        <div className="flex flex-wrap gap-2">
                          {([["arrived", "Arrived"], ["set_up_ready", "Set up and ready"], ["done_leaving", "Done and leaving"]] as const).map(([status, text]) => (
                            <Button key={status} type="button" variant={request.eventDayStatus === status ? "default" : "outline"} disabled={!session || busy === `${request.id}:${status}`} onClick={() => session && runAction(request, status, () => mvpApi.updateEventStatus(session, request.id, status, statusNotes[request.id] ?? request.eventDayNotes ?? ""), `${text} status sent.`)} className="h-9 rounded-md font-bold">
                              <Truck className="size-3.5" /> {text}
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
