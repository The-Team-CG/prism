import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismSeatingBlockNode } from "@prism/types";
import { chairStyleOf } from "../dressing";
import { CHAIR_STROKE, INK, centredRect, chair, facingAway, placed } from "./symbol-kit";

/** Chair centres across the block, leaving the aisle between the two middle columns. */
function columnCentres(node: PrismSeatingBlockNode): number[] {
  const pitch = (node.width - node.aisle) / node.columns;
  const half = Math.floor(node.columns / 2);
  return Array.from({ length: node.columns }, (_, column) => -node.width / 2 + pitch * (column + 0.5) + (column >= half && node.aisle > 0 ? node.aisle : 0));
}

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
  const xs = columnCentres(node);
  const style = chairStyleOf(node.chairStyle);
  const rows = Array.from({ length: node.rows }, (_, row) => -node.depth / 2 + pitch * (row + 0.5));
  const desks: FloorplanGeometry[] =
    node.style === "classroom"
      ? rows.map((y) => ({ kind: "group", transform: { translate: [0, y - pitch * 0.28] }, children: [centredRect(node.width, pitch * 0.3, { fill: INK.surface })] }))
      : [];
  const towardBack = facingAway(0, 1);
  const chairs = rows.flatMap((y) => xs.map((x) => chair(x, node.style === "classroom" ? y + pitch * 0.12 : y, towardBack, style)));
  return placed(node, [centredRect(node.width, node.depth, { fill: "transparent", dashed: true }), ...runner(node), ...desks, ...chairs]);
}
