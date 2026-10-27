"use client";

import {
  Activity,
  ArrowRight,
  ClipboardList,
  FileText,
  MapPinned,
  ReceiptText,
  Timer,
  WalletCards,
} from "lucide-react";
import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  SectionLabel,
  clientActivityActor,
  clientActivityTitle,
  formatLabel,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../../shared/tab-ui";
import type { DetailTab } from "../../../workspace/shared";

function daysToEventLabel(eventDate?: string | null) {
  if (!eventDate) return "—";
  try {
    const diff = Math.ceil(
      (new Date(eventDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    );
    return diff > 0 ? `${diff}d` : "Today";
  } catch {
    return "—";
  }
}

function overviewLifecycleSteps(
  selectedEvent: PrismEvent,
  briefing?: PrismBriefing,
  billing?: PrismBillingStatement,
  officialDraft?: PrismFloorPlanDraft,
) {
  return [
    { label: "Inquiry accepted", state: "done" as const },
    { label: "Conforme signed", state: selectedEvent.clientPortalStatus === "unlocked" ? "done" as const : "pending" as const },
    { label: "Briefing / proposal", state: briefing && billing ? "done" as const : "current" as const },
    { label: "Planning", state: officialDraft?.status === "approved" ? "done" as const : "current" as const },
    { label: "Event day", state: "pending" as const },
    { label: "Closure", state: "pending" as const },
  ];
}

function lifecycleStepClass(state: string) {
  if (state === "done") return "bg-success/10 border border-success/20";
  if (state === "current") return "bg-primary-soft border border-primary/20";
  return "bg-muted/40 border border-border";
}

function lifecycleLabelClass(state: string) {
  if (state === "done") return "text-success";
  if (state === "current") return "text-primary";
  return "text-muted-foreground";
}

export function OverviewLifecycle({
  selectedEvent,
  briefing,
  billing,
  officialDraft,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  officialDraft?: PrismFloorPlanDraft;
}) {
  return (
    <Card>
      <CardHeader>
        <SectionLabel>Event lifecycle</SectionLabel>
        <h2 className="mt-1 text-base font-bold text-foreground">Planning progress</h2>
      </CardHeader>
      <CardBody>
        <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {overviewLifecycleSteps(selectedEvent, briefing, billing, officialDraft).map((step, i) => (
            <div key={step.label} className={`rounded-lg px-3 py-2.5 text-sm ${lifecycleStepClass(step.state)}`}>
              <p className="text-3xs font-bold text-muted-foreground">Step {i + 1}</p>
              <p className={`mt-1 text-xs font-bold ${lifecycleLabelClass(step.state)}`}>{step.label}</p>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export function OverviewStats({
  selectedEvent,
  payments,
  documents,
}: {
  selectedEvent: PrismEvent;
  payments: PrismPaymentMilestone[];
  documents: PrismDocument[];
}) {
  const openMilestones = payments.filter((p) => p.status !== "paid").length;
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        { label: "Days to event", value: daysToEventLabel(selectedEvent.eventDate), icon: Timer, color: "text-primary" },
        { label: "Open milestones", value: openMilestones || "0", icon: WalletCards, color: "text-attention" },
        { label: "Documents on file", value: documents.length || "0", icon: FileText, color: "text-success" },
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
  );
}

export function OverviewEventDetails({
  selectedEvent,
  briefing,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ClipboardList className="size-4 text-primary" />
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
  );
}

export function OverviewFloorPlanCard({
  officialDraft,
  preferenceDraftCount,
  onOpenOfficialFloorplan,
  setTab,
}: {
  officialDraft?: PrismFloorPlanDraft;
  preferenceDraftCount: number;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <MapPinned className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Floor plan</h3>
          </div>
          {officialDraft ? <StatusBadge status={officialDraft.status} label={formatLabel(officialDraft.status)} /> : null}
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
  );
}

export function OverviewNextPayment({
  billing,
  nextPayment,
  setTab,
}: {
  billing?: PrismBillingStatement;
  nextPayment?: PrismPaymentMilestone;
  setTab: (tab: DetailTab) => void;
}) {
  if (!billing && !nextPayment) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ReceiptText className="size-4 text-attention" />
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
  );
}

export function OverviewRecentActivity({
  documents,
  latestActivity,
  setTab,
}: {
  documents: PrismDocument[];
  latestActivity?: PrismAuditLog;
  setTab: (tab: DetailTab) => void;
}) {
  if (documents.length === 0 && !latestActivity) return null;
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Recent activity</h3>
        </div>
      </CardHeader>
      <CardBody className="py-2">
        <DataRow label="Documents on file" value={`${documents.length} file${documents.length === 1 ? "" : "s"}`} />
        {latestActivity ? (
          <>
            <DataRow label="Latest update" value={clientActivityTitle(latestActivity.action)} />
            <DataRow label="Updated by" value={`${clientActivityActor(latestActivity.actor)} — ${latestActivity.createdAt}`} />
          </>
        ) : null}
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
  );
}
