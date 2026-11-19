import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismSeatingBlockNode } from "@prism/types";
import { INK, centredRect, chair, placed } from "./symbol-kit";

/** Chair centres across the block, leaving the aisle between the two middle columns. */
function columnCentres(node: PrismSeatingBlockNode): number[] {
  const pitch = (node.width - node.aisle) / node.columns;
  const half = Math.floor(node.columns / 2);
  return Array.from({ length: node.columns }, (_, column) => -node.width / 2 + pitch * (column + 0.5) + (column >= half && node.aisle > 0 ? node.aisle : 0));
}

/** Theater rows of chairs, or classroom rows of desks with chairs behind them, all facing the front (−y). */
export function seatingBlockSymbol(node: PrismSeatingBlockNode): FloorplanGeometry {
  const pitch = node.depth / node.rows;
  const xs = columnCentres(node);
  const rows = Array.from({ length: node.rows }, (_, row) => -node.depth / 2 + pitch * (row + 0.5));
  const desks: FloorplanGeometry[] =
    node.style === "classroom"
      ? rows.map((y) => ({ kind: "group", transform: { translate: [0, y - pitch * 0.28] }, children: [centredRect(node.width, pitch * 0.3, { fill: INK.surface })] }))
      : [];
  const chairs = rows.flatMap((y) => xs.map((x) => chair(x, node.style === "classroom" ? y + pitch * 0.12 : y, Math.PI, "banquet")));
  return placed(node, [centredRect(node.width, node.depth, { fill: "transparent", dashed: true }), ...desks, ...chairs]);
}
