"use client";

import { ClientBriefingTab } from "../../briefing";
import { useClientWorkspace } from "../../workspace/client-workspace-context";
import { ClientFloorPlanPage } from "./client-floorplan-page";

export function ClientPreferencesPage() {
  const { briefing } = useClientWorkspace();

  return (
    <div className="space-y-5">
      <ClientBriefingTab briefing={briefing} />
      <ClientFloorPlanPage />
    </div>
  );
}
