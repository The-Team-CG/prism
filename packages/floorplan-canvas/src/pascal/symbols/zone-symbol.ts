import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismZoneNode } from "@prism/types";
import { centredRect, label, placed } from "./symbol-kit";

/** A supplier zone: a dashed, see-through area with its label. */
export function zoneSymbol(node: PrismZoneNode): FloorplanGeometry {
  return placed(node, [centredRect(node.width, node.depth, { fill: "transparent", dashed: true }), label(node.label, 0, Math.min(0.6, node.width / Math.max(6, node.label.length * 0.6)))]);
}
