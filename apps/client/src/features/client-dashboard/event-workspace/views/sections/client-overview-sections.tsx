"use client";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";

import {
  Activity,
  ArrowRight,
  ClipboardList,
  MapPinned,
  ReceiptText,
} from "lucide-react";
import type { PrismAuditLog, PrismClientActionItem, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@/app/components/ui/button";
import { StatusBadge } from "@/app/components/ui/status-badge";
import {
  Card,
  CardBody,
  CardHeader,
  DataRow,
  clientActivityActor,
  clientActivityTitle,
  formatLabel,
  money,
  portalBadgeStatus,
  portalStatusLabel,
} from "../../../shared/tab-ui";
import type { DetailTab } from "../../../workspace/shared";

export function daysToEventLabel(eventDate?: string | null, now = Date.now()) {
  if (!eventDate) return "—";
  const time = new Date(eventDate).getTime();
  if (!Number.isFinite(time)) return "—";
  const diff = Math.ceil((time - now) / (1000 * 60 * 60 * 24));
  if (diff > 1) return `${diff} days`;
  if (diff === 1) return "Tomorrow";
  if (diff === 0) return "Today";
  return "Held";
}

export function overviewLifecycleSteps(
  selectedEvent: PrismEvent,
  briefing?: PrismBriefing,
  billing?: PrismBillingStatement,
  officialDraft?: PrismFloorPlanDraft,
) {
  const done = [
    true,
    selectedEvent.clientPortalStatus === "unlocked",
    Boolean(briefing && billing),
    officialDraft?.status === "approved",
    false,
    false,
  ];
  const labels = ["Inquiry accepted", "Conforme signed", "Briefing and proposal", "Planning", "Event day", "Closure"];
  // Exactly one current stage: the first one not yet done.
  const current = done.findIndex((value) => !value);
  return labels.map((label, index) => ({
    label,
    state: done[index] ? ("done" as const) : index === current ? ("current" as const) : ("pending" as const),
  }));
}

/** The overview's lead: where the event stands and the one thing the client should do next. */
export function OverviewNextDecision({
  selectedEvent,
  briefing,
  billing,
  officialDraft,
  nextAction,
}: {
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  billing?: PrismBillingStatement;
  officialDraft?: PrismFloorPlanDraft;
  nextAction?: PrismClientActionItem;
}) {
  const steps = overviewLifecycleSteps(selectedEvent, briefing, billing, officialDraft);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Stage {currentIndex + 1} of {steps.length}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-foreground">{steps[currentIndex]?.label}</h2>
        </div>
        <ol className="flex gap-1" aria-label="Planning progress">
          {steps.map((step) => (
            <li key={step.label} className="flex-1" title={step.label}>
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full ${step.state === "done" ? "bg-success" : step.state === "current" ? "bg-primary" : "bg-muted"}`}
              />
              <span className="sr-only">
                {step.label}: {step.state === "done" ? "done" : step.state === "current" ? "current stage" : "not started"}
              </span>
            </li>
          ))}
        </ol>
        {nextAction ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">
                Your next step{nextAction.dueAt ? ` · due ${formatPortalDate(nextAction.dueAt)}` : ""}
              </p>
              <p className="mt-0.5 font-medium text-foreground">{nextAction.label}</p>
              {nextAction.description ? <p className="mt-0.5 text-sm text-muted-foreground">{nextAction.description}</p> : null}
            </div>
            {nextAction.href ? (
              <a
                href={nextAction.href}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
              >
                Open <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        ) : (
          <p className="border-t border-border pt-4 text-sm text-muted-foreground">
            Nothing needs your action right now. PMCM will let you know when it does.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

/** Three peer figures in one divided container: label over value, no icon tiles. */
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
    <dl className="grid grid-cols-3 divide-x divide-border rounded-lg border border-border bg-card">
      {[
        { label: "Until the event", value: daysToEventLabel(selectedEvent.eventDate) },
        { label: "Open payments", value: openMilestones },
        { label: "Documents", value: documents.length },
      ].map((stat) => (
        <div key={stat.label} className="min-w-0 px-3 py-3 sm:px-5 sm:py-4">
          <dt className="text-xs text-muted-foreground sm:text-sm">{stat.label}</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-foreground sm:text-2xl">{stat.value}</dd>
        </div>
      ))}
    </dl>
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
            <DataRow label="Due" value={formatPortalDate(nextPayment.dueDate)} />
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
            <DataRow label="Updated by" value={`${clientActivityActor(latestActivity.actor)} — ${formatPortalDateTime(latestActivity.createdAt)}`} />
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
