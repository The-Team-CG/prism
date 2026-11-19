import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismZoneNode } from "@prism/types";
import { DASH, centredRect, label, placed } from "./symbol-kit";

/** Zones read as areas, not things: a soft blue wash inside a dashed blue edge, the zone's name in the same blue. */
const ZONE_BLUE = "#2f7fb5";

/** A supplier or service zone: a see-through tinted area with its label. */
export function zoneSymbol(node: PrismZoneNode): FloorplanGeometry {
  const area = { ...centredRect(node.width, node.depth), fill: ZONE_BLUE, fillOpacity: 0.08, stroke: ZONE_BLUE, strokeWidth: 0.02, strokeDasharray: DASH } as FloorplanGeometry;
  return placed(node, [area, label(node.label, 0, Math.min(0.6, node.width / Math.max(6, node.label.length * 0.6)), { fill: ZONE_BLUE, weight: 600 })]);
}
