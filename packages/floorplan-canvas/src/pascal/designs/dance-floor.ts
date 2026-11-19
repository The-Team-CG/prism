import type { PrismDanceFloorNode } from "@prism/types";
import { add, box, designOf, div, floor, INDEX, mod, mul, param, part, sub, type EventDesign, type Vec3 } from "./kit";

const DECK_M = 0.03;
const MAX_TILES = 8;

type SolidFinish = "parquet" | "white" | "led";
const SOLID_SLOTS = { parquet: "parquet", white: "dance_white", led: "led_floor" } as const;

/**
 * A thin deck over the floor in its finish: parquet, gloss white, an LED floor, or black and white checks of tiles about
 * a metre square (at most eight a side, so a large floor has larger tiles).
 */
export function danceFloorDesign(node: PrismDanceFloorNode): EventDesign {
  const columns = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.width)));
  const rows = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.depth)));
  const [tileW, tileD] = [div("width", columns), div("depth", rows)];
  const [column, row] = [mod(INDEX, columns), floor(div(INDEX, columns))];
  const tileAt: Vec3 = [add(mul(-0.5, "width"), mul(tileW, add(column, 0.5))), DECK_M / 2, add(mul(-0.5, "depth"), mul(tileD, add(row, 0.5)))];
  const dark = mod(add(column, row), 2);
  const deck =
    node.finish === "checker"
      ? part("checks", "Checks", columns * rows, [
          box("light", "dance_light", [tileW, DECK_M, tileD], tileAt, { when: sub(1, dark) }),
          box("dark", "dance_dark", [tileW, DECK_M, tileD], tileAt, { when: dark }),
        ])
      : part("deck", "Deck", 1, [box("deck", SOLID_SLOTS[node.finish as SolidFinish], ["width", DECK_M, "depth"], [0, DECK_M / 2, 0])]);
  const recipe = designOf({
    name: "Dance floor",
    description: `A thin ${node.finish} deck.`,
    parameters: [param("width", "Width", 6, 1, 30, "m"), param("depth", "Depth", 6, 1, 30, "m")],
    parts: [deck],
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
