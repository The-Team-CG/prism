"use client";
import { formatPortalDate, formatPortalDateTime, manilaDateKey } from "@prism/ui/format-date";
import { PrismStatRow } from "@prism/ui/page-blocks";
import { ClientEventHero, ClientEventHeroStep, clientEventDaysToGo } from "../../../shared/client-event-hero";

import {
  Activity,
  ArrowRight,
  ClipboardList,
  MapPinned,
  ReceiptText,
} from "lucide-react";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage } from "@prism/types";
import type { PrismAuditLog, PrismClientActionItem, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { StatusBadge } from "@prism/ui/components/status-badge";
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

/** The overview's lead: the event, how far away it is, where it stands and the one thing the client should do next. */
export function OverviewNextDecision({
  selectedEvent,
  nextAction,
}: {
  selectedEvent: PrismEvent;
  nextAction?: PrismClientActionItem;
}) {
  const daysToGo = clientEventDaysToGo(selectedEvent, manilaDateKey());
  return (
    <ClientEventHero event={selectedEvent} daysToGo={daysToGo} label={daysToGo !== null && daysToGo >= 0 ? "Your event" : "Your event · date passed"}>
      {nextAction ? (
        <>
          <ClientEventHeroStep
            label={`Your next step${nextAction.dueAt ? ` · due ${formatPortalDate(nextAction.dueAt)}` : ""}`}
            title={nextAction.label}
            description={nextAction.description || undefined}
          />
          {nextAction.href ? (
            <Button asChild className="shrink-0">
              <a href={nextAction.href}>
                Open <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            </Button>
          ) : null}
        </>
      ) : (
        <p className="text-sm text-ink-foreground/70">Nothing needs your action right now. PMCM will let you know when it does.</p>
      )}
    </ClientEventHero>
  );
}

/** Figures the hero does not already show. Zeros are left out, so the row appears only when there is something to report. */
export function OverviewStats({
  payments,
  documents,
}: {
  selectedEvent: PrismEvent;
  payments: PrismPaymentMilestone[];
  documents: PrismDocument[];
}) {
  const openMilestones = payments.filter((p) => p.status !== "paid").length;
  return (
    <PrismStatRow
      label="Event figures"
      stats={[
        { label: "Open payments", value: openMilestones, empty: openMilestones === 0 },
        { label: "Documents", value: documents.length, empty: documents.length === 0 },
      ]}
    />
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
          <h3 className="text-sm font-semibold text-foreground">Event details</h3>
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
            <h3 className="text-sm font-semibold text-foreground">Floor plan</h3>
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
          className="w-full rounded-lg font-semibold"
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
          <h3 className="text-sm font-semibold text-foreground">Next payment</h3>
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
        <Button variant="outline" className="w-full rounded-lg font-semibold" onClick={() => setTab("billing")}>
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
          <h3 className="text-sm font-semibold text-foreground">Recent activity</h3>
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
        <Button variant="outline" className="flex-1 rounded-lg font-semibold" onClick={() => setTab("documents")}>
          Documents
        </Button>
        <Button variant="outline" className="flex-1 rounded-lg font-semibold" onClick={() => setTab("activity")}>
          Activity log
        </Button>
      </div>
    </Card>
  );
}
