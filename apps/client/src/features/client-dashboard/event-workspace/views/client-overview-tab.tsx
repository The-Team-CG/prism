"use client";

import type { PrismAuditLog, PrismBillingStatement, PrismBriefing, PrismDocument, PrismEvent, PrismFloorPlanDraft, PrismPaymentMilestone } from "@prism/types";
import type { DetailTab } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { selectEventNextAction } from "../model/client-event-next-action";
import { ClientChangeRequestsPanel } from "../../change-requests";
import { ClientAddendaStatus } from "../../addenda";
import {
  OverviewEventDetails,
  OverviewFloorPlanCard,
  OverviewNextDecision,
  OverviewNextPayment,
  OverviewRecentActivity,
  OverviewStats,
} from "./sections/client-overview-sections";

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
  const { actionCenter } = useClientWorkspace();
  const nextAction = selectEventNextAction(actionCenter?.items ?? [], selectedEvent.id);
  const latestActivity = audit[0];
  const nextPayment = payments.find((p) => p.status !== "paid");

  return (
    <div className="space-y-5">
      <OverviewNextDecision selectedEvent={selectedEvent} briefing={briefing} billing={billing} officialDraft={officialDraft} nextAction={nextAction} />
      <OverviewStats selectedEvent={selectedEvent} payments={payments} documents={documents} />
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <OverviewEventDetails selectedEvent={selectedEvent} briefing={briefing} />
        <div className="space-y-4">
          <OverviewFloorPlanCard
            officialDraft={officialDraft}
            preferenceDraftCount={preferenceDraftCount}
            onOpenOfficialFloorplan={onOpenOfficialFloorplan}
            setTab={setTab}
          />
          <OverviewNextPayment billing={billing} nextPayment={nextPayment} setTab={setTab} />
        </div>
      </div>
      {/* Changes and addenda are later-stage reference; they sit below the facts, with the form collapsed. */}
      <ClientChangeRequestsPanel eventId={selectedEvent.id} />
      <ClientAddendaStatus eventId={selectedEvent.id} />
      <OverviewRecentActivity documents={documents} latestActivity={latestActivity} setTab={setTab} />
    </div>
  );
}
