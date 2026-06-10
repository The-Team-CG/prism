"use client";

import { useEffect, useMemo, useState } from "react";
import type React from "react";
import {
  Archive,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  FileCheck2,
  LayoutGrid,
  Lock,
  Mail,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  UserCheck,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import { prismApi, type DemoRole, type PrismDemoState } from "@/lib/prism-api";

const roleLabels: Record<DemoRole, string> = {
  "pmcm-admin": "PMCM",
  client: "Client",
  coordinator: "Coordinator",
  supplier: "Supplier",
};

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function statusLabel(value: string) {
  return value.replaceAll("_", " ");
}

function cx(...classes: Array<string | false | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Metric({
  label,
  value,
  icon: Icon,
  tone = "emerald",
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  tone?: "emerald" | "amber" | "blue" | "rose";
}) {
  const tones = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    rose: "bg-rose-50 text-rose-700 ring-rose-100",
  };
  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div className={cx("flex size-9 items-center justify-center rounded-md ring-1", tones[tone])}>
          <Icon size={16} />
        </div>
        <div className="text-2xl font-semibold text-neutral-950">{value}</div>
      </div>
      <div className="mt-3 text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</div>
    </div>
  );
}

function Panel({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white">
      <div className="flex min-h-12 items-center justify-between border-b border-neutral-100 px-4">
        <h2 className="text-sm font-semibold text-neutral-950">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="inline-flex h-9 items-center justify-center rounded-md bg-(--prism-ink) px-3 text-xs font-medium text-white shadow-sm transition hover:bg-[#C01867] disabled:cursor-not-allowed disabled:bg-neutral-300"
    >
      {children}
    </button>
  );
}

export function PrismWorkspace({ onOpenFloorPlans }: { onOpenFloorPlans: () => void }) {
  const [state, setState] = useState<PrismDemoState | null>(null);
  const [role, setRole] = useState<DemoRole>("pmcm-admin");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function refresh() {
    setState(await prismApi.state());
  }

  async function run(label: string, action: () => Promise<unknown>) {
    setBusy(label);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(null);
    }
  }

  useEffect(() => {
    refresh().catch((err) => setError(err instanceof Error ? err.message : "Unable to load Prism state"));
  }, []);

  const event = state?.events[0];
  const inquiry = state?.inquiries.find((item) => item.id === event?.inquiryId) ?? state?.inquiries[0];
  const briefing = state?.briefings.find((item) => item.eventId === event?.id);
  const quotes = state?.supplierQuotes.filter((item) => item.eventId === event?.id) ?? [];
  const assignments = state?.coordinatorAssignments.filter((item) => item.eventId === event?.id) ?? [];
  const checks = state?.complianceChecks.filter((item) => item.eventId === event?.id) ?? [];
  const billing = state?.billingStatements.filter((item) => item.eventId === event?.id) ?? [];
  const payments = state?.paymentMilestones.filter((item) => item.eventId === event?.id) ?? [];
  const postDocs = state?.postEventDocuments.filter((item) => item.eventId === event?.id) ?? [];
  const audit = state?.auditLogs.filter((item) => item.eventId === event?.id || !item.eventId) ?? [];

  const totals = useMemo(() => {
    const quoteTotal = quotes.reduce((sum, item) => sum + item.amount, 0);
    const openMustFix = checks.filter((item) => item.layer === "Must-Fix" && item.status === "open").length;
    const paid = payments.filter((item) => item.status === "paid").reduce((sum, item) => sum + item.amount, 0);
    return { quoteTotal, openMustFix, paid };
  }, [checks, payments, quotes]);

  if (!state || !event || !inquiry) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <div className="rounded-lg border border-neutral-200 bg-white p-6 text-sm text-neutral-600">
          {error ? `Unable to load Prism workspace: ${error}` : "Loading Prism workspace..."}
        </div>
      </div>
    );
  }

  const roleHelp: Record<DemoRole, string> = {
    "pmcm-admin": "Full lifecycle command center for Ms. Mys and EA.",
    client: event.clientPortalStatus === "unlocked" ? "Client can submit briefing and view billing." : "Client portal is locked until signed conforme.",
    coordinator: assignments.length ? "Coordinator can acknowledge assigned role." : "No coordinator assignment yet.",
    supplier: quotes.length ? "Supplier quote activity is visible as logged requests." : "No supplier quote activity yet.",
  };

  return (
    <div className="min-h-screen bg-background text-neutral-950">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground">P.R.I.S.M Defense Prism</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-normal">{event.eventName}</h1>
          </div>
          <div className="flex items-center gap-2">
            {(["pmcm-admin", "client", "coordinator", "supplier"] as DemoRole[]).map((item) => (
              <button
                key={item}
                onClick={() => setRole(item)}
                className={cx(
                  "h-9 rounded-md border px-3 text-xs font-medium transition",
                  role === item
                    ? "border-[#C01867] bg-(--prism-ink) text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-primary/40",
                )}
              >
                {roleLabels[item]}
              </button>
            ))}
            <button
              onClick={onOpenFloorPlans}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-primary/40"
            >
              <LayoutGrid size={14} /> Floor plans
            </button>
            <button
              onClick={() => run("reset", prismApi.reset)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:border-primary/40"
            >
              <RotateCcw size={14} /> Reset demo
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_360px] gap-5 px-6 py-5">
        <div className="space-y-5">
          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div className="rounded-lg border border-neutral-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-(--prism-ink)/10 px-2.5 py-1 text-xs font-medium capitalize text-foreground">
                    {statusLabel(event.status)}
                  </span>
                  <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-xs font-medium capitalize text-neutral-700">
                    portal {event.clientPortalStatus}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                    {event.readiness}
                  </span>
                </div>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-neutral-600">{roleHelp[role]}</p>
              </div>
              <div className="text-right text-sm text-neutral-500">
                <div className="font-medium text-neutral-950">{event.clientName}</div>
                <div>{event.eventDate}</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3">
            <Metric label="Quote total" value={money.format(totals.quoteTotal)} icon={ReceiptText} tone="blue" />
            <Metric label="Open Must-Fix" value={totals.openMustFix} icon={ShieldCheck} tone={totals.openMustFix ? "rose" : "emerald"} />
            <Metric label="Payment received" value={money.format(totals.paid)} icon={WalletCards} tone="amber" />
            <Metric label="Audit entries" value={audit.length} icon={ClipboardCheck} tone="emerald" />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <Panel
              title="1. Inquiry and Conforme Gate"
              action={
                <div className="flex gap-2">
                  <ActionButton onClick={() => run("create inquiry", prismApi.createInquiry)} disabled={!!busy}>
                    New inquiry
                  </ActionButton>
                  <ActionButton onClick={() => run("accept inquiry", () => prismApi.acceptInquiry(inquiry.id))} disabled={!!busy}>
                    Accept
                  </ActionButton>
                </div>
              }
            >
              <div className="space-y-3 text-sm">
                <div className="rounded-md bg-neutral-50 p-3">
                  <div className="font-medium">{inquiry.eventName}</div>
                  <div className="mt-1 text-neutral-500">{inquiry.clientType} inquiry from {inquiry.clientName}</div>
                </div>
                <ActionButton onClick={() => run("conforme", () => prismApi.uploadConforme(inquiry.id))} disabled={event.clientPortalStatus === "unlocked" || !!busy}>
                  <FileCheck2 className="mr-1.5" size={14} /> Upload signed conforme
                </ActionButton>
              </div>
            </Panel>

            <Panel
              title="2. Client Briefing"
              action={
                <ActionButton onClick={() => run("briefing", () => prismApi.submitBriefing(event.id))} disabled={event.clientPortalStatus === "locked" || !!busy}>
                  Submit briefing
                </ActionButton>
              }
            >
              {event.clientPortalStatus === "locked" ? (
                <div className="flex items-center gap-2 rounded-md bg-neutral-50 p-3 text-sm text-neutral-500">
                  <Lock size={15} /> Waiting for conforme gate.
                </div>
              ) : briefing ? (
                <div className="space-y-2 text-sm">
                  <div className="font-medium">{briefing.venue}</div>
                  <div className="text-neutral-500">{briefing.guestCount} guests - {briefing.budgetRange}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {briefing.serviceRequirements.map((item) => (
                      <span key={item} className="rounded bg-neutral-100 px-2 py-1 text-xs text-neutral-600">{item}</span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-neutral-500">Client briefing has not been submitted.</p>
              )}
            </Panel>

            <Panel
              title="3. CE Builder and Supplier Quotes"
              action={
                <ActionButton onClick={() => run("quote", () => prismApi.addSupplierQuote(event.id))} disabled={!!busy}>
                  Add quote
                </ActionButton>
              }
            >
              <div className="space-y-2">
                {quotes.map((quote) => (
                  <div key={quote.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
                    <div>
                      <div className="font-medium">{quote.supplierName}</div>
                      <div className="text-xs text-neutral-500">{quote.category} - {quote.status}</div>
                    </div>
                    <div className="font-semibold">{money.format(quote.amount)}</div>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="4. Compliance Engine"
              action={
                <ActionButton onClick={() => run("compliance", () => prismApi.runCompliance(event.id))} disabled={!!busy}>
                  Run checks
                </ActionButton>
              }
            >
              <div className="space-y-2">
                {checks.length === 0 && <p className="text-sm text-neutral-500">No compliance run yet.</p>}
                {checks.map((check) => (
                  <div key={check.id} className="rounded-md border border-neutral-100 p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <span className="text-xs font-semibold text-foreground">{check.layer}</span>
                        <div className="font-medium">{check.title}</div>
                      </div>
                      {check.status === "open" ? (
                        <ActionButton onClick={() => run("resolve compliance", () => prismApi.resolveCompliance(event.id, check.id))} disabled={!!busy}>
                          Resolve
                        </ActionButton>
                      ) : (
                        <CheckCircle2 className="text-emerald-600" size={18} />
                      )}
                    </div>
                    <p className="mt-1 text-xs text-neutral-500">{check.note}</p>
                  </div>
                ))}
              </div>
            </Panel>

            <Panel
              title="5. Coordinator Assignment"
              action={
                <ActionButton onClick={() => run("assign coordinator", () => prismApi.assignCoordinator(event.id))} disabled={!!busy}>
                  Assign
                </ActionButton>
              }
            >
              <div className="space-y-2">
                {assignments.length === 0 && <p className="text-sm text-neutral-500">No coordinator assigned.</p>}
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
                    <div>
                      <div className="font-medium">{assignment.coordinatorName}</div>
                      <div className="text-xs text-neutral-500">{assignment.role} - {statusLabel(assignment.status)}</div>
                    </div>
                    {assignment.status !== "acknowledged" ? (
                      <ActionButton onClick={() => run("ack coordinator", () => prismApi.acknowledgeCoordinator(event.id, assignment.id))} disabled={!!busy}>
                        Ack
                      </ActionButton>
                    ) : (
                      <UserCheck className="text-emerald-600" size={18} />
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="6. Billing and Payments">
              <div className="space-y-2">
                {billing.map((item) => (
                  <div key={item.id} className="rounded-md bg-neutral-50 p-3 text-sm">
                    <div className="flex justify-between font-medium">
                      <span>{item.number}</span>
                      <span>{money.format(item.totalAmount)}</span>
                    </div>
                    <div className="mt-1 text-xs text-neutral-500">Auto-generated on conforme signing</div>
                  </div>
                ))}
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
                    <div>
                      <div className="font-medium">{payment.label}</div>
                      <div className="text-xs text-neutral-500">{money.format(payment.amount)} - {statusLabel(payment.status)}</div>
                    </div>
                    {payment.status !== "paid" && (
                      <ActionButton onClick={() => run("payment", () => prismApi.markPaymentReceived(event.id, payment.id))} disabled={!!busy}>
                        Paid
                      </ActionButton>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel title="7. Event Closure">
              <div className="space-y-2">
                {postDocs.map((document) => (
                  <div key={document.id} className="flex items-center justify-between rounded-md border border-neutral-100 p-3 text-sm">
                    <div>
                      <div className="font-medium">{document.title}</div>
                      <div className="text-xs text-neutral-500">{document.status}</div>
                    </div>
                    {document.status !== "submitted" && (
                      <ActionButton onClick={() => run("post doc", () => prismApi.completePostEventDocument(event.id, document.id))} disabled={!!busy}>
                        Complete
                      </ActionButton>
                    )}
                  </div>
                ))}
                <ActionButton onClick={() => run("archive", () => prismApi.archiveEvent(event.id))} disabled={event.archived || !!busy}>
                  <Archive className="mr-1.5" size={14} /> Archive event
                </ActionButton>
              </div>
            </Panel>

            <Panel title="8. Notification Log">
              <div className="space-y-2">
                {state.notificationLogs.slice(0, 5).map((notification) => (
                  <div key={notification.id} className="flex gap-3 rounded-md border border-neutral-100 p-3 text-sm">
                    {notification.channel === "email" ? <Mail size={16} /> : <Bell size={16} />}
                    <div>
                      <div className="font-medium">{notification.recipient}</div>
                      <div className="text-xs text-neutral-500">{notification.message} - {notification.status}</div>
                    </div>
                  </div>
                ))}
                {state.notificationLogs.length === 0 && <p className="text-sm text-neutral-500">Email and Viber sends are logged here as mock notifications.</p>}
              </div>
            </Panel>
          </div>
        </div>

        <aside className="space-y-5">
          <Panel title="Live Ops Snapshot">
            <div className="space-y-3 text-sm">
              {[
                ["Conforme gate", event.clientPortalStatus === "unlocked" ? "green" : "amber"],
                ["Briefing", briefing ? "green" : "amber"],
                ["Supplier quotes", quotes.length > 1 ? "green" : "amber"],
                ["Compliance", totals.openMustFix === 0 && checks.length ? "green" : "rose"],
                ["Payments", payments.some((item) => item.status === "paid") ? "green" : "amber"],
                ["Closure", event.archived ? "green" : "amber"],
              ].map(([label, tone]) => (
                <div key={label} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
                  <span>{label}</span>
                  <span
                    className={cx(
                      "size-2.5 rounded-full",
                      tone === "green" && "bg-emerald-500",
                      tone === "amber" && "bg-amber-500",
                      tone === "rose" && "bg-rose-500",
                    )}
                  />
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Activity History">
            <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
              {audit.map((item) => (
                <div key={item.id} className="border-l-2 border-[#C01867]/30 pl-3 text-sm">
                  <div className="font-medium">{item.action}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{item.actor}</div>
                </div>
              ))}
            </div>
          </Panel>
        </aside>
      </main>
    </div>
  );
}
