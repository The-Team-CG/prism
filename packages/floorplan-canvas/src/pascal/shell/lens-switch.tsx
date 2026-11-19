"use client";

import { usePrismFloorplan } from "../editor-context";
import { isCheckLens, prismLens, usePrismLens, type PrismLens } from "../lens";
import { lensIssues } from "./lens-marks";
import { useLiveScene } from "./use-live-scene";

const LENSES: ReadonlyArray<{ lens: PrismLens; label: string }> = [
  { lens: "layout", label: "Layout" },
  { lens: "seating", label: "Seating" },
  { lens: "supplier-zones", label: "Supplier zones" },
  { lens: "sightlines", label: "Sightlines" },
  { lens: "guest-flow", label: "Guest flow" },
];

/** How many findings the list shows before it says how many more there are. */
const SHOWN = 6;

const segment = "rounded px-2.5 py-1 text-xs font-medium";

/** What a check lens found, as sentences a planner can act on, under the lens switch. */
function LensFindings({ lens }: { lens: "sightlines" | "guest-flow" }) {
  const issues = lensIssues(useLiveScene(), lens);
  const clear = lens === "sightlines" ? "Every seat can see the stage." : "Nothing in the way: tables, aisles and exits are clear.";
  return (
    <div role="status" aria-label="Layout checks" className="mt-1 max-w-sm rounded-md bg-background/95 px-2.5 py-2 text-xs shadow-sm">
      {issues.length === 0 ? (
        <p className="text-muted-foreground">{clear}</p>
      ) : (
        <ul className="space-y-1">
          {issues.slice(0, SHOWN).map((issue) => (
            <li key={`${issue.kind}:${issue.pieceIds.join()}`} className="text-foreground">
              {issue.message}
            </li>
          ))}
          {issues.length > SHOWN ? <li className="text-muted-foreground">and {issues.length - SHOWN} more</li> : null}
        </ul>
      )}
    </div>
  );
}

/** How the plan is coloured, and what a check lens found. Seating appears only for events whose guests can be seated. */
export function LensSwitch() {
  const { seating } = usePrismFloorplan();
  const active = usePrismLens();
  const lenses = LENSES.filter(({ lens }) => lens !== "seating" || seating.allowed);
  return (
    <div>
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
      </div>
      {isCheckLens(active) ? <LensFindings lens={active} /> : null}
    </div>
  );
}
