"use client";

import { usePrismLens } from "../lens";
import { lensMarks, type LensMark } from "./lens-marks";
import { useLiveScene } from "./use-live-scene";

/** PRISM token colours: success for full tables, attention for part-full, muted for empty, blue for zones, red for a check's finding. */
const LOOKS: Record<LensMark["look"], { fill: string; opacity: number; stroke?: string }> = {
  full: { fill: "#1f7a4b", opacity: 0.45 },
  part: { fill: "#b8480f", opacity: 0.4 },
  empty: { fill: "#9a8a93", opacity: 0.25 },
  muted: { fill: "#fff8f2", opacity: 0.72 },
  zone: { fill: "#40a0d0", opacity: 0.22, stroke: "#40a0d0" },
  issue: { fill: "#c4242b", opacity: 0.3, stroke: "#c4242b" },
};

function Mark({ mark }: { mark: LensMark }) {
  const look = LOOKS[mark.look];
  const paint = { fill: look.fill, fillOpacity: look.opacity, stroke: look.stroke, strokeWidth: look.stroke ? 2 : 0, vectorEffect: "non-scaling-stroke" as const };
  return (
    <g transform={`translate(${mark.x} ${mark.y}) rotate(${(-mark.rotation * 180) / Math.PI})`} data-lens-look={mark.look}>
      {mark.round ? (
        <circle r={mark.width / 2} {...paint} />
      ) : (
        <rect x={-mark.width / 2} y={-mark.depth / 2} width={mark.width} height={mark.depth} {...paint} />
      )}
    </g>
  );
}

/** The lens drawn over the plan, in plan metres, never catching a click meant for the pieces beneath. */
export function LensOverlay() {
  const lens = usePrismLens();
  const scene = useLiveScene();
  const marks = lensMarks(scene, lens);
  if (marks.length === 0) return null;
  return (
    <g pointerEvents="none" aria-hidden>
      {marks.map((mark) => (
        <Mark key={mark.id} mark={mark} />
      ))}
    </g>
  );
}
