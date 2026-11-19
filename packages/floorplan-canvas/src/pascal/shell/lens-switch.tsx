"use client";

import { usePrismFloorplan } from "../editor-context";
import { prismLens, usePrismLens, type PrismLens } from "../lens";

const LENSES: ReadonlyArray<{ lens: PrismLens; label: string }> = [
  { lens: "layout", label: "Layout" },
  { lens: "seating", label: "Seating" },
  { lens: "supplier-zones", label: "Supplier zones" },
];

const LATER = ["Sightlines", "Guest flow"];

const segment = "rounded px-2.5 py-1 text-xs font-medium";

/** How the plan is coloured. Seating appears only for events whose guests can be seated. */
export function LensSwitch() {
  const { seating } = usePrismFloorplan();
  const active = usePrismLens();
  const lenses = LENSES.filter(({ lens }) => lens !== "seating" || seating.allowed);
  return (
    <div role="group" aria-label="Lens" className="inline-flex items-center rounded-md bg-background/95 p-0.5 shadow-sm">
      {lenses.map(({ lens, label }) => (
        <button
          key={lens}
          type="button"
          aria-pressed={active === lens}
          onClick={() => prismLens.set(lens)}
          className={`${segment} text-muted-foreground aria-pressed:bg-muted aria-pressed:text-foreground`}
        >
          {label}
        </button>
      ))}
      {LATER.map((label) => (
        <span key={label} aria-disabled="true" title="Arrives with checks in milestone 4" className={`${segment} cursor-not-allowed text-muted-foreground/60`}>
          {label}
        </span>
      ))}
    </div>
  );
}
