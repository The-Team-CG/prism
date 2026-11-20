import type { PrismSeatingBlockNode } from "@prism/types";
import type { ChairStyle } from "../dressing";
import { CHAIR_PARAMETERS, chairShapes } from "./chairs";
import { box, count, designOf, div, INDEX, mul, param, part, sub, add, type EventDesign } from "./kit";

/** A classroom desk sits in front of its row of chairs, a fraction of a row's pitch away. */
const DESK_SETBACK = 0.28;

/**
 * One chair on its own, in a style, with or without a sash. Tables and blocks repeat it with instancing: Pascal's designs
 * build at most 512 shapes and 8 materials, which a 300-seat block or a dressed table would pass, and one shared chair
 * draws all of a piece's chairs in a single call per material.
 */
export function chairDesign(style: ChairStyle, sashed: boolean): EventDesign {
  const recipe = designOf({
    name: "Chair",
    description: `One ${style} chair.`,
    parameters: [...CHAIR_PARAMETERS],
    parts: [part("chair", "Chair", 1, chairShapes(style))],
  });
  return { recipe, values: { sash: sashed ? 1 : 0 } };
}

/** A ceremony block's aisle runner, from the front row to the back; other blocks and a block with no aisle have none. */
export function runnerDesign(node: PrismSeatingBlockNode): EventDesign | null {
  if (node.style !== "ceremony" || node.aisle <= 0) return null;
  const across = (node.width - node.aisle) / node.columns;
  const centre = across * (Math.floor(node.columns / 2) - node.columns / 2);
  const recipe = designOf({
    name: "Aisle runner",
    description: "A cloth runner down a ceremony block's aisle.",
    parameters: [param("width", "Width", 1.2, 0.2, 3, "m"), param("depth", "Depth", 6, 0.5, 29, "m")],
    parts: [part("runner", "Runner", 1, [box("runner", "aisle_runner", [mul("width", 0.8), 0.006, add("depth", 1)], [centre, 0.003, 0])])],
  });
  return { recipe, values: { width: node.aisle, depth: node.depth } };
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
