"use client";

import { EventTasksWorkspace } from "./event-tasks-workspace";
import { isPmcmAdmin } from "@/app/lib/role-guards";
import { useEventDashboardLoadedRouteViewModel } from "../event-dashboard-route-context";

export function EventDashboardTasksSectionView() {
  const {
    unreviewedInquiries,
    pendingApprovals,
    selectedEvent,
    selectedEventWorkspace,
    session,
    busy,
    scheduleOcularVisit,
    completeOcularVisit,
    waiveOcularVisit,
    defenseReadiness,
    commandInbox,
    drafts,
    quotes,
    payments,
    openCheckCount,
    navigateSection,
    navigateEventTab,
  } = useEventDashboardLoadedRouteViewModel();
  return (

          <EventTasksWorkspace
            unreviewedInquiries={unreviewedInquiries}
            pendingApprovals={pendingApprovals}
            selectedEvent={selectedEvent}
            ocularVisit={selectedEventWorkspace?.event.id === selectedEvent?.id
              ? selectedEventWorkspace?.ocularVisit ?? null
              : null}
            isAdmin={isPmcmAdmin(session.role)}
            busy={busy !== null}
            onScheduleOcularVisit={scheduleOcularVisit}
            onCompleteOcularVisit={completeOcularVisit}
            onWaiveOcularVisit={waiveOcularVisit}
            defenseReadiness={defenseReadiness}
            commandInbox={commandInbox}
            draftsCount={drafts.length}
            quoteCount={quotes.length}
            paymentCount={payments.length}
            openCheckCount={openCheckCount}
            onNavigateSection={navigateSection}
            onNavigateEventTab={(nextTab) => navigateEventTab(nextTab)}
          />
  );
}
