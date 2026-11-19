import type { PrismBarNode } from "@prism/types";
import { add, box, designOf, div, flag, min, param, part, sub, type EventDesign } from "./kit";

const COUNTER_M = 0.8;

/** A straight bar, or an L whose arms are the bar's width and depth, each as deep as a counter. Both sit on a metal top. */
export function barDesign(node: PrismBarNode): EventDesign {
  const counter = min(COUNTER_M, min(div("width", 2), div("depth", 2)));
  const recipe = designOf({
    name: "Bar",
    description: "A counter with a metal top, straight or L-shaped.",
    parameters: [param("width", "Width", 3, 1, 12, "m"), param("depth", "Depth", 0.8, 0.5, 12, "m"), flag("l_shape", "L shape")],
    parts: [
      part("straight", "Straight counter", 1, [
        box("body", "bar_wood", ["width", 1, "depth"], [0, 0.5, 0]),
        box("top", "bar_top", [add("width", 0.04), 0.05, add("depth", 0.04)], [0, 1.075, 0]),
      ], { when: sub(1, "l_shape") }),
      part("l", "L counter", 1, [
        box("arm_back", "bar_wood", ["width", 1, counter], [0, 0.5, sub(div(counter, 2), div("depth", 2))]),
        box("arm_side", "bar_wood", [counter, 1, sub("depth", counter)], [sub(div(counter, 2), div("width", 2)), 0.5, div(counter, 2)]),
        box("top_back", "bar_top", ["width", 0.05, counter], [0, 1.075, sub(div(counter, 2), div("depth", 2))]),
        box("top_side", "bar_top", [counter, 0.05, sub("depth", counter)], [sub(div(counter, 2), div("width", 2)), 1.075, div(counter, 2)]),
      ], { when: "l_shape" }),
    ],
  });
  return { recipe, values: { width: node.width, depth: node.depth, l_shape: node.shape === "l" ? 1 : 0 } };
}
