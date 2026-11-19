import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismPieceNode } from "@prism/types";
import { INK, centredRect, label, placed } from "./symbol-kit";

const STEP_WIDTH_M = 1.2;
const STEP_TREAD_M = 0.3;
const STEP_COUNT = 3;

/** Front steps in the middle of the stage's front edge (+y), one tread per step. */
function steps(node: PrismPieceNode): FloorplanGeometry[] {
  const front = node.depth / 2;
  return Array.from({ length: STEP_COUNT }, (_, index) => ({
    kind: "group",
    metadata: { part: "step" },
    transform: { translate: [0, front + STEP_TREAD_M * (index + 0.5)] },
    children: [centredRect(STEP_WIDTH_M, STEP_TREAD_M, { fill: INK.tint })],
  }));
}

/** The stage platform, its label, and its steps when it has them. */
export function stageSymbol(node: PrismPieceNode): FloorplanGeometry {
  return placed(node, [centredRect(node.width, node.depth, { fill: INK.tint }), ...(node.steps ? steps(node) : []), label(node.label || "Stage", 0, Math.min(0.7, node.width / 8))]);
}
