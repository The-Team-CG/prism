"use client";

import { dashboardHref, formatStatusLabel } from "../../workspace/shared";
import { CLIENT_CONFORME_REVIEW_HREF } from "../../workspace/model/client-dashboard-navigation";
import { useClientWorkspace } from "../../workspace/shared";
import {
  ClientHomeActionCenter,
  ClientHomeEvents,
  ClientHomeGreeting,
  ClientHomeSnapshots,
  ClientHomeUpdates,
  daysUntilEvent,
} from "./sections/client-home-sections";

export function ClientHomeView() {
  const {
    router,
    session,
    state,
    actionCenter,
    actionCenterLoadFailed,
    events,
    selectedEvent,
    setSelectedEventId,
    officialDraft,
    documents,
    payments,
    clientActions,
    nextAction,
    notifications,
    navigateToEventRoute,
    runClientAction,
  } = useClientWorkspace();
  if (!state) return null;

  const daysToEvent = daysUntilEvent(selectedEvent?.eventDate);
  const nextOpenPayment = payments.find((p) => p.status !== "paid");
  const documentsNeedingReview = documents.filter((document) => /needs|pending|requested/i.test(document.status));
  const layoutStatus = officialDraft ? formatStatusLabel(officialDraft.status) : "Not started";

  return (
    <div className="space-y-6">
      {/* The action center is the dashboard entry point: next required actions come before everything else. */}
      {actionCenter || actionCenterLoadFailed ? (
        <ClientHomeActionCenter
          actionCenter={actionCenter}
          clientActions={clientActions}
          runClientAction={runClientAction}
          loadFailed={actionCenterLoadFailed}
        />
      ) : null}

      <ClientHomeGreeting
        sessionName={session.name}
        eventCount={events.length}
        daysToEvent={daysToEvent}
        onRequest={() => router.push("/dashboard/request")}
        onEvents={() => router.push("/dashboard/events")}
        onReviewConforme={() => router.push(CLIENT_CONFORME_REVIEW_HREF)}
      />

      {selectedEvent ? (
        <ClientHomeSnapshots
          nextAction={nextAction}
          layoutStatus={layoutStatus}
          nextOpenPayment={nextOpenPayment}
          documentsNeedingReview={documentsNeedingReview}
          runClientAction={runClientAction}
          navigateToEventRoute={navigateToEventRoute}
        />
      ) : null}

      <ClientHomeEvents
        events={events}
        state={state}
        onViewAll={() => router.push("/dashboard/events")}
        onRequest={() => router.push("/dashboard/request")}
        onOpen={(eventId) => {
          setSelectedEventId(eventId);
          router.push(dashboardHref("overview", eventId));
        }}
        onOpenFloorplan={(eventId) => {
          setSelectedEventId(eventId);
          router.push(dashboardHref("floorplan", eventId));
        }}
      />

      <ClientHomeUpdates notifications={notifications} />
    </div>
  );
}
