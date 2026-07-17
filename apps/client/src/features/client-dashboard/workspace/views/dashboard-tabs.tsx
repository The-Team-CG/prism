"use client";

import {
  Activity,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileText,
  LockKeyhole,
  MapPinned,
  MessageSquareText,
  Presentation,
  ReceiptText,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import type {
  PrismAuditLog,
  PrismBillingStatement,
  PrismBriefing,
  PrismDocument,
  PrismEvent,
  PrismFloorPlanDraft,
  PrismPaymentMilestone,
} from "@/lib/prism-api";
import { Button } from "@/app/components/ui/button";
import { Skeleton } from "@/app/components/ui/skeleton";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";

type DetailTab = "overview" | "briefing" | "proposal" | "floorplan" | "billing" | "documents" | "activity";

const money = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
  maximumFractionDigits: 0,
});

function formatLabel(value?: string) {
  if (!value) return "Pending";
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .replace(/\bPmcm\b/g, "Event Team");
}

function portalStatusLabel(status: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

function portalBadgeStatus(status: PrismEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

export function clientActivityTitle(action: string) {
  if (/created sample event workspace/i.test(action)) return "Opened event workspace";
  return action
    .replaceAll("_", " ")
    .replace(/\bPMCM Admin\b/gi, "Event team")
    .replace(/\bPMCM\b/gi, "Event team")
    .replace(/\bAdmin\b/gi, "team");
}

export function clientActivityActor(actor: string) {
  return /pmcm|admin/i.test(actor) ? "Event team" : actor;
}

function actorInitials(actor: string) {
  const clean = clientActivityActor(actor);
  return clean
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function groupByDay(items: PrismAuditLog[]) {
  const groups: Map<string, PrismAuditLog[]> = new Map();
  for (const item of items) {
    const day = item.createdAt?.split("T")[0] ?? item.createdAt ?? "Unknown";
    if (!groups.has(day)) groups.set(day, []);
    groups.get(day)!.push(item);
  }
  return groups;
}

function formatDayLabel(day: string) {
  try {
    const date = new Date(day);
    if (Number.isNaN(date.getTime())) return day;
    return new Intl.DateTimeFormat("en-PH", { month: "long", day: "numeric", year: "numeric" }).format(date);
  } catch {
    return day;
  }
}

/* ── Shared primitives ─────────────────────────────────────── */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>
      {children}
    </div>
  );
}

function CardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-6 py-4">{children}</div>;
}

function CardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-6 py-5 ${className}`}>{children}</div>;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>
  );
}

function InfoGrid({ items }: { items: Array<{ label: string; value: React.ReactNode; icon?: LucideIcon }> }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <div key={item.label} className="rounded-xl bg-muted/40 p-4">
          <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
          <p className="mt-1.5 text-sm font-bold text-foreground">{item.value ?? "—"}</p>
        </div>
      ))}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3 not-last:border-b not-last:border-border text-sm">
      <span className="shrink-0 text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

/* ── Overview tab ──────────────────────────────────────────── */

export function ClientOverviewTab({
  selectedEvent,
  briefing,
  payments,
  billing,
  documents,
  audit,
  officialDraft,
  preferenceDraftCount,
  onOpenOfficialFloorplan,
  setTab,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  documents: PrismDocument[];
  audit: PrismAuditLog[];
  officialDraft?: PrismFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  const latestActivity = audit[0];
  const nextPayment = payments.find((p) => p.status !== "paid");
  const openMilestones = payments.filter((p) => p.status !== "paid").length;

  const daysToEvent = (() => {
    if (!selectedEvent.eventDate) return "—";
    try {
      const diff = Math.ceil(
        (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff > 0 ? `${diff}d` : "Today";
    } catch {
      return "—";
    }
  })();

  return (
    <div className="space-y-5">
      {/* Lifecycle strip */}
      <Card>
        <CardHeader>
          <SectionLabel>Event lifecycle</SectionLabel>
          <h2 className="mt-1 text-base font-bold text-foreground">Planning progress</h2>
        </CardHeader>
        <CardBody>
          <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
            {[
              { label: "Inquiry accepted", state: "done" },
              { label: "Conforme signed", state: selectedEvent.clientPortalStatus === "unlocked" ? "done" : "pending" },
              { label: "Briefing / proposal", state: briefing && billing ? "done" : "current" },
              { label: "Planning", state: officialDraft?.status === "approved" ? "done" : "current" },
              { label: "Event day", state: "pending" },
              { label: "Closure", state: "pending" },
            ].map((step, i) => (
              <div
                key={step.label}
                className={`rounded-lg px-3 py-2.5 text-sm ${
                  step.state === "done"
                    ? "bg-(--prism-success)/10 border border-(--prism-success)/20"
                    : step.state === "current"
                      ? "bg-(--prism-signal-soft) border border-(--prism-signal)/20"
                      : "bg-muted/40 border border-border"
                }`}
              >
                <p className="text-[10px] font-bold text-muted-foreground">Step {i + 1}</p>
                <p className={`mt-1 text-xs font-bold ${
                  step.state === "done" ? "text-(--prism-success)"
                  : step.state === "current" ? "text-(--prism-signal)"
                  : "text-muted-foreground"
                }`}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Stats row */}
      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Days to event", value: daysToEvent, icon: Timer, color: "text-(--prism-signal)" },
          { label: "Open milestones", value: openMilestones || "0", icon: WalletCards, color: "text-(--prism-amber)" },
          { label: "Documents on file", value: documents.length || "0", icon: FileText, color: "text-(--prism-success)" },
        ].map((stat) => (
          <div key={stat.label} className="flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
            <span className={`grid size-11 shrink-0 place-items-center rounded-xl bg-muted ${stat.color}`}>
              <stat.icon className="size-5" />
            </span>
            <div>
              <p className="text-2xl font-black leading-none text-foreground">{stat.value}</p>
              <p className="mt-1 text-xs font-semibold text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Two-col: event details + layout checkpoint */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Event details</h3>
            </div>
          </CardHeader>
          <CardBody className="py-2">
            <DataRow label="Event name" value={selectedEvent.eventName} />
            <DataRow label="Primary contact" value={selectedEvent.clientName} />
            <DataRow label="Date" value={selectedEvent.eventDate ?? "Pending"} />
            <DataRow label="Status" value={<StatusBadge status={selectedEvent.status} />} />
            <DataRow label="Readiness" value={selectedEvent.readiness ?? "Pending"} />
            <DataRow
              label="Portal access"
              value={
                <StatusBadge
                  status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                  label={portalStatusLabel(selectedEvent.clientPortalStatus)}
                />
              }
            />
            <DataRow label="Venue" value={briefing?.venue ?? "To be confirmed"} />
            <DataRow label="Guests" value={briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"} />
          </CardBody>
        </Card>

        <div className="space-y-4">
          {/* Layout checkpoint */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <MapPinned className="size-4 text-(--prism-signal)" />
                  <h3 className="text-sm font-bold text-foreground">Floor plan</h3>
                </div>
                {officialDraft && <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} />}
              </div>
            </CardHeader>
            <CardBody className="py-2">
              <DataRow label="Preference drafts" value={preferenceDraftCount || "None yet"} />
              <DataRow label="Official layout" value={officialDraft ? formatLabel(officialDraft.status) : "Not published"} />
              <DataRow label="Last update" value={officialDraft?.updatedAt ?? "—"} />
            </CardBody>
            <div className="px-6 pb-5">
              <Button
                className="w-full rounded-xl font-bold"
                onClick={officialDraft && onOpenOfficialFloorplan ? onOpenOfficialFloorplan : () => setTab("floorplan")}
              >
                {officialDraft ? "Open floor plan" : "Set layout preferences"} <ArrowRight className="size-4" />
              </Button>
            </div>
          </Card>

          {/* Next payment */}
          {(billing || nextPayment) && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <ReceiptText className="size-4 text-(--prism-amber)" />
                  <h3 className="text-sm font-bold text-foreground">Next payment</h3>
                </div>
              </CardHeader>
              <CardBody className="py-2">
                {nextPayment ? (
                  <>
                    <DataRow label="Milestone" value={nextPayment.label} />
                    <DataRow label="Due" value={nextPayment.dueDate} />
                    <DataRow label="Amount" value={money.format(nextPayment.amount)} />
                  </>
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">All milestones settled.</p>
                )}
              </CardBody>
              <div className="px-6 pb-5">
                <Button variant="outline" className="w-full rounded-xl font-semibold" onClick={() => setTab("billing")}>
                  View billing
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Recent activity */}
      {(documents.length > 0 || latestActivity) && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Recent activity</h3>
            </div>
          </CardHeader>
          <CardBody className="py-2">
            <DataRow label="Documents on file" value={`${documents.length} file${documents.length === 1 ? "" : "s"}`} />
            {latestActivity && (
              <>
                <DataRow label="Latest update" value={clientActivityTitle(latestActivity.action)} />
                <DataRow label="Updated by" value={`${clientActivityActor(latestActivity.actor)} — ${latestActivity.createdAt}`} />
              </>
            )}
          </CardBody>
          <div className="flex gap-2 px-6 pb-5">
            <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => setTab("documents")}>
              Documents
            </Button>
            <Button variant="outline" className="flex-1 rounded-xl font-semibold" onClick={() => setTab("activity")}>
              Activity log
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}

/* ── Briefing tab ──────────────────────────────────────────── */

export function ClientBriefingTab({ briefing }: { briefing?: PrismBriefing }) {
  const isComplete = Boolean(
    briefing?.venue && briefing?.guestCount && briefing?.serviceRequirements?.length,
  );

  return (
    <div className="space-y-4">
      <div className={`rounded-2xl border px-5 py-4 ${
        isComplete
          ? "border-(--prism-success)/25 bg-(--prism-success)/8"
          : "border-(--prism-amber)/25 bg-(--prism-amber-soft)"
      }`}>
        <p className={`text-sm font-bold ${isComplete ? "text-(--prism-success)" : "text-(--prism-amber)"}`}>
          {isComplete ? "Briefing complete" : "Briefing in progress"}
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          {isComplete
            ? "All core briefing details are on file."
            : "Your event team is still confirming the venue, guest count, and service requirements."}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileCheck2 className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Event briefing</h2>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">Confirmed details from your PMCM event team</p>
        </CardHeader>
        <CardBody>
          {briefing ? (
            <InfoGrid items={[
              { label: "Venue", value: briefing.venue },
              { label: "Guest count", value: `${briefing.guestCount} guests` },
              { label: "Budget range", value: briefing.budgetRange },
              { label: "Service requirements", value: briefing.serviceRequirements.join(", ") },
            ]} />
          ) : (
            <EmptyState
              icon={FileCheck2}
              title="No briefing yet"
              description="Confirmed venue, schedule, guest count, budget, and service notes will appear here."
            />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Proposal tab ──────────────────────────────────────────── */

export function ClientProposalTab({
  selectedEvent,
  briefing,
  billing,
  payments,
  officialDraft,
  setTab,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  payments: PrismPaymentMilestone[];
  officialDraft?: PrismFloorPlanDraft;
  setTab: (tab: DetailTab) => void;
}) {
  const nextPayment = payments.find((p) => p.status !== "paid");
  const proposalReady = Boolean(briefing && billing);

  return (
    <div className="space-y-5">
      {/* Status hero */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <SectionLabel>Proposal status</SectionLabel>
              <h2 className="mt-1 text-xl font-black text-foreground">
                {proposalReady ? "Proposal ready for review." : "PMCM is preparing your proposal."}
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
                This view summarizes your briefing, planning package, payment schedule, and layout status. Internal cost estimation stays with PMCM.
              </p>
              {proposalReady && (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button className="rounded-lg font-bold">
                    <ThumbsUp className="size-4" /> Approve proposal
                  </Button>
                  <Button variant="outline" className="rounded-lg font-semibold">
                    Request revision
                  </Button>
                </div>
              )}
            </div>
            <StatusBadge
              status={proposalReady ? "ready" : "pending"}
              label={proposalReady ? "Ready for review" : "In preparation"}
            />
          </div>
        </CardBody>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* Package details */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Presentation className="size-4 text-(--prism-signal)" />
                <h3 className="text-sm font-bold text-foreground">Proposal package</h3>
              </div>
              <StatusBadge
                status={proposalReady ? "ready" : "pending"}
                label={proposalReady ? "Ready" : "In preparation"}
              />
            </div>
          </CardHeader>
          <CardBody className="py-2">
            <DataRow label="Event" value={selectedEvent.eventName} />
            <DataRow label="Stage" value={proposalReady ? "Client review" : "PMCM preparation"} />
            <DataRow
              label="Briefing basis"
              value={briefing ? `${briefing.guestCount} guests at ${briefing.venue}` : "Waiting for briefing"}
            />
            <DataRow
              label="Billing statement"
              value={billing ? `${billing.number} — ${formatLabel(billing.status)}` : "Not issued"}
            />
            <DataRow
              label="Official layout"
              value={officialDraft ? formatLabel(officialDraft.status) : "Not published"}
            />
            <DataRow
              label="Next payment"
              value={nextPayment ? `${nextPayment.label} on ${nextPayment.dueDate}` : "No open milestone"}
            />
          </CardBody>
        </Card>

        {/* Review checklist */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquareText className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">Review checklist</h3>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {[
              {
                label: "Briefing details",
                value: briefing ? "Ready" : "Waiting",
                status: briefing ? "approved" : "pending",
                action: () => setTab("briefing"),
              },
              {
                label: "Planning package",
                value: proposalReady ? "Ready for review" : "In preparation",
                status: proposalReady ? "ready" : "pending",
                action: () => setTab("proposal"),
              },
              {
                label: "Official layout",
                value: officialDraft ? formatLabel(officialDraft?.status) : "Not published",
                status: officialDraft?.status ?? "pending",
                action: () => setTab("floorplan"),
              },
              {
                label: "Billing milestones",
                value: billing ? formatLabel(billing.status) : "Not issued",
                status: billing?.status ?? "pending",
                action: () => setTab("billing"),
              },
            ].map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left transition hover:bg-muted/40"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.value}</span>
                </span>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ── Billing tab ───────────────────────────────────────────── */

export function ClientBillingTab({
  payments,
  billing,
}: {
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
}) {
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalAmount = billing?.totalAmount ?? payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalAmount - totalPaid;

  return (
    <div className="space-y-5">
      {/* Summary stats */}
      {totalAmount > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total contract", value: money.format(totalAmount), color: "text-foreground" },
            { label: "Paid to date", value: money.format(totalPaid), color: "text-(--prism-success)" },
            { label: "Balance due", value: money.format(balance), color: balance > 0 ? "text-(--prism-amber)" : "text-(--prism-success)" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
              <p className="text-xs font-semibold text-muted-foreground">{stat.label}</p>
              <p className={`mt-1.5 text-2xl font-black ${stat.color}`}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Billing statement ref */}
      {billing && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-5 py-3.5">
          <div>
            <p className="text-xs font-semibold text-muted-foreground">Billing statement</p>
            <p className="mt-0.5 text-sm font-bold text-foreground">{billing.number}</p>
          </div>
          <StatusBadge status={billing.status} label={formatLabel(billing.status)} />
        </div>
      )}

      {/* Milestones */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <WalletCards className="size-4 text-(--prism-signal)" />
            <h2 className="text-sm font-bold text-foreground">Payment milestones</h2>
          </div>
        </CardHeader>
        <CardBody>
          {payments.length === 0 ? (
            <EmptyState
              icon={ReceiptText}
              title="No payment milestones yet"
              description="Milestones appear after the billing statement linked to the approved proposal is posted."
            />
          ) : (
            <div className="space-y-3">
              {payments.map((payment, index) => {
                const done = payment.status === "paid";
                return (
                  <div key={payment.id} className="relative grid grid-cols-[2rem_minmax(0,1fr)] gap-3">
                    {index < payments.length - 1 && (
                      <span className={`absolute bottom-0 left-4 top-8 w-px ${done ? "bg-(--prism-success)/30" : "bg-border"}`} />
                    )}
                    <span className={`relative z-10 mt-1 grid size-8 place-items-center rounded-full text-sm ${
                      done ? "bg-(--prism-success) text-white" : "bg-muted ring-1 ring-border text-muted-foreground"
                    }`}>
                      {done ? <CheckCircle2 className="size-4" /> : <span className="text-[10px] font-black">{index + 1}</span>}
                    </span>
                    <div className={`rounded-xl border p-4 ${done ? "border-(--prism-success)/20 bg-(--prism-success)/5" : "border-border bg-muted/30"}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-foreground">{payment.label}</p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <CalendarDays className="size-3" /> {payment.dueDate}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-base font-black text-foreground">{money.format(payment.amount)}</p>
                          <StatusBadge status={payment.status} label={formatLabel(payment.status)} className="mt-1" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

/* ── Documents tab ─────────────────────────────────────────── */

const docCategories: Record<string, string[]> = {
  "Conforme & MOA": ["conforme", "moa", "nda", "contract"],
  Proposals: ["proposal", "briefing", "budget"],
  Floorplans: ["floorplan", "layout", "floor_plan"],
};

function categorizeDoc(doc: PrismDocument) {
  const key = `${doc.fileName} ${doc.type}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(docCategories)) {
    if (keywords.some((kw) => key.includes(kw))) return cat;
  }
  return "Other";
}

export function ClientDocumentsTab({ documents }: { documents: PrismDocument[] }) {
  if (documents.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={LockKeyhole}
            title="No documents yet"
            description="Signed conforme files, billing statements, and approval documents will appear here."
          />
        </CardBody>
      </Card>
    );
  }

  const groups = new Map<string, PrismDocument[]>();
  for (const doc of documents) {
    const cat = categorizeDoc(doc);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(doc);
  }

  const receivedCount = documents.filter((d) => d.status === "approved" || d.status === "received").length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-(--prism-signal-soft) text-(--prism-signal)">
          <FileText className="size-5" />
        </span>
        <div>
          <p className="text-base font-bold text-foreground">
            {receivedCount} of {documents.length} document{documents.length === 1 ? "" : "s"} received
          </p>
          <p className="text-xs text-muted-foreground">Signed conforme, billing statements, and approval documents</p>
        </div>
      </div>

      {Array.from(groups.entries()).map(([cat, docs]) => (
        <Card key={cat}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-(--prism-signal)" />
              <h3 className="text-sm font-bold text-foreground">{cat}</h3>
              <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{docs.length}</span>
            </div>
          </CardHeader>
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between gap-4 px-6 py-3.5">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground">
                    <FileText className="size-3.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{doc.fileName}</p>
                    <p className="text-xs text-muted-foreground">{formatLabel(doc.type)} — {doc.uploadedAt}</p>
                  </div>
                </div>
                <StatusBadge status={doc.status} label={formatLabel(doc.status)} />
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

/* ── Activity tab ──────────────────────────────────────────── */

export function ClientActivityTab({ audit }: { audit: PrismAuditLog[] }) {
  if (audit.length === 0) {
    return (
      <Card>
        <CardBody>
          <EmptyState
            icon={Activity}
            title="No activity yet"
            description="Event changes, approvals, and client-visible updates will appear here."
          />
        </CardBody>
      </Card>
    );
  }

  const grouped = groupByDay(audit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-(--prism-signal)" />
          <h2 className="text-sm font-bold text-foreground">Event activity</h2>
        </div>
      </CardHeader>
      <CardBody>
        <div className="space-y-6">
          {Array.from(grouped.entries()).map(([day, items]) => (
            <div key={day}>
              <div className="mb-3 flex items-center gap-3">
                <span className="h-px flex-1 bg-border" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  {formatDayLabel(day)}
                </span>
                <span className="h-px flex-1 bg-border" />
              </div>
              <div className="space-y-3">
                {items.map((item) => (
                  <div key={item.id} className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-muted text-xs font-bold text-foreground">
                      {actorInitials(item.actor)}
                    </span>
                    <div className="min-w-0 flex-1 rounded-xl bg-muted/40 px-4 py-3">
                      <p className="text-sm font-semibold text-foreground">
                        {clientActivityTitle(item.action)}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {clientActivityActor(item.actor)} — {item.createdAt}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

/* Skeleton */

type DashboardSkeletonVariant = "home" | "request" | "events" | "event" | "floorplan" | "messages";

function SkeletonLine({ className }: { className?: string }) {
  return <Skeleton className={className} />;
}

function SkeletonCard({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border/80 bg-card/95 p-4 shadow-sm ring-1 ring-black/5 sm:p-5 ${className ?? ""}`}
    >
      <span className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-(--prism-signal)/60 via-transparent to-transparent" />
      {children}
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-3 w-28 rounded-full" />
      <SkeletonLine className="mt-3 h-7 w-full max-w-sm rounded-md" />
      <SkeletonLine className="mt-3 h-4 w-full max-w-2xl rounded-md" />
      <div className="mt-4 flex flex-wrap gap-2">
        <SkeletonLine className="h-7 w-24 rounded-md" />
        <SkeletonLine className="h-7 w-28 rounded-md" />
        <SkeletonLine className="h-7 w-32 rounded-md" />
      </div>
    </SkeletonCard>
  );
}

function MetricGridSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <SkeletonCard key={index} className="min-h-24">
          <div className="flex items-center gap-3">
            <SkeletonLine className="size-10 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-5 w-20 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-28 rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <SkeletonCard>
      <SkeletonLine className="h-4 w-36 rounded-md" />
      <div className="mt-4 divide-y divide-border">
        {Array.from({ length: rows }).map((_, index) => (
          <div key={index} className="flex items-center gap-3 py-3">
            <SkeletonLine className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-4 w-3/5 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
            </div>
            <SkeletonLine className="h-7 w-20 rounded-md" />
          </div>
        ))}
      </div>
    </SkeletonCard>
  );
}

function EventWorkspaceSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-2 sm:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <SkeletonCard key={index} className="min-h-28">
            <SkeletonLine className="size-8 rounded-md" />
            <SkeletonLine className="mt-4 h-4 w-24 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-full rounded-md" />
          </SkeletonCard>
        ))}
      </div>
      <MetricGridSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ListSkeleton rows={4} />
        <SkeletonCard className="min-h-72">
          <SkeletonLine className="h-4 w-32 rounded-md" />
          <SkeletonLine className="mt-5 h-28 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
          <SkeletonLine className="mt-2 h-4 w-1/2 rounded-md" />
        </SkeletonCard>
      </div>
    </div>
  );
}

function RequestSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <SkeletonCard>
        <SkeletonLine className="h-3 w-32 rounded-full" />
        <SkeletonLine className="mt-3 h-7 w-72 rounded-md" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index}>
              <SkeletonLine className="h-3 w-24 rounded-md" />
              <SkeletonLine className="mt-2 h-10 w-full rounded-lg" />
            </div>
          ))}
        </div>
        <SkeletonLine className="mt-4 h-28 w-full rounded-lg" />
        <SkeletonLine className="mt-5 h-11 w-40 rounded-md" />
      </SkeletonCard>
      <div className="space-y-4">
        <SkeletonCard className="min-h-48">
          <SkeletonLine className="h-3 w-32 rounded-full" />
          <SkeletonLine className="mt-5 h-4 w-full rounded-md" />
          <SkeletonLine className="mt-3 h-4 w-5/6 rounded-md" />
          <SkeletonLine className="mt-3 h-4 w-3/4 rounded-md" />
        </SkeletonCard>
        <ListSkeleton rows={3} />
      </div>
    </div>
  );
}

function EventsSkeleton() {
  return (
    <div className="space-y-5">
      <SkeletonCard>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-3 w-24 rounded-full" />
            <SkeletonLine className="mt-3 h-7 w-72 max-w-full rounded-md" />
            <SkeletonLine className="mt-3 h-4 w-full max-w-lg rounded-md" />
          </div>
          <SkeletonLine className="h-10 w-36 rounded-md" />
        </div>
        <SkeletonLine className="mt-5 h-10 w-full max-w-md rounded-lg" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLine key={index} className="h-8 w-28 rounded-full" />
          ))}
        </div>
      </SkeletonCard>
      <div className="grid gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <SkeletonCard key={index}>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_9rem] lg:items-center">
              <div>
                <SkeletonLine className="h-5 w-64 max-w-full rounded-md" />
                <SkeletonLine className="mt-2 h-4 w-44 rounded-md" />
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <SkeletonLine className="h-9 rounded-md" />
                  <SkeletonLine className="h-9 rounded-md" />
                  <SkeletonLine className="h-9 rounded-md" />
                </div>
              </div>
              <SkeletonLine className="h-10 w-36 rounded-md" />
            </div>
          </SkeletonCard>
        ))}
      </div>
    </div>
  );
}

function FloorplanSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_25rem]">
        <SkeletonCard className="min-h-[28rem]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <SkeletonLine className="h-3 w-40 rounded-full" />
              <SkeletonLine className="mt-3 h-6 w-56 rounded-md" />
              <SkeletonLine className="mt-3 h-4 w-full max-w-lg rounded-md" />
            </div>
            <SkeletonLine className="h-7 w-24 rounded-md" />
          </div>
          <SkeletonLine className="mt-6 aspect-[16/9] h-auto w-full rounded-lg" />
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <SkeletonLine className="h-20 rounded-lg" />
            <SkeletonLine className="h-20 rounded-lg" />
          </div>
        </SkeletonCard>
        <SkeletonCard>
          <SkeletonLine className="h-5 w-44 rounded-md" />
          {Array.from({ length: 5 }).map((_, index) => (
            <div key={index} className="mt-4">
              <SkeletonLine className="h-3 w-28 rounded-md" />
              <SkeletonLine className="mt-2 h-10 w-full rounded-lg" />
            </div>
          ))}
          <SkeletonLine className="mt-5 h-11 w-full rounded-lg" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function DashboardSkeleton({ variant = "event" }: { variant?: DashboardSkeletonVariant }) {
  if (variant === "request") return <RequestSkeleton />;
  if (variant === "events") return <EventsSkeleton />;
  if (variant === "floorplan") return <FloorplanSkeleton />;
  if (variant === "messages") {
    return (
      <div className="space-y-5">
        <HeaderSkeleton />
        <ListSkeleton rows={6} />
      </div>
    );
  }
  if (variant === "event") return <EventWorkspaceSkeleton />;

  return (
    <div className="space-y-5">
      <SkeletonCard className="min-h-48">
        <SkeletonLine className="h-3 w-28 rounded-full" />
        <SkeletonLine className="mt-4 h-8 w-full max-w-md rounded-md" />
        <SkeletonLine className="mt-3 h-4 w-full max-w-2xl rounded-md" />
        <div className="mt-6 flex flex-wrap gap-2">
          <SkeletonLine className="h-10 w-32 rounded-md" />
          <SkeletonLine className="h-10 w-28 rounded-md" />
        </div>
      </SkeletonCard>
      <MetricGridSkeleton />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <ListSkeleton rows={4} />
        <SkeletonCard className="min-h-64">
          <SkeletonLine className="h-4 w-36 rounded-md" />
          <SkeletonLine className="mt-5 h-28 w-full rounded-lg" />
          <SkeletonLine className="mt-4 h-4 w-3/4 rounded-md" />
          <SkeletonLine className="mt-2 h-4 w-1/2 rounded-md" />
        </SkeletonCard>
      </div>
    </div>
  );
}

export function DashboardRightRailSkeleton() {
  return (
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <SkeletonCard key={index}>
          <div className="flex items-start gap-3">
            <SkeletonLine className="size-9 shrink-0 rounded-md" />
            <div className="min-w-0 flex-1">
              <SkeletonLine className="h-3 w-24 rounded-full" />
              <SkeletonLine className="mt-3 h-4 w-32 rounded-md" />
              <SkeletonLine className="mt-2 h-3 w-full rounded-md" />
            </div>
          </div>
        </SkeletonCard>
      ))}
    </div>
  );
}

export function DashboardSessionSkeleton() {
  return (
    <main className="grid min-h-screen place-items-center bg-background px-6">
      <section className="w-full max-w-sm rounded-xl border border-border/80 bg-card/95 p-5 shadow-sm ring-1 ring-black/5">
        <div className="flex items-center gap-3">
          <SkeletonLine className="size-11 rounded-md" />
          <div className="min-w-0 flex-1">
            <SkeletonLine className="h-4 w-28 rounded-md" />
            <SkeletonLine className="mt-2 h-3 w-36 rounded-md" />
          </div>
        </div>
        <SkeletonLine className="mt-5 h-3 w-full rounded-md" />
        <SkeletonLine className="mt-2 h-3 w-4/5 rounded-md" />
      </section>
    </main>
  );
}
