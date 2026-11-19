import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismTableNode } from "@prism/types";
import { accentOf, chairStyleOf, fabricOf } from "../dressing";
import { CHAIR_CENTRE_OUTSET_M, joinedRuns, RUN_DEPTH_M, seatSpots, type TableRun } from "@prism/floorplan-scene";
import { LOOK, centredRect, chair, facingAway, label, placed, shade, shadowOf } from "./symbol-kit";

/** How far the linen hangs past the table top, seen from above. */
const LINEN_M = 0.06;
/** A cover's plate centre, measured in from the chair's centre toward the table. */
const COVER_IN_M = CHAIR_CENTRE_OUTSET_M + 0.2;

/** A cloth's look: filled in its linen colour, edged a shade darker, clickable as the table. */
const cloth = (fill: string) => ({ fill, stroke: shade(fill, 0.18), strokeWidth: 0.012, pointerEvents: "all" });

/** A run of table under its cloth, centred where the run lies. */
function runCloth({ length, centre: [x, z], alongZ }: TableRun, depth: number, linen: string): FloorplanGeometry[] {
  const [w, d] = alongZ ? [depth, length] : [length, depth];
  const body = { ...centredRect(w + 2 * LINEN_M, d + 2 * LINEN_M), ...cloth(linen) } as FloorplanGeometry;
  return [{ kind: "group", transform: { translate: [x, z] }, children: [shadowOf(body), body] }];
}

/** The overlay on a round table, a square set on the diagonal; on a long table, a runner down its length. */
function overlay(node: PrismTableNode, fill: string): FloorplanGeometry[] {
  const satin = { fill, stroke: shade(fill, 0.15), strokeWidth: 0.008 };
  if (node.shape === "round") {
    const side = node.width * 0.74;
    return [{ kind: "group", transform: { rotate: Math.PI / 4 }, children: [{ ...centredRect(side, side), ...satin } as FloorplanGeometry] }];
  }
  if (node.shape === "rect") return [{ ...centredRect(node.width + 0.1, 0.34), ...satin } as FloorplanGeometry];
  return [];
}

/** The cloth over the table, its shadow, and any overlay. */
function tableCloth(node: PrismTableNode): FloorplanGeometry[] {
  const linen = fabricOf(node.linen).fill;
  const overlayFabric = accentOf(node.overlay);
  const accent = overlayFabric ? overlay(node, overlayFabric.fill) : [];
  if (node.shape === "u-shape" || node.shape === "hollow-square") return joinedRuns(node).flatMap((run) => runCloth(run, RUN_DEPTH_M, linen));
  if (node.shape === "rect") {
    const body = { ...centredRect(node.width + 2 * LINEN_M, node.depth + 2 * LINEN_M), ...cloth(linen) } as FloorplanGeometry;
    return [shadowOf(body), body, ...accent];
  }
  const radius = node.width / 2;
  const body = { kind: "circle", cx: 0, cy: 0, r: radius + LINEN_M, ...cloth(linen) } as FloorplanGeometry;
  const topEdge = { kind: "circle", cx: 0, cy: 0, r: radius - 0.02, fill: "none", stroke: shade(linen, 0.08), strokeWidth: 0.006 } as FloorplanGeometry;
  return [shadowOf(body), body, topEdge, ...accent];
}

/** A cover laid at each seat: a gold charger under a white plate, in from the chair toward the table. */
function covers(node: PrismTableNode, linen: string): FloorplanGeometry[] {
  if (node.shape === "cocktail") return [];
  return seatSpots(node).flatMap(({ x, z, away: [dx, dz] }) => {
    const [cx, cy] = [x - dx * COVER_IN_M, z - dz * COVER_IN_M];
    return [
      { kind: "circle", cx, cy, r: 0.15, fill: LOOK.gold, stroke: shade(LOOK.gold, 0.2), strokeWidth: 0.005 } as FloorplanGeometry,
      { kind: "circle", cx, cy, r: 0.12, fill: LOOK.china, stroke: shade(linen, 0.2), strokeWidth: 0.005 } as FloorplanGeometry,
    ];
  });
}

/** A table's name: its label, else its number. */
const tableName = (node: PrismTableNode) => (typeof node.label === "string" && node.label ? node.label : node.number ? String(node.number) : "");

/** Where a table's name sits: at its centre, or on the back run of a U or hollow square. */
const nameY = (node: PrismTableNode) => (node.shape === "u-shape" || node.shape === "hollow-square" ? -node.depth / 2 + RUN_DEPTH_M / 2 : 0);

/**
 * A table from above, as a presentation plan draws it: its chairs where its 3D design seats them, in their style's colours
 * with their sash's bow; its cloth in its linen colour over a soft shadow, with any overlay; a cover at each seat; and its
 * number set large in the middle.
 */
export function tableSymbol(node: PrismTableNode & { label?: unknown }): FloorplanGeometry {
  const style = chairStyleOf(node.chairStyle);
  const sash = accentOf(node.sash)?.fill;
  const chairs = seatSpots(node).map(({ x, z, away: [dx, dz] }) => chair(x, z, facingAway(dx, dz), style, sash));
  const name = tableName(node);
  const fontSize = Math.min(0.5, Math.max(0.22, Math.min(node.width, node.depth) / 4.2));
  const number = name ? [label(name, nameY(node), fontSize, { fill: LOOK.number, weight: 700 })] : [];
  return placed(node, [...chairs, ...tableCloth(node), ...covers(node, fabricOf(node.linen).fill), ...number]);
}
