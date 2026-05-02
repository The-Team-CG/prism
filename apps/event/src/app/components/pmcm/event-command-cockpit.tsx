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

import {
  PrismCompactRecordList,
  PrismSectionPanel,
  PrismStatusSummary,
  PrismWorkflowTabs,
  RolePageHeader,
} from "@prism/ui";
import type { MvpDefenseReadiness, MvpEvent, MvpFloorPlanDraft } from "@/lib/mvp-api";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { label } from "./helpers";

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
    { id: "activity", label: "Activity", icon: MessageSquareText },
  ];
}

export function EventQueuePanel({
  events,
  selectedEventId,
  onSelectEvent,
  onReset,
}: {
  events: MvpEvent[];
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
      <PrismCompactRecordList
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
  event: MvpEvent;
  defenseReadiness: MvpDefenseReadiness | null;
  openActionCount: number;
  action?: React.ReactNode;
}) {
  const readinessLabel = defenseReadiness
    ? `${defenseReadiness.score}% ${label(defenseReadiness.overallStatus)}`
    : `${openActionCount} open action${openActionCount === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      <RolePageHeader
        eyebrow="PMCM selected-event cockpit"
        title={event.eventName}
        description={`Client, floorplan, suppliers, finance, live operations, and archive readiness for ${event.clientName}.`}
        meta={[
          <StatusBadge key="event-status" status={event.status} />,
          <StatusBadge key="floorplan-status" status={event.floorPlanStatus} label={`Floorplan ${label(event.floorPlanStatus)}`} />,
          defenseReadiness ? (
            <StatusBadge
              key="defense-status"
              status={defenseReadiness.overallStatus === "ready" ? "completed" : defenseReadiness.overallStatus === "blocked" ? "open" : "pending"}
              label={`Defense ${label(defenseReadiness.overallStatus)}`}
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
          { label: "Defense score", value: readinessLabel, detail: defenseReadiness ? `Stage: ${label(defenseReadiness.lifecycleStage)}` : "Loading readiness check" },
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
  defenseReadiness: MvpDefenseReadiness;
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
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Defense control</p>
          <h3 className="mt-1 text-lg font-black text-foreground">{defenseReadiness.score}% lifecycle ready</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Current stage: {label(defenseReadiness.lifecycleStage)}. The checklist keeps the selected event on the May 9 local defense path.
          </p>
        </div>
        <div className="grid min-w-[220px] grid-cols-2 gap-2 rounded-lg border border-border bg-secondary/60 p-3">
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
        <div className="mt-4 flex flex-wrap items-start gap-3 rounded-lg border border-(--prism-amber)/25 bg-(--prism-amber)/8 p-3 text-sm">
          <WifiOff className="mt-0.5 size-4 shrink-0 text-(--prism-amber)" />
          <div className="min-w-0">
            <p className="font-black text-foreground">Local-only defense mode</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Live AI, QR scanning, SendGrid/Viber, OAuth, external auth, and production adapters remain blocked for this pass.
              {defenseReadiness.deferredScope.length > 0 ? ` Deferred scope: ${defenseReadiness.deferredScope.map(label).join(", ")}.` : null}
            </p>
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {checklist.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onSelectTab(item.tab)}
            className="rounded-lg border border-border bg-secondary/35 p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-card text-primary">
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
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {defenseReadiness.nextActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onSelectTab(action.targetTab as PmcmDetailTab)}
            className="rounded-lg border border-border bg-secondary/45 p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
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
            No open defense actions. Keep this event selected and rehearse the briefing, floorplan, finance, and closure tabs.
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
  drafts: MvpFloorPlanDraft[];
  activeDraft?: MvpFloorPlanDraft;
  quoteRequestCount: number;
  quoteCount: number;
  openCheckCount: number;
}) {
  return (
    <PrismStatusSummary
      columns="four"
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
  return <PrismWorkflowTabs items={items} activeId={activeTab} onSelect={(item) => onSelectTab(item as PmcmDetailTab)} />;
}

export function EventOverviewPanels({
  event,
  onSubmitBriefing,
  onOpenSupplierDesk,
  onRunCompliance,
  onOpenCoordinatorDesk,
  onOpenLiveOps,
}: {
  event: MvpEvent;
  onSubmitBriefing: () => void;
  onOpenSupplierDesk: () => void;
  onRunCompliance: () => void;
  onOpenCoordinatorDesk: () => void;
  onOpenLiveOps: () => void;
}) {
  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <PrismSectionPanel title="Event record" icon={ClipboardList}>
        <div className="grid gap-3 md:grid-cols-2">
          {[
            { label: "Client", value: event.clientName },
            { label: "Event date", value: event.eventDate },
            { label: "Readiness", value: event.readiness ?? "-" },
            { label: "Client portal", value: <StatusBadge status={event.clientPortalStatus} /> },
            { label: "Floor plan", value: <StatusBadge status={event.floorPlanStatus} /> },
            { label: "Guest code", value: event.guestAccessCode ?? "Generated after event" },
          ].map(({ label: itemLabel, value }) => (
            <div key={itemLabel} className="rounded-lg border border-border bg-secondary/35 px-3 py-2.5">
              <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">{itemLabel}</p>
              <div className="mt-1 text-sm font-black text-foreground">{value}</div>
            </div>
          ))}
        </div>
      </PrismSectionPanel>
      <PrismSectionPanel title="Next operator actions" icon={Radio}>
        <div className="flex flex-col gap-2">
          <Button size="sm" className="w-full justify-start rounded-lg font-bold" onClick={onSubmitBriefing}>
            Submit client briefing
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenSupplierDesk}>
            Open quote request builder
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onRunCompliance}>
            Run compliance
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenCoordinatorDesk}>
            Open coordinator desk
          </Button>
          <Button size="sm" variant="outline" className="w-full justify-start rounded-lg font-bold" onClick={onOpenLiveOps}>
            Open live ops
          </Button>
        </div>
      </PrismSectionPanel>
    </div>
  );
}
