import type { PrismBarNode } from "@prism/types";
import { add, box, count, cylinder, designOf, div, flag, INDEX, mul, param, part, sub, type EventDesign } from "./kit";

const COUNTER_M = 0.8;
const SERVICE_GAP_M = 0.9;
const STOOL_OUTSET_M = 0.4;

/**
 * A straight bar, or an L whose arms are the bar's width and depth, each as deep as a counter, under a metal top over a
 * kick plate. Stools stand along the guest side (+z, in front of the back arm of an L); a back bar of shelves stands
 * behind the bartenders when asked for.
 */
export function barDesign(node: PrismBarNode): EventDesign {
  const lShape = node.shape === "l";
  const counter = Math.min(COUNTER_M, node.width / 2, node.depth / 2);
  const armZ = counter / 2 - node.depth / 2;
  const [stoolStart, stoolSpan] = lShape ? [-node.width / 2 + counter, node.width - counter] : [-node.width / 2, node.width];
  const stoolZ = (lShape ? -node.depth / 2 + counter : node.depth / 2) + STOOL_OUTSET_M;
  const stoolX = add(stoolStart, div(mul(stoolSpan, add(INDEX, 0.5)), "stools"));
  const backZ = -node.depth / 2 - SERVICE_GAP_M - 0.25;
  const recipe = designOf({
    name: "Bar",
    description: "A counter with a metal top, straight or L-shaped, with stools and a back bar.",
    parameters: [
      param("width", "Width", 3, 1, 12, "m"),
      param("depth", "Depth", 0.8, 0.5, 12, "m"),
      flag("l_shape", "L shape"),
      count("stools", "Stools", 0, 0, 24),
      flag("back_bar", "Back bar"),
    ],
    parts: [
      part(
        "straight",
        "Straight counter",
        1,
        [
          box("body", "bar_wood", ["width", 1, "depth"], [0, 0.5, 0]),
          box("kick", "bar_top", [add("width", 0.01), 0.1, add("depth", 0.01)], [0, 0.05, 0]),
          box("top", "bar_top", [add("width", 0.06), 0.05, add("depth", 0.06)], [0, 1.075, 0]),
        ],
        { when: sub(1, "l_shape") },
      ),
      part(
        "l",
        "L counter",
        1,
        [
          box("arm_back", "bar_wood", ["width", 1, counter], [0, 0.5, armZ]),
          box("arm_side", "bar_wood", [counter, 1, node.depth - counter], [counter / 2 - node.width / 2, 0.5, counter / 2]),
          box("top_back", "bar_top", [add("width", 0.06), 0.05, counter + 0.06], [0, 1.075, armZ]),
          box("top_side", "bar_top", [counter + 0.06, 0.05, node.depth - counter], [counter / 2 - node.width / 2, 1.075, counter / 2]),
        ],
        { when: "l_shape" },
      ),
      part("stools", "Stools", "stools", [
        cylinder("stool_base", "bar_top", [0.4, 0.02, 0.4], [stoolX, 0.01, stoolZ], { segments: 20 }),
        cylinder("stool_pole", "bar_top", [0.05, 0.72, 0.05], [stoolX, 0.38, stoolZ], { segments: 8 }),
        cylinder("stool_seat", "stool_seat", [0.38, 0.07, 0.38], [stoolX, 0.77, stoolZ], { segments: 20 }),
      ]),
      part("back_bar", "Back bar", "back_bar", [
        box("cabinet", "bar_wood", ["width", 0.9, 0.5], [0, 0.45, backZ]),
        box("upright", "bar_wood", ["width", 1.3, 0.04], [0, 1.55, backZ - 0.23]),
        box("shelf_low", "bar_top", ["width", 0.03, 0.3], [0, 1.3, backZ - 0.08]),
        box("shelf_high", "bar_top", ["width", 0.03, 0.3], [0, 1.75, backZ - 0.08]),
      ]),
    ],
  });
  return { recipe, values: { width: node.width, depth: node.depth, l_shape: lShape ? 1 : 0, stools: node.stools, back_bar: node.backBar ? 1 : 0 } };
}
