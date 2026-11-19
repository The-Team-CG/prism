"use client";

import dynamic from "next/dynamic";
import type { PrismEvent, PrismFloorPlanDraft } from "@prism/types";
import { Button } from "@prism/ui/components/button";
import { OfficialLayoutDrawing } from "@/features/floorplan/official-layout-drawing";
import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";

const OfficialLayoutViewer = dynamic(
  () => import("@/features/floorplan/official-layout-viewer").then((mod) => mod.OfficialLayoutViewer),
  {
    ssr: false,
    loading: () => <div className="grid size-full place-items-center bg-background text-sm text-muted-foreground">Loading layout view...</div>,
  },
);

/**
 * The official floor plan, full screen and read-only, in the Pascal editor PMCM drew it in, so the client sees it as
 * built. A layout record with no scene has nothing for the editor to open, so it falls back to a short note.
 */
export function ClientOfficialLayoutScreen({ event, draft, layout, onBack }: {
  event: PrismEvent;
  draft: PrismFloorPlanDraft;
  layout: ClientPlanLayout;
  onBack: () => void;
}) {
  if (layout.scene) {
    return (
      <main className="h-screen w-full overflow-hidden bg-background">
        <OfficialLayoutViewer scene={layout.scene} eventName={event.eventName} draftName={draft.name} draftStatus={draft.status} onBack={onBack} />
      </main>
    );
  }
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
