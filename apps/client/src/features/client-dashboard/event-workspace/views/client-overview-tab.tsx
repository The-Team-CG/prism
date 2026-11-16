"use client";

import { derivePrismLifecycleStage, type PrismBillingStatement, type PrismBriefing, type PrismClientOcularVisit, type PrismDocument, type PrismEvent, type PrismFloorPlanDraft, type PrismPaymentMilestone } from "@prism/types";
import type { DetailTab } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { selectEventNextAction } from "../model/client-event-next-action";
import { gettingStartedSteps, ocularVisitLine, showGettingStarted, sinceLastVisitItems } from "../model/client-overview-glance";
import { useClientStageReached } from "../view-models/use-client-stage-reached";
import { ClientChangeRequestsPanel } from "../../change-requests";
import { ClientAddendaStatus } from "../../addenda";
import { comingUpForEvent } from "../../events/views/client-event-cards";
import { useEventCoverUrl } from "../../events/view-models/use-event-cover-url";
import { useClientNewFileCount } from "../../files";
import { useClientUnreadMessages } from "../../messages/view-models/use-client-unread-messages";
import { useClientUnreadNotices } from "../../notifications/view-models/use-client-unread-notices";
import {
  OverviewComingUp,
  OverviewEventDetails,
  OverviewFloorPlanCard,
  OverviewGettingStarted,
  OverviewNextDecision,
  OverviewNextPayment,
  OverviewSinceLastVisit,
  OverviewStageBanner,
  type ComingUpLine,
} from "./sections/client-overview-sections";

/** How many dated steps the overview lists. */
const COMING_UP_LIMIT = 4;

export function ClientOverviewTab({
  selectedEvent,
  briefing,
  payments,
  billing,
  documents,
  officialDraft,
  preferenceDraftCount,
  ocularVisit = null,
  onOpenOfficialFloorplan,
  setTab,
  afterLead,
}: {
  /** Shown straight after the lead block, such as the form to ask for a site visit. */
  afterLead?: React.ReactNode;
  selectedEvent: PrismEvent;
  briefing?: PrismBriefing;
  payments: PrismPaymentMilestone[];
  billing?: PrismBillingStatement;
  documents: PrismDocument[];
  officialDraft?: PrismFloorPlanDraft;
  preferenceDraftCount: number;
  /** A requested or scheduled venue visit is a Coming up line. */
  ocularVisit?: PrismClientOcularVisit | null;
  onOpenOfficialFloorplan?: () => void;
  setTab: (tab: DetailTab) => void;
}) {
  const { actionCenter, session } = useClientWorkspace();
  const actions = actionCenter?.items ?? [];
  const nextAction = selectEventNextAction(actions, selectedEvent.id);
  const coverUrl = useEventCoverUrl(selectedEvent.id, selectedEvent.coverObjectId);
  const stage = useClientStageReached(session?.id, selectedEvent.id, derivePrismLifecycleStage(selectedEvent));
  const unreadMessages = useClientUnreadMessages({ eventId: selectedEvent.id });
  const unreadNotices = useClientUnreadNotices();
  const newFiles = useClientNewFileCount(session?.id, selectedEvent.id, documents);
  const sinceItems = sinceLastVisitItems({ unreadMessages, newFiles, unreadNotices });
  const steps = gettingStartedSteps({ event: selectedEvent, hasBriefing: Boolean(briefing), hasLayoutIdeas: preferenceDraftCount > 0 || Boolean(officialDraft), payments });
  const visit = ocularVisitLine(ocularVisit);
  const comingUp: ComingUpLine[] = [
    ...(visit ? [{ id: "ocular-visit", ...visit }] : []),
    ...comingUpForEvent(selectedEvent, actions, COMING_UP_LIMIT).map((item) => ({ id: item.id, label: item.label, at: item.dueAt ?? null, href: item.href })),
  ].slice(0, COMING_UP_LIMIT);
  const starting = showGettingStarted(selectedEvent, steps);

  const comingUpPanel = <OverviewComingUp lines={comingUp} />;
  const since = <OverviewSinceLastVisit eventId={selectedEvent.id} items={sinceItems} loaded={unreadMessages !== undefined && newFiles !== undefined && unreadNotices !== undefined} />;

  return (
    <div className="space-y-4">
      <OverviewStageBanner message={stage.message} onDismiss={stage.dismiss} />
      <OverviewNextDecision selectedEvent={selectedEvent} nextAction={nextAction} coverUrl={coverUrl} since={since} />
      {afterLead}
      {/* A new event leads with its checklist beside the dates; later on, the dates join the cards below. */}
      {starting ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2"><OverviewGettingStarted steps={steps} setTab={setTab} /></div>
          {comingUpPanel}
        </div>
      ) : null}
      <div className={starting ? "grid gap-4 lg:grid-cols-3" : "grid gap-4 md:grid-cols-2 xl:grid-cols-4"}>
        {starting ? null : comingUpPanel}
        <OverviewEventDetails selectedEvent={selectedEvent} briefing={briefing} setTab={setTab} />
        <OverviewFloorPlanCard
          officialDraft={officialDraft}
          preferenceDraftCount={preferenceDraftCount}
          onOpenOfficialFloorplan={onOpenOfficialFloorplan}
          setTab={setTab}
        />
        <OverviewNextPayment billing={billing} payments={payments} setTab={setTab} />
      </div>
      {/* Changes and addenda are later-stage reference; they sit below the facts, with the form collapsed. */}
      <ClientChangeRequestsPanel eventId={selectedEvent.id} />
      <ClientAddendaStatus eventId={selectedEvent.id} />
    </div>
  );
}
