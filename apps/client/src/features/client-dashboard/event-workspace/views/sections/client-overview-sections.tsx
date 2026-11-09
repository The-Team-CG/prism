"use client";
import { formatPortalDate, formatPortalDateTime } from "@prism/ui/format-date";

import {
  Activity,
  ArrowRight,
  ClipboardList,
  MapPinned,
  ReceiptText,
} from "lucide-react";
import { PRISM_LIFECYCLE_STAGES, PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage } from "@prism/types";
import type { PrismAuditLog, PrismClientActionItem, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { ClientEventStepper } from "../../../shared/client-event-stepper";
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

/** The shared lifecycle stage (same as PMCM sees), as a six-step strip. */
export function overviewLifecycleSteps(selectedEvent: PrismEvent) {
  const current = PRISM_LIFECYCLE_STAGES.indexOf(derivePrismLifecycleStage(selectedEvent));
  return PRISM_LIFECYCLE_STAGES.map((stage, index) => ({
    label: PRISM_LIFECYCLE_STAGE_LABELS[stage],
    state: index < current ? ("done" as const) : index === current ? ("current" as const) : ("upcoming" as const),
  }));
}

/** The overview's lead: where the event stands and the one thing the client should do next. */
export function OverviewNextDecision({
  selectedEvent,
  nextAction,
}: {
  selectedEvent: PrismEvent;
  nextAction?: PrismClientActionItem;
}) {
  const steps = overviewLifecycleSteps(selectedEvent);
  const currentIndex = Math.max(0, steps.findIndex((step) => step.state === "current"));
  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <p className="text-sm text-muted-foreground">Stage {currentIndex + 1} of {steps.length}</p>
          <h2 className="mt-0.5 text-lg font-semibold text-foreground">{steps[currentIndex]?.label}</h2>
        </div>
        <ClientEventStepper steps={steps.map((step) => ({ key: step.label, label: step.label, state: step.state }))} label="Planning progress" />
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
              <Button asChild className="shrink-0 font-semibold">
                <a href={nextAction.href}>
                  Open <ArrowRight className="size-4" aria-hidden="true" />
                </a>
              </Button>
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
    <Card className="gap-0 py-0">
    <dl className="grid grid-cols-3 divide-x divide-border">
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
    </Card>
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
        <DataRow label="Primary contact" value={selectedEvent.clientName} />
        <DataRow label="Date" value={formatPortalDate(selectedEvent.eventDate, "Pending")} />
        <DataRow label="Stage" value={PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(selectedEvent)]} />
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
        <DataRow label="Last update" value={officialDraft ? formatPortalDateTime(officialDraft.updatedAt) : "—"} />
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
