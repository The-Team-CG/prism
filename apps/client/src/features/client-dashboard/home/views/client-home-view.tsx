"use client";

import { dashboardHref } from "../../workspace/shared";
import { Button } from "@/app/components/ui/button";
import { CLIENT_CONFORME_REVIEW_HREF } from "../../workspace/model/client-dashboard-navigation";
import { selectClientAccountActions } from "../../workspace/model/client-dashboard-selectors";
import { useClientWorkspace } from "../../workspace/shared";
import {
  ClientHomeActionCenter,
  ClientHomeEvents,
} from "./sections/client-home-sections";

export function ClientHomeView() {
  const {
    router,
    state,
    actionCenter,
    actionCenterLoadFailed,
    events,
    setSelectedEventId,
    runClientAction,
  } = useClientWorkspace();
  if (!state) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => router.push("/dashboard/request")}>New event request</Button>
        <Button variant="outline" onClick={() => router.push(CLIENT_CONFORME_REVIEW_HREF)}>Review conforme</Button>
      </div>
      {actionCenter || actionCenterLoadFailed ? (
        <ClientHomeActionCenter
          actionCenter={actionCenter}
          clientActions={selectClientAccountActions(actionCenter)}
          runClientAction={runClientAction}
          loadFailed={actionCenterLoadFailed}
        />
      ) : null}

      <ClientHomeEvents
        events={events}
        onViewAll={() => router.push("/dashboard/events")}
        onRequest={() => router.push("/dashboard/request")}
        onOpen={(eventId) => {
          setSelectedEventId(eventId);
          router.push(dashboardHref("overview", eventId));
        }}
      />
    </div>
  );
}
