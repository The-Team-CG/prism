"use client";

import type { ClientPlanLayout } from "@/features/floorplan/snapshot-project";
import { drawingOfScene } from "@/features/floorplan/drawing-of-scene";
import { PlanDrawingView } from "@/features/floorplan/plan-drawing-view";

const metres = (value: number) => Number(value.toFixed(2));

export function LayoutPreview({ layout }: { layout: ClientPlanLayout | null }) {
  if (!layout) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-8 py-10 text-center text-sm text-muted-foreground">
        Official layout preview will appear here after your event team publishes it.
      </div>
    );
  }
  const drawing = drawingOfScene(layout.scene);
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface-raised">
      <div className="grid min-h-60 place-items-center bg-[linear-gradient(#EAD5CE_1px,transparent_1px),linear-gradient(90deg,#EAD5CE_1px,transparent_1px)] bg-size-[28px_28px] p-4">
        {drawing ? (
          <PlanDrawingView drawing={drawing} label={`Official layout: ${layout.name}`} className="max-h-80 w-full" />
        ) : (
          <div className="px-8 py-10 text-center text-sm text-muted-foreground">
            This official layout record is published; room details will appear after the next update.
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-card px-4 py-3 text-xs text-muted-foreground">
        <span>{layout.name}</span>
        {drawing ? <span>{metres(drawing.room.width)}m x {metres(drawing.room.depth)}m</span> : null}
      </div>
    </div>
  );
}
