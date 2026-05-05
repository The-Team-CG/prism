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
  Star,
  ThumbsUp,
  Timer,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import type {
  MvpAuditLog,
  MvpBillingStatement,
  MvpBriefing,
  MvpDocument,
  MvpEvent,
  MvpFloorPlanDraft,
  MvpPaymentMilestone,
} from "@/lib/mvp-api";
import { Button } from "../ui/button";
import { Skeleton } from "../ui/skeleton";
import { StatusBadge } from "../ui/status-badge";
import { EmptyState } from "../ui/empty-state";

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
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/\bPmcm\b/g, "Event Team");
}

function portalStatusLabel(status: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "Conforme signed" : "Portal locked";
}

function portalBadgeStatus(status: MvpEvent["clientPortalStatus"]) {
  return status === "unlocked" ? "approved" : "locked";
}

function clientActivityTitle(action: string) {
  if (/created demo event workspace/i.test(action)) return "Opened event workspace";
  return action
    .replaceAll("_", " ")
    .replace(/\bPMCM Admin\b/gi, "Event team")
    .replace(/\bPMCM\b/gi, "Event team")
    .replace(/\bAdmin\b/gi, "team");
}

function clientActivityActor(actor: string) {
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

function groupByDay(items: MvpAuditLog[]) {
  const groups: Map<string, MvpAuditLog[]> = new Map();
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

/** Elevated section panel matching the shared design system */
function SectionPanel({
  icon: Icon,
  title,
  description,
  children,
  aside,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-card shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border bg-muted/40 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-black tracking-normal text-foreground">{title}</h3>
            {description ? (
              <p className="mt-0.5 text-xs leading-5 text-muted-foreground">{description}</p>
            ) : null}
          </div>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </header>
      <div className="p-4 sm:p-5">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 py-2.5 text-sm not-last:border-b not-last:border-border sm:grid-cols-[10rem_minmax(0,1fr)] sm:items-start sm:gap-4">
      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className="wrap-break-word font-semibold text-foreground">{value}</span>
    </div>
  );
}

/** 3-column metric stat bar */
function MetricBar({
  stats,
}: {
  stats: Array<{ label: string; value: React.ReactNode; icon: LucideIcon }>;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="group relative flex items-center gap-3 overflow-hidden rounded-lg border border-border bg-card p-4 transition hover:border-primary/25"
        >
          <span className="absolute inset-x-0 top-0 h-0.5 bg-(--prism-signal) opacity-0 transition group-hover:opacity-100" />
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <stat.icon className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-xl font-black leading-none text-foreground">{stat.value}</p>
            <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
              {stat.label}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  selectedEvent: MvpEvent;
  briefing?: MvpBriefing;
  payments: MvpPaymentMilestone[];
  billing?: MvpBillingStatement;
  documents: MvpDocument[];
  audit: MvpAuditLog[];
  officialDraft?: MvpFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  const latestActivity = audit[0];
  const nextPayment = payments.find((payment) => payment.status !== "paid") ?? payments[0];
  const portalOpen = selectedEvent.clientPortalStatus === "unlocked";
  const openMilestones = payments.filter((p) => p.status !== "paid").length;

  const daysToEvent = (() => {
    if (!selectedEvent.eventDate) return "-";
    try {
      const diff = Math.ceil(
        (new Date(selectedEvent.eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
      );
      return diff > 0 ? `${diff}d` : "Today";
    } catch {
      return "-";
    }
  })();

  return (
    <div className="flex flex-col gap-4">
      {/* Next action hero */}
      <div className="rounded-lg border-l-4 border-l-(--prism-signal) border-border bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--prism-signal)">
              Next action
            </p>
            <h2 className="mt-1 text-xl font-black leading-tight text-foreground">
              {portalOpen
                ? (officialDraft ? "Review official floorplan" : "Submit layout preferences")
                : "Await conforme confirmation"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {portalOpen
                ? officialDraft
                  ? "Your event team has published an official layout. Open the floor plan to review it."
                  : "Submit your seating, stage, and flow preferences so your event team can build the official layout."
                : "The client portal opens after the inquiry is accepted and the signed conforme is uploaded."}
            </p>
          </div>
          <StatusBadge
            status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
            label={portalStatusLabel(selectedEvent.clientPortalStatus)}
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            onClick={
              officialDraft && onOpenOfficialFloorplan
                ? onOpenOfficialFloorplan
                : () => setTab("floorplan")
            }
            className="h-10 rounded-md font-black"
          >
            {officialDraft ? "Open floor plan" : "Open layout"} <ArrowRight className="size-4" />
          </Button>
          <Button variant="outline" onClick={() => setTab("documents")} className="h-10 rounded-md font-bold">
            View documents
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <MetricBar
        stats={[
          { label: "Days to event", value: daysToEvent, icon: Timer },
          { label: "Open milestones", value: openMilestones || "-", icon: WalletCards },
          { label: "Documents", value: documents.length || "-", icon: FileText },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionPanel icon={ClipboardList} title="Event overview">
          <div className="divide-y divide-border">
            <DataRow label="Event name" value={selectedEvent.eventName} />
            <DataRow label="Primary contact" value={selectedEvent.clientName} />
            <DataRow label="Date" value={selectedEvent.eventDate ?? "Pending"} />
            <DataRow label="Event status" value={<StatusBadge status={selectedEvent.status} />} />
            <DataRow label="Readiness" value={selectedEvent.readiness ?? "Pending"} />
            <DataRow
              label="Conforme gate"
              value={
                <StatusBadge
                  status={portalBadgeStatus(selectedEvent.clientPortalStatus)}
                  label={portalStatusLabel(selectedEvent.clientPortalStatus)}
                />
              }
            />
            <DataRow label="Venue" value={briefing?.venue ?? "To be confirmed"} />
            <DataRow
              label="Guest count"
              value={briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"}
            />
          </div>
        </SectionPanel>

        <SectionPanel
          icon={MapPinned}
          title="Layout checkpoint"
          aside={
            officialDraft ? (
              <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} />
            ) : undefined
          }
        >
          <p className="text-sm leading-6 text-muted-foreground">
            Preference drafts are separate from the official floorplan. When the official version is published,
            this becomes the client review space.
          </p>
          <div className="mt-3 divide-y divide-border">
            <DataRow label="Preference drafts" value={preferenceDraftCount || "None yet"} />
            <DataRow
              label="Official layout"
              value={officialDraft ? formatLabel(officialDraft.status) : "Not published"}
            />
            <DataRow label="Last update" value={officialDraft?.updatedAt ?? "Pending"} />
          </div>
          <Button
            onClick={
              officialDraft && onOpenOfficialFloorplan
                ? onOpenOfficialFloorplan
                : () => setTab("floorplan")
            }
            className="mt-5 min-h-10 w-full rounded-lg font-bold"
          >
            {officialDraft ? "Open floor plan" : "Open layout preferences"}{" "}
            <ArrowRight className="size-4" />
          </Button>
        </SectionPanel>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionPanel
          icon={WalletCards}
          title="Billing milestones"
          aside={
            billing ? (
              <span className="text-xs font-bold text-muted-foreground">
                {money.format(billing.totalAmount)} total
              </span>
            ) : undefined
          }
        >
          {billing || nextPayment ? (
            <div className="divide-y divide-border">
              {billing ? (
                <>
                  <DataRow label="Statement" value={billing.number} />
                  <DataRow label="Status" value={<StatusBadge status={billing.status} />} />
                </>
              ) : null}
              {nextPayment ? (
                <>
                  <DataRow label="Next milestone" value={nextPayment.label} />
                  <DataRow label="Due date" value={nextPayment.dueDate} />
                  <DataRow label="Amount" value={money.format(nextPayment.amount)} />
                </>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={ReceiptText}
              title="No milestones yet"
              description="Payment milestones appear after the billing statement is posted."
            />
          )}
          <Button
            variant="outline"
            onClick={() => setTab("billing")}
            className="mt-4 min-h-10 w-full rounded-lg font-bold sm:w-auto"
          >
            Open billing
          </Button>
        </SectionPanel>

        <SectionPanel icon={FileText} title="Documents and activity">
          {documents.length || latestActivity ? (
            <div className="divide-y divide-border">
              <DataRow
                label="Documents"
                value={`${documents.length} file${documents.length === 1 ? "" : "s"}`}
              />
              <DataRow
                label="Latest update"
                value={
                  latestActivity ? clientActivityTitle(latestActivity.action) : "No activity yet"
                }
              />
              {latestActivity ? (
                <DataRow
                  label="Updated by"
                  value={`${clientActivityActor(latestActivity.actor)} - ${latestActivity.createdAt}`}
                />
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={FileText}
              title="No documents or updates yet"
              description="Files, approvals, and event updates appear here as planning moves forward."
            />
          )}
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <Button
              variant="outline"
              onClick={() => setTab("documents")}
              className="min-h-10 rounded-lg font-bold"
            >
              Open documents
            </Button>
            <Button
              variant="outline"
              onClick={() => setTab("activity")}
              className="min-h-10 rounded-lg font-bold"
            >
              Open activity
            </Button>
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

export function ClientBriefingTab({ briefing }: { briefing?: MvpBriefing }) {
  const isComplete = Boolean(
    briefing?.venue && briefing?.guestCount && briefing?.serviceRequirements?.length,
  );

  return (
    <div className="flex flex-col gap-4">
      <div
        className={`rounded-lg border-l-4 px-4 py-3 text-sm ${
          isComplete
            ? "border-l-(--prism-success) border-(--prism-success)/20 bg-(--prism-success)/8 text-(--prism-success)"
            : "border-l-(--prism-amber) border-(--prism-amber)/20 bg-(--prism-amber)/8 text-(--prism-amber)"
        }`}
      >
        <p className="font-black">
          {isComplete ? "Briefing complete" : "Briefing in progress"}
        </p>
        <p className={`mt-0.5 text-xs leading-5 ${isComplete ? "" : "text-muted-foreground"}`}>
          {isComplete
            ? "All core briefing details are on file."
            : "Your event team is still confirming the venue, guest count, and service requirements."}
        </p>
      </div>

      <SectionPanel icon={FileCheck2} title="Event briefing" description="Confirmed details from PMCM">
        {briefing ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              { label: "Venue", value: briefing.venue, icon: MapPinned },
              { label: "Guest count", value: `${briefing.guestCount} guests`, icon: CheckCircle2 },
              { label: "Budget range", value: briefing.budgetRange, icon: WalletCards },
              {
                label: "Services",
                value: briefing.serviceRequirements.join(", "),
                icon: ClipboardList,
              },
            ].map((field) => (
              <div
                key={field.label}
                className="rounded-lg bg-background/75 p-3.5"
              >
                <div className="flex items-center gap-2">
                  <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <field.icon className="size-3.5" />
                  </span>
                  <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                    {field.label}
                  </p>
                </div>
                <p className="mt-2 text-sm font-bold text-foreground">{field.value}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={FileCheck2}
            title="No briefing yet"
            description="The confirmed venue, schedule, guest count, budget, and service notes will appear here."
          />
        )}
      </SectionPanel>
    </div>
  );
}

export function ClientProposalTab({
  selectedEvent,
  briefing,
  billing,
  payments,
  officialDraft,
  setTab,
}: {
  selectedEvent: MvpEvent;
  briefing?: MvpBriefing;
  billing?: MvpBillingStatement;
  payments: MvpPaymentMilestone[];
  officialDraft?: MvpFloorPlanDraft;
  setTab: (tab: DetailTab) => void;
}) {
  const nextPayment = payments.find((payment) => payment.status !== "paid");
  const proposalReady = Boolean(briefing && billing);
  const layoutReady = Boolean(officialDraft);

  return (
    <div className="flex flex-col gap-4">
      {/* Status banner */}
      <div className="rounded-lg border border-primary/15 bg-secondary/60 p-5">
        <p className="text-[10px] font-black uppercase tracking-widest text-(--prism-signal)">
          Proposal status
        </p>
        <h3 className="mt-1 text-xl font-black leading-tight text-foreground">
          {proposalReady ? "Proposal ready for review." : "PMCM is preparing your proposal."}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This view summarizes the briefing, planning package, payment schedule, and layout status.
          Internal cost estimation stays with PMCM.
        </p>
        {proposalReady && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Button className="h-10 rounded-md font-black">
              <ThumbsUp className="size-4" /> Approve proposal
            </Button>
            <Button variant="outline" className="h-10 rounded-md font-bold">
              Request revision
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <SectionPanel
          icon={Presentation}
          title="Proposal package"
          aside={
            <StatusBadge
              status={proposalReady ? "ready" : "pending"}
              label={proposalReady ? "Ready for review" : "In preparation"}
            />
          }
        >
          <div className="divide-y divide-border">
            <DataRow label="Event" value={selectedEvent.eventName} />
            <DataRow
              label="Proposal stage"
              value={proposalReady ? "Client review" : "PMCM preparation"}
            />
            <DataRow
              label="Briefing basis"
              value={
                briefing
                  ? `${briefing.guestCount} guests at ${briefing.venue}`
                  : "Waiting for briefing"
              }
            />
            <DataRow
              label="Billing statement"
              value={
                billing ? `${billing.number} - ${formatLabel(billing.status)}` : "Not issued"
              }
            />
            <DataRow
              label="Official layout"
              value={officialDraft ? formatLabel(officialDraft.status) : "Not published"}
            />
            <DataRow
              label="Next payment"
              value={
                nextPayment
                  ? `${nextPayment.label} on ${nextPayment.dueDate}`
                  : "No open milestone"
              }
            />
          </div>
        </SectionPanel>

        <SectionPanel icon={MessageSquareText} title="Review path">
          <div className="flex flex-col divide-y divide-border">
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
                value: layoutReady ? formatLabel(officialDraft?.status) : "Not published",
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
                className="flex w-full items-center justify-between gap-3 border-l-2 border-l-transparent px-3.5 py-3 text-left transition hover:border-l-(--prism-signal) hover:bg-muted/50"
              >
                <span className="min-w-0">
                  <span className="block text-sm font-bold text-foreground">{item.label}</span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">{item.value}</span>
                </span>
                <StatusBadge status={item.status} />
              </button>
            ))}
          </div>
        </SectionPanel>
      </div>
    </div>
  );
}

export function ClientBillingTab({
  payments,
  billing,
}: {
  payments: MvpPaymentMilestone[];
  billing?: MvpBillingStatement;
}) {
  const totalPaid = payments.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalAmount = billing?.totalAmount ?? payments.reduce((s, p) => s + p.amount, 0);
  const balance = totalAmount - totalPaid;

  return (
    <div className="flex flex-col gap-4">
      {/* Summary card */}
      {totalAmount > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Total contract", value: money.format(totalAmount), icon: WalletCards },
            { label: "Paid to date", value: money.format(totalPaid), icon: CheckCircle2 },
            { label: "Balance", value: money.format(balance), icon: ReceiptText },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-4 shadow-sm"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <stat.icon className="size-4" />
              </span>
              <div>
                <p className="text-lg font-black leading-none text-foreground">{stat.value}</p>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                  {stat.label}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionPanel
        icon={WalletCards}
        title="Payment milestones"
        aside={
          billing ? (
            <span className="text-xs font-bold text-muted-foreground">
              {money.format(billing.totalAmount)} total
            </span>
          ) : undefined
        }
      >
        {billing && (
          <div className="mb-4 rounded-lg border border-border bg-secondary/50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-(--prism-amber)">
              Billing statement
            </p>
            <p className="mt-1 text-sm font-bold text-foreground">{billing.number}</p>
            <StatusBadge
              status={billing.status}
              label={formatLabel(billing.status)}
              className="mt-2"
            />
          </div>
        )}
        {payments.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="No payment milestones yet"
            description="Milestones appear after the billing statement linked to the approved proposal is posted."
          />
        ) : (
          <div className="flex flex-col gap-0">
            {payments.map((payment, index) => {
              const done = payment.status === "paid";
              return (
                <div
                  key={payment.id}
                  className="relative grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3 pb-4 last:pb-0"
                >
                  {index < payments.length - 1 ? (
                    <span
                      className={`absolute bottom-0 left-3 top-6 w-px ${done ? "bg-(--prism-signal)/30" : "bg-border"}`}
                    />
                  ) : null}
                  <span
                    className={`relative z-10 mt-1 grid size-6 place-items-center rounded-full text-white shadow-sm ${done ? "bg-(--prism-signal)" : "bg-card ring-1 ring-border"}`}
                  >
                    {done ? (
                      <CheckCircle2 className="size-3.5 text-white" />
                    ) : (
                      <span className="size-2 rounded-full bg-muted-foreground/40" />
                    )}
                  </span>
                  <div className="flex flex-wrap items-start justify-between gap-2 rounded-md border-l-2 border-l-border bg-background/75 p-3">
                    <div className="min-w-0">
                      <p className="text-sm font-black text-foreground">{payment.label}</p>
                      <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <CalendarDays className="size-3" /> {payment.dueDate}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-black text-foreground">
                        {money.format(payment.amount)}
                      </p>
                      <StatusBadge
                        status={payment.status}
                        label={formatLabel(payment.status)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionPanel>
    </div>
  );
}

const docCategories: Record<string, string[]> = {
  "Conforme & MOA": ["conforme", "moa", "nda", "contract"],
  Proposals: ["proposal", "briefing", "budget"],
  Floorplans: ["floorplan", "layout", "floor_plan"],
};

function categorizeDoc(doc: MvpDocument) {
  const key = `${doc.fileName} ${doc.type}`.toLowerCase();
  for (const [cat, keywords] of Object.entries(docCategories)) {
    if (keywords.some((kw) => key.includes(kw))) return cat;
  }
  return "Other";
}

export function ClientDocumentsTab({ documents }: { documents: MvpDocument[] }) {
  if (documents.length === 0) {
    return (
      <SectionPanel icon={FileText} title="Documents and approvals">
        <EmptyState
          icon={LockKeyhole}
          title="No documents yet"
          description="Signed conforme files, billing statements, and approval documents for this event will appear here."
        />
      </SectionPanel>
    );
  }

  const groups = new Map<string, MvpDocument[]>();
  for (const doc of documents) {
    const cat = categorizeDoc(doc);
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(doc);
  }

  const receivedCount = documents.filter((d) => d.status === "approved" || d.status === "received").length;

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-lg border-l-4 border-l-primary border-primary/15 bg-primary/8 px-4 py-3 text-sm">
        <p className="font-black text-foreground">
          {receivedCount} of {documents.length} document{documents.length === 1 ? "" : "s"} received
        </p>
        <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
          Signed conforme, billing statements, and approval documents for your event.
        </p>
      </div>

      {Array.from(groups.entries()).map(([cat, docs]) => (
        <SectionPanel key={cat} icon={FileText} title={cat}>
          <div className="divide-y divide-border">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <span className="grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                    <FileText className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-foreground">{doc.fileName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatLabel(doc.type)} - uploaded {doc.uploadedAt}
                    </p>
                  </div>
                </div>
                <StatusBadge status={doc.status} label={formatLabel(doc.status)} />
              </div>
            ))}
          </div>
        </SectionPanel>
      ))}
    </div>
  );
}

export function ClientActivityTab({ audit }: { audit: MvpAuditLog[] }) {
  if (audit.length === 0) {
    return (
      <SectionPanel icon={Activity} title="Event activity">
        <EmptyState
          icon={Activity}
          title="No activity yet"
          description="Event changes, approvals, and client-visible updates will appear here."
        />
      </SectionPanel>
    );
  }

  const grouped = groupByDay(audit);

  return (
    <SectionPanel icon={Activity} title="Event activity">
      <div className="flex flex-col gap-5">
        {Array.from(grouped.entries()).map(([day, items]) => (
          <div key={day}>
            {/* Day separator */}
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px flex-1 bg-border" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                {formatDayLabel(day)}
              </span>
              <span className="h-px flex-1 bg-border" />
            </div>
            <div className="flex flex-col gap-2.5">
              {items.map((item) => (
                <div key={item.id} className="flex items-start gap-3">
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-xs font-black text-foreground">
                    {actorInitials(item.actor)}
                  </span>
                  <div className="min-w-0 flex-1 border-l border-border bg-background/60 px-3.5 py-2.5">
                    <p className="text-sm font-bold text-foreground">
                      {clientActivityTitle(item.action)}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {clientActivityActor(item.actor)} - {item.createdAt}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionPanel>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-32 rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-32 rounded-lg" />
        <Skeleton className="h-32 rounded-lg" />
      </div>
    </div>
  );
}

export { CheckCircle2, Star };
