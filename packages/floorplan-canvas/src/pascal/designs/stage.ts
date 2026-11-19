import type { PrismPieceNode } from "@prism/types";
import { add, box, cylinder, designOf, div, flag, floor, INDEX, min, mul, param, part, sub, type EventDesign } from "./kit";

const STEP_COUNT = 3;
const STEP_WIDTH_M = 1.2;
const STEP_DEPTH_M = 0.3;
const RAIL_HEIGHT_M = 0.9;
const PLEAT_PITCH_M = 0.15;
const TRUSS_M = 0.3;
const TRUSS_HEIGHT_M = 4;

/** −1 for the first of a pair of repeats, +1 for the second. */
const pairSide = sub(mul(2, "index"), 1);

/**
 * A platform at its height over a pleated skirt; front steps with a handrail each side when asked for, and a truss
 * backdrop along its back edge: two towers, a header beam and a fabric drop between them.
 */
function stageRecipe(rise: number) {
  const [width, depth, height] = ["width", "depth", "height"];
  const stepHeight = mul(height, div(sub(STEP_COUNT, INDEX), STEP_COUNT));
  const front = div(depth, 2);
  const pleats = min(64, floor(div(width, PLEAT_PITCH_M)));
  const back = add(mul(-0.5, depth), TRUSS_M / 2);
  const run = STEP_COUNT * STEP_DEPTH_M;
  const railX = mul(pairSide, STEP_WIDTH_M / 2 + 0.03);
  return designOf({
    name: "Stage",
    description: "A raised stage on a pleated skirt, with optional front steps and a truss backdrop.",
    parameters: [
      param("width", "Width", 6, 2, 20, "m"),
      param("depth", "Depth", 4, 2, 15, "m"),
      param("height", "Height", 0.6, 0.1, 1.5, "m"),
      flag("steps", "Steps"),
      flag("backdrop", "Backdrop"),
    ],
    parts: [
      part("deck", "Deck", 1, [
        box("deck", "stage_deck", [width, 0.05, depth], [0, sub(height, 0.025), 0]),
        box("skirt", "stage_skirt", [sub(width, 0.04), sub(height, 0.05), sub(depth, 0.04)], [0, div(sub(height, 0.05), 2), 0]),
      ]),
      part("pleats", "Skirt pleats", pleats, [
        cylinder(
          "pleat",
          "stage_skirt",
          [0.09, sub(height, 0.06), 0.05],
          [add(mul(-0.5, width), mul(div(width, pleats), add(INDEX, 0.5))), div(sub(height, 0.05), 2), sub(front, 0.015)],
          { segments: 8 },
        ),
      ]),
      part("steps", "Steps", mul("steps", STEP_COUNT), [
        box("step", "stage_deck", [STEP_WIDTH_M, stepHeight, STEP_DEPTH_M], [0, div(stepHeight, 2), add(front, 0.15, mul(STEP_DEPTH_M, INDEX))]),
      ]),
      part("rails", "Handrails", mul("steps", 2), [
        box("rail", "rail", [0.04, 0.04, Math.hypot(run, rise)], [railX, add(div(height, 2), RAIL_HEIGHT_M), add(front, run / 2)], {
          rotation: [Math.atan2(rise, run), 0, 0],
        }),
        cylinder("rail_post", "rail", [0.035, RAIL_HEIGHT_M, 0.035], [railX, RAIL_HEIGHT_M / 2, add(front, run - 0.05)], { segments: 8 }),
      ]),
      part("towers", "Truss towers", mul("backdrop", 2), [
        box("tower", "truss", [TRUSS_M, TRUSS_HEIGHT_M, TRUSS_M], [mul(pairSide, sub(div(width, 2), TRUSS_M / 2)), add(height, TRUSS_HEIGHT_M / 2), back]),
      ]),
      part("header", "Truss header and drop", "backdrop", [
        box("header", "truss", [width, TRUSS_M, TRUSS_M], [0, add(height, TRUSS_HEIGHT_M - TRUSS_M / 2), back]),
        box("drop", "backdrop_fabric", [sub(width, 2 * TRUSS_M), TRUSS_HEIGHT_M - TRUSS_M, 0.04], [0, add(height, (TRUSS_HEIGHT_M - TRUSS_M) / 2), back]),
      ]),
    ],
  });
}

export function stageDesign(node: PrismPieceNode): EventDesign {
  const height = node.heightM ?? 0.6;
  return {
    recipe: stageRecipe(height),
    values: { width: node.width, depth: node.depth, height, steps: node.steps ? 1 : 0, backdrop: node.backdrop ? 1 : 0 },
  };
}
