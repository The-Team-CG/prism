"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  CalendarClock,
  ClipboardList,
  FileCheck2,
  LayoutGrid,
  MapPinned,
  MessageSquareText,
  Radio,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Truck,
  UserCheck,
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
    { id: "billing", label: "Billing", icon: ReceiptText, badge: paymentsCount || undefined },
    { id: "closure", label: "Closure", icon: ShieldCheck, badge: openChecksCount || undefined },
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
          <p className="mt-1 text-xs text-muted-foreground">{events.length} confirmed workspace(s)</p>
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
        items={events.map((event) => ({
          id: event.id,
          title: event.eventName,
          description: event.clientName,
          meta: event.eventDate,
          status: event.clientPortalStatus,
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
  return (
    <RolePageHeader
      eyebrow="PMCM command workspace"
      title={event.eventName}
      description={`Review client state, supplier readiness, billing, floorplan, and live operations from one cockpit for ${event.clientName} on ${event.eventDate}.`}
      meta={[
        <StatusBadge key="event-status" status={event.status} />,
        <StatusBadge key="floorplan-status" status={event.floorPlanStatus} />,
        defenseReadiness ? (
          <StatusBadge
            key="defense-status"
            status={defenseReadiness.overallStatus}
            label={`Defense ${label(defenseReadiness.overallStatus)}`}
          />
        ) : (
          `${openActionCount} open actions`
        ),
      ]}
      action={action}
    />
  );
}

export function DefenseControlPanel({
  defenseReadiness,
  onSelectTab,
}: {
  defenseReadiness: MvpDefenseReadiness;
  onSelectTab: (tab: PmcmDetailTab) => void;
}) {
  return (
    <section className="rounded-xl border border-primary/15 bg-card px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-(--prism-amber)">Defense Control</p>
          <h3 className="mt-1 text-lg font-black text-foreground">{defenseReadiness.score}% lifecycle ready</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Current stage: {label(defenseReadiness.lifecycleStage)}. Live AI, QR scanning, production notifications, and external integrations stay deferred for this defense pass.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-secondary/60 px-4 py-3 text-right">
          <p className="text-[10px] font-black uppercase tracking-wide text-muted-foreground">Guest count</p>
          <p className="mt-1 text-2xl font-black text-foreground">{defenseReadiness.summary.guestAttendanceCount}</p>
          <p className="text-xs text-muted-foreground">{defenseReadiness.summary.pendingFeedbackModeration} feedback item(s) pending</p>
        </div>
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        {defenseReadiness.nextActions.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => onSelectTab(action.targetTab as PmcmDetailTab)}
            className="rounded-lg border border-border bg-secondary/45 p-3 text-left transition hover:border-primary/30 hover:bg-secondary"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-black text-foreground">{action.label}</p>
              <StatusBadge status={action.status} />
            </div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{action.detail}</p>
          </button>
        ))}
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
        { id: "drafts", label: "Drafts", value: drafts.length, icon: LayoutGrid, detail: "PMCM and client preference layouts." },
        { id: "active-layout", label: "Active layout", value: activeDraft ? "Ready" : "Pending", icon: BadgeCheck, status: activeDraft?.status ?? "pending" },
        { id: "supplier-quotes", label: "Supplier quotes", value: quoteCount, icon: Truck, detail: `${quoteRequestCount} request batch(es).` },
        {
          id: "open-checks",
          label: "Open checks",
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
        <div className="divide-y divide-border text-sm">
          {[
            { label: "Readiness", value: event.readiness ?? "-" },
            { label: "Client portal", value: <StatusBadge status={event.clientPortalStatus} /> },
            { label: "Floor plan", value: <StatusBadge status={event.floorPlanStatus} /> },
            { label: "Guest code", value: event.guestAccessCode ?? "Generated after event" },
          ].map(({ label: itemLabel, value }) => (
            <div key={itemLabel} className="flex items-center justify-between gap-4 py-2.5 not-last:border-b not-last:border-border">
              <span className="font-semibold text-muted-foreground">{itemLabel}</span>
              <span className="text-right font-semibold text-foreground">{value}</span>
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
