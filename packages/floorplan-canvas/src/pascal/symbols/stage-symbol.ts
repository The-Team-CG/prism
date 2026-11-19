import type { FloorplanGeometry } from "@pascal-app/core";
import type { PrismPieceNode } from "@prism/types";
import { LOOK, centredRect, label, placed, shadowOf } from "./symbol-kit";

const STEP_WIDTH_M = 1.2;
const STEP_TREAD_M = 0.3;
const STEP_COUNT = 3;
const TRUSS_M = 0.3;

/** Front steps in the middle of the stage's front edge (+y), one tread per step. */
function steps(node: PrismPieceNode): FloorplanGeometry[] {
  const front = node.depth / 2;
  return Array.from({ length: STEP_COUNT }, (_, index) => ({
    kind: "group",
    metadata: { part: "step" },
    transform: { translate: [0, front + STEP_TREAD_M * (index + 0.5)] },
    children: [centredRect(STEP_WIDTH_M, STEP_TREAD_M, { fill: LOOK.stageStep })],
  }));
}

/** The truss backdrop along the back edge (−y). */
const backdrop = (node: PrismPieceNode): FloorplanGeometry => ({
  kind: "group",
  metadata: { part: "backdrop" },
  transform: { translate: [0, -node.depth / 2 + TRUSS_M / 2] },
  children: [centredRect(node.width, TRUSS_M, { fill: LOOK.stageDrop })],
});

/** The stage platform in its dark deck over a soft shadow, its label in white, its steps and its backdrop when it has them. */
export function stageSymbol(node: PrismPieceNode): FloorplanGeometry {
  const deck = centredRect(node.width, node.depth, { fill: LOOK.stage });
  return placed(node, [
    shadowOf(deck),
    ...(node.steps ? steps(node) : []),
    deck,
    ...(node.backdrop ? [backdrop(node)] : []),
    label(node.label || "Stage", 0, Math.min(0.7, node.width / 8), { fill: LOOK.onDark, weight: 600 }),
  ]);
}
