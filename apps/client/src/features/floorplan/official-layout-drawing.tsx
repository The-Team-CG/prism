"use client";

import type { ClientPlanLayout } from "./snapshot-project";
import { drawingOfScene } from "./drawing-of-scene";
import { PlanDrawingView } from "./plan-drawing-view";

/** The official layout, read-only. A layout saved without a scene is published but has nothing to draw yet. */
export function OfficialLayoutDrawing({ layout, className }: { layout: ClientPlanLayout; className?: string }) {
  const drawing = drawingOfScene(layout.scene);
  if (!drawing) {
    return <p className="px-8 py-10 text-center text-sm text-muted-foreground">This official layout record is published; room details will appear after the next update.</p>;
  }
  return <PlanDrawingView drawing={drawing} label={`Official layout: ${layout.name}`} className={className} />;
}
