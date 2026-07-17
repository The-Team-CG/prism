"use client";

import { ClientBriefingTab } from "../../briefing";
import { useClientWorkspace } from "../../workspace/shared";
import { ClientFloorPlanView } from "./client-floorplan-view";

export function ClientPreferencesView() {
  const { briefing } = useClientWorkspace();

  return (
    <div className="space-y-5">
      <ClientBriefingTab briefing={briefing} />
      <ClientFloorPlanView />
    </div>
  );
}
