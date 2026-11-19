import type { PrismSeatingBlockNode } from "@prism/types";
import { CHAIR_PARAMETERS, chairShapes } from "./chairs";
import { box, count, designOf, div, INDEX, mul, param, part, sub, add, type EventDesign } from "./kit";

/** A classroom desk sits in front of its row of chairs, a fraction of a row's pitch away. */
const DESK_SETBACK = 0.28;
const CHAIR_SETBACK = 0.12;

/**
 * One chair on its own. A block repeats it with instancing: Pascal's designs build at most 512 shapes, which a 300-seat
 * block of six-shape chairs would pass, and one shared chair draws a large block in a single call per material.
 */
export function chairDesign(): EventDesign {
  const recipe = designOf({
    name: "Chair",
    description: "One event chair; its style comes from its slots.",
    parameters: [...CHAIR_PARAMETERS],
    parts: [part("chair", "Chair", 1, chairShapes())],
  });
  return { recipe, values: {} };
}

/** A classroom block's desks: one per row, in front of that row's chairs. A theater block has none. */
export function deskDesign(node: PrismSeatingBlockNode): EventDesign | null {
  if (node.style !== "classroom") return null;
  const pitch = div("depth", "rows");
  const deskZ = sub(add(mul(-0.5, "depth"), mul(pitch, add(INDEX, 0.5))), mul(pitch, DESK_SETBACK));
  const recipe = designOf({
    name: "Classroom desks",
    description: "A desk in front of each row of a classroom block.",
    parameters: [param("width", "Width", 2, 0.5, 30, "m"), param("depth", "Depth", 4.5, 0.5, 30, "m"), count("rows", "Rows", 5, 1, 64)],
    parts: [
      part("desks", "Desks", "rows", [
        box("desk_top", "desk", ["width", 0.03, mul(pitch, 0.3)], [0, 0.74, deskZ]),
        box("desk_panel", "desk", ["width", 0.71, 0.03], [0, 0.355, deskZ]),
      ]),
    ],
  });
  return { recipe, values: { width: node.width, depth: node.depth, rows: node.rows } };
}

/** Where each chair of a block stands, in the block's frame: rows front to back, columns split by the aisle. */
export function seatingChairPositions(node: PrismSeatingBlockNode): Array<[number, number]> {
  const pitch = node.depth / node.rows;
  const across = (node.width - node.aisle) / node.columns;
  const half = Math.floor(node.columns / 2);
  const setback = node.style === "classroom" ? pitch * CHAIR_SETBACK : 0;
  const positions: Array<[number, number]> = [];
  for (let row = 0; row < node.rows; row += 1) {
    for (let column = 0; column < node.columns; column += 1) {
      const aisle = column >= half && node.aisle > 0 ? node.aisle : 0;
      positions.push([-node.width / 2 + across * (column + 0.5) + aisle, -node.depth / 2 + pitch * (row + 0.5) + setback]);
    }
  }
  return positions;
}
