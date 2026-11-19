import type { PrismPieceNode } from "@prism/types";
import { add, box, designOf, div, flag, INDEX, mul, param, part, sub, type EventDesign } from "./kit";

const STEP_COUNT = 3;
const STEP_WIDTH_M = 1.2;
const STEP_DEPTH_M = 0.3;

/** A platform at its height with a dark skirt under it, and three front steps that step down from the deck when asked for. */
function stageRecipe() {
  const width = "width";
  const depth = "depth";
  const height = "height";
  const stepHeight = mul(height, div(sub(STEP_COUNT, INDEX), STEP_COUNT));
  return designOf({
    name: "Stage",
    description: "A raised stage on a skirt, with optional front steps.",
    parameters: [
      param("width", "Width", 6, 2, 20, "m"),
      param("depth", "Depth", 4, 2, 15, "m"),
      param("height", "Height", 0.6, 0.1, 1.5, "m"),
      flag("steps", "Steps"),
    ],
    parts: [
      part("deck", "Deck", 1, [
        box("deck", "stage_deck", [width, 0.05, depth], [0, sub(height, 0.025), 0]),
        box("skirt", "stage_skirt", [sub(width, 0.1), sub(height, 0.05), sub(depth, 0.1)], [0, div(sub(height, 0.05), 2), 0]),
      ]),
      part("steps", "Steps", mul("steps", STEP_COUNT), [
        box("step", "stage_deck", [STEP_WIDTH_M, stepHeight, STEP_DEPTH_M], [0, div(stepHeight, 2), add(div(depth, 2), 0.15, mul(STEP_DEPTH_M, INDEX))]),
      ]),
    ],
  });
}

export function stageDesign(node: PrismPieceNode): EventDesign {
  return {
    recipe: stageRecipe(),
    values: { width: node.width, depth: node.depth, height: node.heightM ?? 0.6, steps: node.steps ? 1 : 0 },
  };
}
