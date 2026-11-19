import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismTableNode } from "@prism/types";
import { accentOf, chairStyleOf, fabricOf } from "../dressing";
import { joinedRuns, RUN_DEPTH_M, seatSpots, type TableRun } from "@prism/floorplan-scene";
import { CHAIR_STROKE, DASH, INK, PIECE_STROKE, centredRect, chair, facingAway, label, placed } from "./symbol-kit";

/** How far the linen hangs past the table top; the linen ring is laid in lightly so the plan stays a drawing. */
const LINEN_M = 0.06;
const LINEN_OPACITY = 0.5;

const linenRing = (fill: string) => ({ fill, fillOpacity: LINEN_OPACITY, ...CHAIR_STROKE, strokeDasharray: DASH });

/** A run of table: its linen and its top, centred where the run lies. */
function runTop({ length, centre: [x, z], alongZ }: TableRun, depth: number, linen: string): FloorplanGeometry {
  const [w, d] = alongZ ? [depth, length] : [length, depth];
  return {
    kind: "group",
    transform: { translate: [x, z] },
    children: [{ ...centredRect(w + 2 * LINEN_M, d + 2 * LINEN_M, { dashed: true }), ...linenRing(linen) } as FloorplanGeometry, centredRect(w, d)],
  };
}

/** The overlay on a round table, a square set on the diagonal; on a long table, a runner down its length. */
function overlay(node: PrismTableNode, fill: string): FloorplanGeometry[] {
  if (node.shape === "round") {
    const side = node.width * 0.72;
    return [{ kind: "group", transform: { rotate: Math.PI / 4 }, children: [{ ...centredRect(side, side), fill, fillOpacity: LINEN_OPACITY, ...CHAIR_STROKE } as FloorplanGeometry] }];
  }
  if (node.shape === "rect") return [{ ...centredRect(node.width + 0.1, 0.35), fill, fillOpacity: LINEN_OPACITY, ...CHAIR_STROKE } as FloorplanGeometry];
  return [];
}

function tableTop(node: PrismTableNode): FloorplanGeometry[] {
  const linen = fabricOf(node.linen).fill;
  const overlayFabric = accentOf(node.overlay);
  const accent = overlayFabric ? overlay(node, overlayFabric.fill) : [];
  if (node.shape === "u-shape" || node.shape === "hollow-square") return joinedRuns(node).map((run) => runTop(run, RUN_DEPTH_M, linen));
  if (node.shape === "rect") {
    return [{ ...centredRect(node.width + 2 * LINEN_M, node.depth + 2 * LINEN_M, { dashed: true }), ...linenRing(linen) } as FloorplanGeometry, centredRect(node.width, node.depth), ...accent];
  }
  const radius = node.width / 2;
  return [
    { kind: "circle", cx: 0, cy: 0, r: radius + LINEN_M, ...linenRing(linen) },
    { kind: "circle", cx: 0, cy: 0, r: radius, fill: INK.surface, ...PIECE_STROKE, pointerEvents: "all" } as FloorplanGeometry,
    ...accent,
  ];
}

const tableName = (node: PrismTableNode) => (typeof node.label === "string" && node.label ? node.label : node.number ? `T${node.number}` : "");

/** Where a table's name sits: at its centre, or on the back run of a U or hollow square. */
const nameY = (node: PrismTableNode) => (node.shape === "u-shape" || node.shape === "hollow-square" ? -node.depth / 2 + RUN_DEPTH_M / 2 : 0);

/**
 * A table from above: its chairs where its 3D design seats them, in their style with their sash, the linen and any
 * overlay in their colours, the top, and its number.
 */
export function tableSymbol(node: PrismTableNode & { label?: unknown }): FloorplanGeometry {
  const style = chairStyleOf(node.chairStyle);
  const sash = accentOf(node.sash)?.fill;
  const chairs = seatSpots(node).map(({ x, z, away: [dx, dz] }) => chair(x, z, facingAway(dx, dz), style, sash));
  const name = tableName(node);
  const fontSize = Math.min(0.4, Math.max(0.2, Math.min(node.width, node.depth) / 4));
  return placed(node, [...chairs, ...tableTop(node), ...(name ? [label(name, nameY(node), fontSize)] : [])]);
}
