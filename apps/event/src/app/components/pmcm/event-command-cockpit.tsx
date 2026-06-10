"use client";

import type { LucideIcon } from "lucide-react";
import {
  Archive,
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  ClipboardList,
  FileCheck2,
  LayoutGrid,
  ListChecks,
  MapPinned,
  MessageSquareText,
  Radio,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
  WifiOff,
} from "lucide-react";
import type * as React from "react";

import type { PrismDefenseReadiness, PrismEvent, PrismFloorPlanDraft } from "@/lib/prism-api";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "./helpers";

/* ── Inline primitives (replacing @prism/ui blocks) ────────────── */

type StatusSummaryItem = {
  id: string;
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  status?: string;
  detail?: string;
};

function StatusSummary({ items }: { items: StatusSummaryItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.id} className="rounded-lg border border-border bg-background/80 p-3.5">
            <div className="flex items-start gap-3">
              {Icon ? (
                <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                  <Icon className="size-4" />
                </span>
              ) : null}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-black uppercase tracking-widest text-muted-foreground">{item.label}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm font-black text-foreground">
                  <span className="min-w-0 truncate">{item.value}</span>
                  {item.status ? <StatusBadge status={item.status} /> : null}
                </div>
                {item.detail ? <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.detail}</p> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

type CompactRecordItem = {
  id: string;
  title: string;
  description?: string;
  meta?: string;
  status?: string;
  icon?: LucideIcon;
  active?: boolean;
  onSelect?: () => void;
};

function CompactRecordList({ items, emptyText = "No records available.", className }: { items: CompactRecordItem[]; emptyText?: string; className?: string }) {
  if (!items.length) {
    return (
      <p className={`rounded-md border border-dashed border-border bg-secondary/40 px-4 py-6 text-center text-sm text-muted-foreground ${className ?? ""}`}>
        {emptyText}
      </p>
    );
  }
  return (
    <div className={`flex flex-col divide-y divide-border ${className ?? ""}`}>
      {items.map((item) => {
        const Icon = item.icon;
        const cls = `border-l-2 border-l-transparent px-3 py-3 transition ${item.active ? "border-l-(--prism-signal) bg-secondary/60" : "hover:bg-muted/50"}`;
        const content = (
          <span className="flex w-full items-start gap-3 text-left">
            {Icon ? (
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                <Icon className="size-4" />
              </span>
            ) : null}
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="truncate text-sm font-black text-foreground">{item.title}</span>
                {item.status ? <StatusBadge status={item.status} /> : null}
              </span>
              {item.description ? <span className="mt-0.5 block line-clamp-2 text-xs leading-5 text-muted-foreground">{item.description}</span> : null}
              {item.meta ? <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.meta}</span> : null}
            </span>
          </span>
        );
        return item.onSelect
          ? <button key={item.id} type="button" onClick={item.onSelect} className={cls}>{content}</button>
          : <div key={item.id} className={cls}>{content}</div>;
      })}
    </div>
  );
}

type WorkflowTabItem = {
  id: string;
  label: string;
  icon?: LucideIcon;
  badge?: number;
  disabled?: boolean;
};

function WorkflowTabs({ items, activeId, onSelect }: { items: WorkflowTabItem[]; activeId: string; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card p-1.5 shadow-sm">
      <div className="flex min-w-max gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              data-active={item.id === activeId}
              onClick={() => onSelect(item.id)}
              className="flex h-9 shrink-0 items-center gap-2 rounded-md px-3.5 text-sm font-bold text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-45 data-[active=true]:bg-primary data-[active=true]:font-black data-[active=true]:text-primary-foreground"
            >
              {Icon ? <Icon className="size-4" /> : null}
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rounded-full bg-background/70 px-1.5 text-[10px] font-black text-current">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PageHeader({ eyebrow, title, description, meta, action }: {
  eyebrow?: string;
  title: string;
  description?: string;
  meta?: Array<string | React.ReactNode>;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-md border border-border bg-card px-4 py-3 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <p className="text-[10px] font-black uppercase text-muted-foreground">{eyebrow}</p> : null}
          <h2 className="mt-0.5 text-lg font-black leading-tight text-foreground sm:text-xl">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-muted-foreground">{description}</p> : null}
          {meta?.length ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {meta.map((item, i) =>
                typeof item === "string"
                  ? <span key={i} className="rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-semibold text-foreground">{item}</span>
                  : <span key={i}>{item}</span>
              )}
            </div>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </section>
  );
}

export type PmcmDetailTab =
  | "overview"
  | "floorplans"
  | "briefing"
  | "suppliers"
  | "coordinators"
  | "live-ops"
  | "billing"
  | "closure"
  | "activity";

export interface PmcmWorkflowTabItem {
  id: PmcmDetailTab;
  label: string;
  icon: LucideIcon;
  badge?: number;
}

export function buildEventWorkflowTabs({
  draftsCount,
  quotesCount,
  assignmentsCount,
  paymentsCount,
  openChecksCount,
}: {
  draftsCount: number;
  quotesCount: number;
  assignmentsCount: number;
  paymentsCount: number;
  openChecksCount: number;
}): PmcmWorkflowTabItem[] {
  return [
    { id: "overview", label: "Overview", icon: ClipboardList },
    { id: "floorplans", label: "Floorplans", icon: MapPinned, badge: draftsCount || undefined },
    { id: "briefing", label: "Briefing", icon: FileCheck2 },
    { id: "suppliers", label: "Suppliers", icon: Truck, badge: quotesCount || undefined },
    { id: "coordinators", label: "Coordinators", icon: UserCheck, badge: assignmentsCount || undefined },
    { id: "live-ops", label: "Live ops", icon: Radio },
    { id: "billing", label: "Finance", icon: ReceiptText, badge: paymentsCount || undefined },
    { id: "closure", label: "Closure", icon: Archive, badge: openChecksCount || undefined },
    { id: "activity", label: "Messages", icon: MessageSquareText },
  ];
}

export function EventQueuePanel({
  events,
  selectedEventId,
  onSelectEvent,
  onReset,
}: {
  events: PrismEvent[];
  selectedEventId?: string;
  onSelectEvent: (eventId: string) => void;
  onReset: () => void;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3 px-2 pb-2">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">Event queue</p>
          <p className="mt-1 text-xs text-muted-foreground">{events.length} active PMCM workspace(s)</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onReset}
          title="Reset demo data"
          className="size-8 rounded-md"
        >
          <RotateCcw aria-hidden="true" />
          <span className="sr-only">Reset demo data</span>
        </Button>
      </div>
      <CompactRecordList
        className="mt-2"
        emptyText="No accepted inquiry with signed conforme yet."
        items={events.map((event) => ({
          id: event.id,
          title: event.eventName,
          description: `${event.clientName} - portal ${label(event.clientPortalStatus)}`,
          meta: event.eventDate,
          status: event.status,
          icon: CalendarClock,
          active: event.id === selectedEventId,
          onSelect: () => onSelectEvent(event.id),
        }))}
      />
    </section>
  );
}

export function SelectedEventCockpit({
  event,
  defenseReadiness,
  openActionCount,
  action,
}: {
  event: PrismEvent;
  defenseReadiness: PrismDefenseReadiness | null;
  openActionCount: number;
  action?: React.ReactNode;
}) {
  const readinessLabel = defenseReadiness
    ? `${defenseReadiness.score}% ${label(defenseReadiness.overallStatus)}`
    : `${openActionCount} open action${openActionCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      <PageHeader
        eyebrow="PMCM selected-event cockpit"
        title={event.eventName}
        description={`Client, floorplan, suppliers, finance, live operations, and archive readiness for ${event.clientName}.`}
        meta={[
          <StatusBadge key="event-status" status={event.status} />,
          <StatusBadge key="floorplan-status" status={event.floorPlanStatus} label={`Floorplan ${label(event.floorPlanStatus)}`} />,
          defenseReadiness ? (
            <StatusBadge
              key="readiness-status"
              status={defenseReadiness.overallStatus === "ready" ? "completed" : defenseReadiness.overallStatus === "blocked" ? "open" : "pending"}
              label={`Readiness ${label(defenseReadiness.overallStatus)}`}
            />
          ) : (
            `${openActionCount} open actions`
          ),
        ]}
        action={action}
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Client", value: event.clientName, detail: event.clientPortalStatus === "unlocked" ? "Client portal unlocked" : "Client portal locked" },
          { label: "Event date", value: event.eventDate, detail: event.readiness ?? "Readiness pending" },
          { label: "Event readiness", value: readinessLabel, detail: defenseReadiness ? `Stage: ${label(defenseReadiness.lifecycleStage)}` : "Loading readiness check" },
          { label: "Guest access", value: event.guestAccessCode ?? "Pending", detail: event.guestAccessCode ? "Ready for guest portal demo" : "Generated after event setup" },
        ].map((item) => (
          <div key={item.label} className="rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{item.label}</p>
            <p className="mt-1 truncate text-sm font-black text-foreground">{item.value}</p>
            <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{item.detail}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function DefenseControlPanel({
  defenseReadiness,
  onSelectTab,
}: {
  defenseReadiness: PrismDefenseReadiness;
  onSelectTab: (tab: PmcmDetailTab) => void;
}) {
  const checklist = [
    {
      key: "briefing",
      label: "Briefing",
      detail: defenseReadiness.summary.briefingSubmitted ? "Client brief is captured." : "Submit the client briefing before walkthrough.",
      ready: defenseReadiness.summary.briefingSubmitted,
      tab: "briefing" as PmcmDetailTab,
    },
    {
      key: "floorplan",
      label: "Official floorplan",
      detail: defenseReadiness.summary.officialFloorplanApproved ? "Approved layout is available." : "Approve one PMCM floorplan draft.",
      ready: defenseReadiness.summary.officialFloorplanApproved,
      tab: "floorplans" as PmcmDetailTab,
    },
    {
      key: "suppliers",
      label: "Supplier coverage",
      detail: `${defenseReadiness.summary.quoteRequests} request batch(es), ${defenseReadiness.summary.selectedSuppliers} selected supplier(s).`,
      ready: defenseReadiness.summary.selectedSuppliers > 0,
      tab: "suppliers" as PmcmDetailTab,
    },
    {
      key: "coordinators",
      label: "Coordinator staffing",
      detail: `${defenseReadiness.summary.coordinatorAssignments} assignment(s), ${defenseReadiness.summary.pendingCoordinatorAcknowledgments} pending ack(s).`,
      ready: defenseReadiness.summary.coordinatorAssignments > 0 && defenseReadiness.summary.pendingCoordinatorAcknowledgments === 0,
      tab: "coordinators" as PmcmDetailTab,
    },
    {
      key: "finance",
      label: "Finance",
      detail: `${defenseReadiness.summary.billingStatements} billing statement(s), ${defenseReadiness.summary.unpaidMilestones} unpaid milestone(s).`,
      ready: defenseReadiness.summary.billingStatements > 0 && defenseReadiness.summary.unpaidMilestones === 0,
      tab: "billing" as PmcmDetailTab,
    },
    {
      key: "closure",
      label: "Closure",
      detail: defenseReadiness.summary.closureReady ? "Close gates are ready." : "Resolve close gates or document override reason.",
      ready: defenseReadiness.summary.closureReady,
      tab: "closure" as PmcmDetailTab,
    },
  ];

  return (
    <section className="rounded-lg border border-primary/15 bg-card px-4 py-4 shadow-sm sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Readiness control</p>
          <h3 className="mt-1 text-lg font-black text-foreground">{defenseReadiness.score}% lifecycle ready</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Current stage: {label(defenseReadiness.lifecycleStage)}. The checklist keeps the selected event ready across briefing, floorplans, suppliers, finance, and closure.
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-4 border-l border-border bg-background/60 px-3 py-2.5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Guests</p>
            <p className="mt-1 text-xl font-black text-foreground">{defenseReadiness.summary.guestAttendanceCount}</p>
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Open ops</p>
            <p className="mt-1 text-xl font-black text-foreground">{defenseReadiness.summary.openLiveOpsItems}</p>
          </div>
        </div>
      </div>
      {defenseReadiness.liveAiBlocked && (
        <div className="mt-4 flex flex-wrap items-start gap-3 border-l border-(--prism-amber) bg-(--prism-amber)/8 px-3 py-2.5 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-(--prism-amber)" />
          <div className="min-w-0">
            <p className="font-black text-foreground">Local-only operations mode</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Live AI, QR scanning, SendGrid/Viber, OAuth, external auth, and production adapters remain blocked for this pass.
              {defenseReadiness.deferredScope.length > 0 ? ` Deferred scope: ${defenseReadiness.deferredScope.map(label).join(", ")}.` : null}
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 divide-y divide-border">
        {checklist.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectTab(item.tab)}
            className="w-full border-l-2 border-l-transparent px-3 py-3 text-left transition hover:border-l-(--prism-signal) hover:bg-muted/50"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-primary/10 text-primary">
                {item.ready ? <CheckCircle2 className="size-4" /> : <CircleDot className="size-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-black text-foreground">{item.label}</span>
                  <StatusBadge status={item.ready ? "completed" : "pending"} label={item.ready ? "Ready" : "Needs work"} />
                </span>
                <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
              </span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <div className="mb-2 flex items-center gap-2">
          <ListChecks className="size-4 text-primary" />
          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Action queue</p>
        </div>
      </div>
      <div className="divide-y divide-border">
        {defenseReadiness.nextActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onSelectTab(action.targetTab as PmcmDetailTab)}
            className="w-full border-l-2 border-l-transparent px-3 py-3 text-left transition hover:border-l-(--prism-signal) hover:bg-muted/50"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-foreground">{action.label}</p>
              <StatusBadge
                status={action.status === "done" ? "completed" : action.status === "blocked" ? "open" : "pending"}
                label={label(action.status)}
              />
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.detail}</p>
          </button>
        ))}
        {defenseReadiness.nextActions.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-secondary/35 p-4 text-sm text-muted-foreground md:col-span-2 xl:col-span-4">
            No open readiness actions. Keep this event selected and review the briefing, floorplan, finance, and closure tabs.
          </div>
        )}
      </div>
    </section>
  );
}

export function SelectedEventStatusSummary({
  drafts,
  activeDraft,
  quoteRequestCount,
  quoteCount,
  openCheckCount,
}: {
  drafts: PrismFloorPlanDraft[];
  activeDraft?: PrismFloorPlanDraft;
  quoteRequestCount: number;
  quoteCount: number;
  openCheckCount: number;
}) {
  return (
    <StatusSummary
      items={[
        { id: "drafts", label: "Floorplan drafts", value: drafts.length, icon: LayoutGrid, detail: "PMCM drafts plus client preferences." },
        { id: "active-layout", label: "Official layout", value: activeDraft ? "Ready" : "Pending", icon: BadgeCheck, status: activeDraft?.status ?? "pending" },
        { id: "supplier-quotes", label: "Supplier quotes", value: quoteCount, icon: Truck, detail: `${quoteRequestCount} request batch(es).` },
        {
          id: "open-checks",
          label: "Closure checks",
          value: openCheckCount,
          icon: ShieldCheck,
          status: openCheckCount > 0 ? "open" : "completed",
        },
      ]}
    />
  );
}

export function EventWorkflowTabs({
  items,
  activeTab,
  onSelectTab,
}: {
  items: PmcmWorkflowTabItem[];
  activeTab: PmcmDetailTab;
  onSelectTab: (tab: PmcmDetailTab) => void;
}) {
  return <WorkflowTabs items={items} activeId={activeTab} onSelect={(item) => onSelectTab(item as PmcmDetailTab)} />;
}

function OverviewCard({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-border bg-card shadow-sm ${className}`}>{children}</div>
  );
}

function OverviewCardHeader({ children }: { children: React.ReactNode }) {
  return <div className="border-b border-border px-5 py-4">{children}</div>;
}

function OverviewCardBody({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`px-5 py-4 ${className}`}>{children}</div>;
}

function OverviewAccent({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-bold uppercase tracking-widest text-(--prism-signal)">{children}</p>;
}

function StatCell({ label: lbl, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3.5">
      <p className="text-xs font-semibold text-muted-foreground">{lbl}</p>
      <div className="mt-1.5 text-sm font-bold text-foreground">{value}</div>
    </div>
  );
}

export function EventOverviewPanels({
  event,
  defenseReadiness,
  drafts,
  activeDraft,
  quoteRequestCount,
  quoteCount,
  openCheckCount,
  onSubmitBriefing,
  onOpenSupplierDesk,
  onRunCompliance,
  onOpenCoordinatorDesk,
  onOpenLiveOps,
  onOpenFloorplans,
  onOpenBilling,
  onOpenClosure,
}: {
  event: PrismEvent;
  defenseReadiness: PrismDefenseReadiness | null;
  drafts: PrismFloorPlanDraft[];
  activeDraft?: PrismFloorPlanDraft;
  quoteRequestCount: number;
  quoteCount: number;
  openCheckCount: number;
  onSubmitBriefing: () => void;
  onOpenSupplierDesk: () => void;
  onRunCompliance: () => void;
  onOpenCoordinatorDesk: () => void;
  onOpenLiveOps: () => void;
  onOpenFloorplans: () => void;
  onOpenBilling: () => void;
  onOpenClosure: () => void;
}) {
  return (
    <div className="space-y-4">
      {/* Top stat strip */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Floorplan drafts",
            value: drafts.length,
            accent: activeDraft ? "text-(--prism-success)" : "text-(--prism-amber)",
            detail: activeDraft ? "Official layout approved" : "No approved layout yet",
            onClick: onOpenFloorplans,
          },
          {
            label: "Supplier quotes",
            value: quoteCount,
            accent: "text-(--prism-signal)",
            detail: `${quoteRequestCount} request batch${quoteRequestCount === 1 ? "" : "es"}`,
            onClick: onOpenSupplierDesk,
          },
          {
            label: "Event readiness",
            value: defenseReadiness ? `${defenseReadiness.score}%` : "—",
            accent: defenseReadiness && defenseReadiness.score >= 80 ? "text-(--prism-success)" : "text-(--prism-amber)",
            detail: defenseReadiness ? label(defenseReadiness.overallStatus) : "Loading readiness",
            onClick: undefined,
          },
          {
            label: "Closure checks",
            value: openCheckCount,
            accent: openCheckCount > 0 ? "text-(--prism-amber)" : "text-(--prism-success)",
            detail: openCheckCount > 0 ? "Open items need resolution" : "All gates clear",
            onClick: onOpenClosure,
          },
        ].map((stat) => {
          const inner = (
            <div className="flex items-start gap-4 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm transition hover:shadow-md">
              <div className="min-w-0 flex-1">
                <p className={`text-2xl font-black leading-none ${stat.accent}`}>{stat.value}</p>
                <p className="mt-1.5 text-xs font-bold text-foreground">{stat.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{stat.detail}</p>
              </div>
            </div>
          );
          if (stat.onClick) {
            return (
              <button key={stat.label} type="button" onClick={stat.onClick} className="w-full text-left">
                {inner}
              </button>
            );
          }
          return <div key={stat.label}>{inner}</div>;
        })}
      </div>

      {/* Event record + quick actions */}
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <OverviewCard>
          <OverviewCardHeader>
            <OverviewAccent>Event record</OverviewAccent>
            <h3 className="mt-1 text-base font-bold text-foreground">{event.eventName}</h3>
          </OverviewCardHeader>
          <OverviewCardBody>
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCell label="Client" value={event.clientName} />
              <StatCell label="Event date" value={event.eventDate ?? "Date pending"} />
              <StatCell label="Readiness" value={event.readiness ?? "—"} />
              <StatCell label="Client portal" value={<StatusBadge status={event.clientPortalStatus} />} />
              <StatCell label="Floor plan" value={<StatusBadge status={event.floorPlanStatus} />} />
              <StatCell label="Guest code" value={event.guestAccessCode ?? "Generated after event setup"} />
            </div>
          </OverviewCardBody>
        </OverviewCard>

        <OverviewCard>
          <OverviewCardHeader>
            <OverviewAccent>Operator actions</OverviewAccent>
            <h3 className="mt-1 text-base font-bold text-foreground">Quick actions</h3>
          </OverviewCardHeader>
          <OverviewCardBody className="space-y-2">
            <Button size="sm" className="w-full justify-start rounded-lg font-bold" onClick={onSubmitBriefing}>
              Submit client briefing
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenFloorplans}>
              Manage floorplans
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenSupplierDesk}>
              Open supplier desk
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onRunCompliance}>
              Run compliance
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenCoordinatorDesk}>
              Coordinator desk
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenLiveOps}>
              Open live ops
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenBilling}>
              Billing &amp; finance
            </Button>
            <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenClosure}>
              Closure &amp; archive
            </Button>
          </OverviewCardBody>
        </OverviewCard>
      </div>
    </div>
  );
}
