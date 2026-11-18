"use client";

import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { OfficialLayoutDrawing } from "@/features/floorplan/official-layout-drawing";
import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";

/** The official floor plan, read-only. PMCM owns it, so the client views the drawn layout without the editor. */
export function ClientOfficialLayoutScreen({ event, draft, layout, onBack }: {
  event: PrismEvent;
  draft: PrismFloorPlanDraft;
  layout: ClientPlanLayout;
  onBack: () => void;
}) {
  return (
    <main className="min-h-screen w-full space-y-4 bg-background p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{event.eventName}</p>
          <h1 className="text-xl font-semibold text-foreground">{draft.name}</h1>
        </div>
        <Button variant="outline" onClick={onBack}>Back to floor plan</Button>
      </div>
      <div className="grid place-items-center overflow-hidden rounded-lg border border-border bg-background p-4">
        <OfficialLayoutDrawing layout={layout} className="max-h-[75dvh] w-full" />
      </div>
    </main>
  );
}
