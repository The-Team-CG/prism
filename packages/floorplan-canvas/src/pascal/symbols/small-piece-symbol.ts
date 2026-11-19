import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismPieceNode } from "@prism/types";
import { CHAIR_STROKE, DASH, INK, PIECE_STROKE, centredRect, label, placed } from "./symbol-kit";

/** Pieces that stand on a round footprint, drawn as a circle. */
const ROUND = new Set(["cake-table", "plant", "umbrella", "uplight", "extinguisher"]);
/** Pieces marked on the floor rather than standing on it, drawn dashed with no fill. */
const MARKED = new Set(["emergency-exit", "wheelchair-space", "string-lights"]);
/** Pieces too small for a name, which only need their outline. */
const UNLABELLED = new Set(["uplight", "plant", "extinguisher", "power"]);

const WORDS: Record<string, string> = { led: "LED", foh: "FOH", av: "AV" };

function variantName(variant: string): string {
  const words = variant.split(/[-_\s]+/).filter(Boolean).map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase());
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}

function outline(node: PrismPieceNode): FloorplanGeometry {
  if (ROUND.has(node.variant)) {
    return { kind: "circle", cx: 0, cy: 0, r: Math.min(node.width, node.depth) / 2, fill: INK.surface, ...PIECE_STROKE, pointerEvents: "all" } as FloorplanGeometry;
  }
  if (MARKED.has(node.variant)) return { ...centredRect(node.width, node.depth), fill: INK.page, fillOpacity: 0.6, ...CHAIR_STROKE, strokeDasharray: DASH } as FloorplanGeometry;
  return centredRect(node.width, node.depth);
}

/** Every other piece: its footprint and a short name, from its own label or its variant ("led-wall" → "LED wall"). */
export function smallPieceSymbol(node: PrismPieceNode, fallback: string): FloorplanGeometry {
  const name = node.label || variantName(node.variant) || fallback;
  const fontSize = Math.max(0.12, Math.min(0.3, node.width / Math.max(name.length, 1), node.depth * 0.6));
  return placed(node, [outline(node), ...(UNLABELLED.has(node.variant) && !node.label ? [] : [label(name, 0, fontSize)])]);
}
