"use client";

import type { ReactNode } from "react";
import { prismTableShapes, type PrismTableNode } from "@prism/types";
import { usePrismFloorplan } from "../editor-context";
import { Segmented } from "../shell/segmented";

type Shape = PrismTableNode["shape"];

const stroke = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinejoin: "round" as const };

/** Each shape drawn top-down, as the Library tiles and the plan draw it. */
const SHAPES: Record<Shape, { title: string; glyph: ReactNode }> = {
  round: { title: "Round", glyph: <circle cx="8" cy="8" r="5.5" {...stroke} /> },
  rect: { title: "Long", glyph: <rect x="1.5" y="5" width="13" height="6" rx="0.8" {...stroke} /> },
  cocktail: { title: "Cocktail", glyph: <circle cx="8" cy="8" r="3" {...stroke} /> },
  "u-shape": { title: "U-shape", glyph: <path d="M2 3h3.5v7h5V3H14v10.5H2z" {...stroke} /> },
  "hollow-square": { title: "Hollow square", glyph: <path d="M2 2h12v12H2zM5.5 5.5h5v5h-5z" {...stroke} /> },
};

const options = prismTableShapes.map((shape) => ({
  value: shape,
  title: SHAPES[shape].title,
  label: (
    <svg viewBox="0 0 16 16" className="size-4" aria-hidden>
      {SHAPES[shape].glyph}
    </svg>
  ),
}));

/** The table's shape as five drawn buttons; picking one reshapes the table as the shape field always has. */
export function ShapeField({ node, onUpdate }: { node: PrismTableNode; onUpdate: (patch: Partial<PrismTableNode>) => void }) {
  const { readOnly } = usePrismFloorplan();
  return (
    <fieldset disabled={readOnly} className="space-y-1.5 px-3 py-1.5">
      <legend className="flex w-full justify-between text-xs text-foreground/80">
        Shape
        <span className="text-muted-foreground">{SHAPES[node.shape].title}</span>
      </legend>
      <Segmented label="Shape" fill options={options} value={node.shape} onChange={(shape) => onUpdate({ shape })} />
    </fieldset>
  );
}
