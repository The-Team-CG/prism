"use client";

import { usePrismFloorplan } from "../editor-context";
import { prismLens, usePrismLens, type PrismLens } from "../lens";
import { Segmented } from "./segmented";

const LENSES: ReadonlyArray<{ value: PrismLens; label: string }> = [
  { value: "layout", label: "Layout" },
  { value: "seating", label: "Seating" },
  { value: "supplier-zones", label: "Zones" },
  { value: "sightlines", label: "Sightlines" },
  { value: "guest-flow", label: "Guest flow" },
];

const CHECK_LENSES: ReadonlySet<PrismLens> = new Set(["sightlines", "guest-flow"]);

/**
 * How the plan is coloured, floating at the top of the canvas. Seating appears only for events whose guests can be
 * seated; what a check lens finds is listed in the inspector's Plan panel.
 */
export function LensSwitch() {
  const { seating, presentation } = usePrismFloorplan();
  const active = usePrismLens();
  // A presented plan keeps the lenses that show the plan; the check lenses are the planner's.
  const lenses = LENSES.filter(({ value }) => (value !== "seating" || seating.allowed) && !(presentation && CHECK_LENSES.has(value)));
  return (
    <div className="pointer-events-none absolute inset-x-0 top-3 z-20 flex justify-center">
      <div className="pointer-events-auto rounded-[11px] bg-background/90 p-[3px] shadow-[0_0_0_1px_rgb(24_19_26/0.08),0_4px_16px_rgb(24_19_26/0.08)] backdrop-blur">
        <Segmented label="Lens" track={false} options={lenses} value={active} onChange={prismLens.set} />
      </div>
    </div>
  );
}
