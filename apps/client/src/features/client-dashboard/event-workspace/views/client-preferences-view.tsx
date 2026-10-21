"use client";

import { ClientBriefingTab } from "../../briefing";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientFloorPlanView } from "./client-floorplan-view";

export function ClientPreferencesView() {
  const ctx = useClientWorkspace();

  return (
    <div className="space-y-5">
      {ctx.selectedEvent ? <ClientBriefingTab eventId={ctx.selectedEvent.id} briefing={ctx.briefing} busy={ctx.busy === "briefing"} onSubmit={ctx.submitBriefing} /> : null}
      <ClientFloorPlanView />
    </div>
  );
}
