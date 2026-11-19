import type { PrismDanceFloorNode } from "@prism/types";
import { box, designOf, param, part, type EventDesign } from "./kit";

/** A thin parquet deck over the floor. */
export function danceFloorDesign(node: PrismDanceFloorNode): EventDesign {
  const recipe = designOf({
    name: "Dance floor",
    description: "A thin parquet deck.",
    parameters: [param("width", "Width", 6, 1, 30, "m"), param("depth", "Depth", 6, 1, 30, "m")],
    parts: [part("deck", "Deck", 1, [box("deck", "parquet", ["width", 0.03, "depth"], [0, 0.015, 0])])],
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
