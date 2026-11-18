import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismPieceNode } from "@prism/types";
import { centredRect, label, placed } from "./symbol-kit";

/** Every other piece: its footprint and a short name, from its own label or its variant ("led-wall" → "LED wall"). */
export function smallPieceSymbol(node: PrismPieceNode, fallback: string): FloorplanGeometry {
  const name = node.label || variantName(node.variant) || fallback;
  const fontSize = Math.max(0.12, Math.min(0.3, node.width / Math.max(name.length, 1), node.depth * 0.6));
  return placed(node, [centredRect(node.width, node.depth), label(name, 0, fontSize)]);
}

const WORDS: Record<string, string> = { led: "LED", foh: "FOH", av: "AV" };

function variantName(variant: string): string {
  const words = variant.split(/[-_\s]+/).filter(Boolean).map((word) => WORDS[word.toLowerCase()] ?? word.toLowerCase());
  const [first = "", ...rest] = words;
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" ");
}
