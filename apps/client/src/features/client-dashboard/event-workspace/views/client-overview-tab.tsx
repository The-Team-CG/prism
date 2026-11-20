"use client";

import { derivePrismLifecycleStage, type PrismBillingStatement, type PrismBriefing, type PrismClientOcularVisit, type PrismDocument, type PrismEvent, type PrismFloorPlanDraft, type PrismPaymentMilestone } from "@prism/types";
import { manilaDateKey } from "@prism/ui/format-date";
import type { DetailTab } from "../../workspace/shared";
import { dashboardHref, useClientWorkspace } from "../../workspace/shared";
import { ClientNeedsYouPreview, orderNeedsYou } from "../../shared/client-action-lists";
import { clientChangeDeadline } from "../../shared/client-change-deadline";
import { gettingStartedSteps, ocularVisitLine, showGettingStarted, sinceLastVisitItems } from "../model/client-overview-glance";
import { useClientStageReached } from "../view-models/use-client-stage-reached";
import { comingUpForEvent } from "../../events/views/client-event-cards";
import { useEventCoverUrl } from "../../events/view-models/use-event-cover-url";
import { useClientNewFileCount } from "../../files";
import { useClientUnreadMessages } from "../../messages/view-models/use-client-unread-messages";
import { useClientUnreadNotices } from "../../notifications/view-models/use-client-unread-notices";
import {
  OverviewComingUp,
  OverviewEventDetails,
  OverviewFirstSteps,
  OverviewFloorPlanCard,
  OverviewNextDecision,
  OverviewNextPayment,
  OverviewSinceLastVisit,
  OverviewStageBanner,
  type ComingUpLine,
} from "./sections/client-overview-sections";

/** How many dated steps the overview lists. */
const COMING_UP_LIMIT = 4;

/**
 * The event at a glance, top to bottom: the event and the one step the client should take next (the same step the
 * Actions list leads with), the first steps while the event is new, the rest of what needs the client, then four
 * cards of facts. Change requests and addenda live on Planning; an addendum is read and signed in its own dialog.
 */
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
  const { actionCenter, clientActions, runClientAction, session } = useClientWorkspace();
  const todayKey = manilaDateKey();
  const nextAction = orderNeedsYou(clientActions.filter((action) => action.stage === "needs_client"))[0];
  const coverUrl = useEventCoverUrl(selectedEvent.id, selectedEvent.coverObjectId);
  const stage = useClientStageReached(session?.id, selectedEvent.id, derivePrismLifecycleStage(selectedEvent));
  const unreadMessages = useClientUnreadMessages({ eventId: selectedEvent.id });
  const unreadNotices = useClientUnreadNotices();
  const newFiles = useClientNewFileCount(session?.id, selectedEvent.id, documents);
  const sinceItems = sinceLastVisitItems({ unreadMessages, newFiles, unreadNotices });
  const steps = gettingStartedSteps({ event: selectedEvent, hasBriefing: Boolean(briefing), hasLayoutIdeas: preferenceDraftCount > 0 || Boolean(officialDraft), payments });
  const visit = ocularVisitLine(ocularVisit);
  const cutoff = clientChangeDeadline(selectedEvent, todayKey);
  const dated: ComingUpLine[] = [
    ...(visit ? [{ id: "ocular-visit", ...visit }] : []),
    ...comingUpForEvent(selectedEvent, actionCenter?.items ?? [], COMING_UP_LIMIT).map((item) => ({ id: item.id, label: item.label, at: item.dueAt ?? null, href: item.href })),
    ...(cutoff?.kind === "open" ? [{ id: "change-cutoff", label: "Change requests close", at: cutoff.deadlineAt, href: dashboardHref("changes", selectedEvent.id), allDay: true }] : []),
  ];
  // The event day always closes the list, so it is never empty.
  const comingUp = dated
    .sort((a, b) => (a.at ?? "9999").localeCompare(b.at ?? "9999"))
    .slice(0, COMING_UP_LIMIT - 1)
    .concat({ id: "event-day", label: "Event day", at: selectedEvent.eventDate, allDay: true });
  const since = <OverviewSinceLastVisit eventId={selectedEvent.id} items={sinceItems} loaded={unreadMessages !== undefined && newFiles !== undefined && unreadNotices !== undefined} />;

  return (
    <div className="space-y-6">
      <OverviewStageBanner message={stage.message} onDismiss={stage.dismiss} />
      <OverviewNextDecision selectedEvent={selectedEvent} nextAction={nextAction} onAction={runClientAction} coverUrl={coverUrl} since={since} />
      {afterLead}
      {showGettingStarted(selectedEvent, steps) ? <OverviewFirstSteps steps={steps} setTab={setTab} /> : null}
      <ClientNeedsYouPreview
        actions={clientActions}
        onAction={runClientAction}
        todayKey={todayKey}
        leadActionId={nextAction?.id}
        allHref={dashboardHref("actions", selectedEvent.id)}
      />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <OverviewComingUp lines={comingUp} />
        <OverviewEventDetails selectedEvent={selectedEvent} briefing={briefing} setTab={setTab} />
        <OverviewFloorPlanCard
          officialDraft={officialDraft}
          preferenceDraftCount={preferenceDraftCount}
          onOpenOfficialFloorplan={onOpenOfficialFloorplan}
          setTab={setTab}
        />
        <OverviewNextPayment billing={billing} payments={payments} setTab={setTab} />
      </div>
    </div>
  );
}
