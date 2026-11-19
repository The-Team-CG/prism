import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismSeatingBlockNode } from "@prism/types";
import { blockSeatSpots } from "@prism/floorplan-scene";
import { chairStyleOf } from "../dressing";
import { CHAIR_STROKE, INK, centredRect, chair, facingAway, placed } from "./symbol-kit";

/** A ceremony's aisle runner, down the middle of its aisle from the front row to the back. */
function runner(node: PrismSeatingBlockNode): FloorplanGeometry[] {
  if (node.style !== "ceremony" || node.aisle <= 0) return [];
  const pitch = (node.width - node.aisle) / node.columns;
  const centre = pitch * (Math.floor(node.columns / 2) - node.columns / 2);
  return [{ kind: "group", transform: { translate: [centre, 0] }, children: [{ ...centredRect(node.aisle * 0.8, node.depth + 1), fill: INK.page, ...CHAIR_STROKE } as FloorplanGeometry] }];
}

/**
 * Theater or ceremony rows of chairs, or classroom rows of desks with chairs behind them, all facing the front (−y) with
 * their backs to the rear, in the block's chair style.
 */
export function seatingBlockSymbol(node: PrismSeatingBlockNode): FloorplanGeometry {
  const pitch = node.depth / node.rows;
  const style = chairStyleOf(node.chairStyle);
  const rows = Array.from({ length: node.rows }, (_, row) => -node.depth / 2 + pitch * (row + 0.5));
  const desks: FloorplanGeometry[] =
    node.style === "classroom"
      ? rows.map((y) => ({ kind: "group", transform: { translate: [0, y - pitch * 0.28] }, children: [centredRect(node.width, pitch * 0.3, { fill: INK.surface })] }))
      : [];
  const chairs = blockSeatSpots(node).map(({ x, z, away: [dx, dz] }) => chair(x, z, facingAway(dx, dz), style));
  return placed(node, [centredRect(node.width, node.depth, { fill: "transparent", dashed: true }), ...runner(node), ...desks, ...chairs]);
}
