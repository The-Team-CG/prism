import type { PrismZoneNode } from "@prism/types";
import { box, designOf, param, part, type EventDesign } from "./kit";

/** A supplier zone: a very thin translucent tint on the floor, with no furniture. */
export function zoneDesign(node: PrismZoneNode): EventDesign {
  const recipe = designOf({
    name: "Supplier zone",
    description: "A translucent floor tint.",
    parameters: [param("width", "Width", 4, 0.5, 30, "m"), param("depth", "Depth", 3, 0.5, 30, "m")],
    parts: [part("tint", "Tint", 1, [box("tint", "zone", ["width", 0.02, "depth"], [0, 0.01, 0])])],
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
