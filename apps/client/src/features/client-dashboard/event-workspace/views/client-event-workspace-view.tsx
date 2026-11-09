"use client";

import { LockKeyhole } from "lucide-react";
import { ClientListEmpty } from "../../shared/client-list-ui";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientEventRouteBody } from "./client-event-route-body";

export function ClientEventWorkspaceView() {
  const { selectedEvent, eventHeader } = useClientWorkspace();

  if (!selectedEvent) {
    return (
      <ClientListEmpty
        icon={LockKeyhole}
        title="No active event portal"
        description="The client event workspace opens after PMCM accepts your inquiry and both you and PMCM acknowledge the conforme."
      />
    );
  }

  return (
    <div className="space-y-5">
      {eventHeader}
      <ClientEventRouteBody />
    </div>
  );
}
