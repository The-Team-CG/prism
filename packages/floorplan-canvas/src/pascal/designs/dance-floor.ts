import type { PrismDanceFloorNode } from "@prism/types";
import type { Expr } from "@pascal-app/core/procedural-items";
import { add, box, designOf, div, floor, INDEX, mod, mul, param, part, sub, type EventDesign, type Part, type Vec3 } from "./kit";

const DECK_M = 0.03;
const MAX_TILES = 8;
/** An LED floor's lit panels sit in a dark frame, with this much frame showing between them and this thin above it. */
const LED_GAP_M = 0.04;
const LED_LIFT_M = 0.004;

type SolidFinish = "parquet" | "white";
const SOLID_SLOTS = { parquet: "parquet", white: "dance_white" } as const;

type Tiles = { count: number; width: Expr; depth: Expr; at: Vec3; dark: Expr };

/** The deck's parts: checks alternate light and dark tiles, an LED floor sets a lit panel in each tile, others are one board. */
function deckOf(finish: PrismDanceFloorNode["finish"], tile: Tiles): Part[] {
  if (finish === "checker")
    return [
      part("checks", "Checks", tile.count, [
        box("light", "dance_light", [tile.width, DECK_M, tile.depth], tile.at, { when: sub(1, tile.dark) }),
        box("dark", "dance_dark", [tile.width, DECK_M, tile.depth], tile.at, { when: tile.dark }),
      ]),
    ];
  if (finish === "led")
    return [
      part("frame", "Frame", 1, [box("frame", "dance_dark", ["width", DECK_M, "depth"], [0, DECK_M / 2, 0])]),
      part("panels", "Lit panels", tile.count, [
        box("panel", "led_floor", [sub(tile.width, LED_GAP_M), LED_LIFT_M, sub(tile.depth, LED_GAP_M)], [tile.at[0], DECK_M + LED_LIFT_M / 2, tile.at[2]]),
      ]),
    ];
  return [part("deck", "Deck", 1, [box("deck", SOLID_SLOTS[finish as SolidFinish], ["width", DECK_M, "depth"], [0, DECK_M / 2, 0])])];
}

/**
 * A thin deck over the floor in its finish: parquet, gloss white, an LED floor of lit panels, or black and white checks,
 * its tiles about a metre square (at most eight a side, so a large floor has larger tiles).
 */
export function danceFloorDesign(node: PrismDanceFloorNode): EventDesign {
  const columns = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.width)));
  const rows = Math.min(MAX_TILES, Math.max(1, Math.ceil(node.depth)));
  const [tileW, tileD] = [div("width", columns), div("depth", rows)];
  const [column, row] = [mod(INDEX, columns), floor(div(INDEX, columns))];
  const tileAt: Vec3 = [add(mul(-0.5, "width"), mul(tileW, add(column, 0.5))), DECK_M / 2, add(mul(-0.5, "depth"), mul(tileD, add(row, 0.5)))];
  const tile = { count: columns * rows, width: tileW, depth: tileD, at: tileAt, dark: mod(add(column, row), 2) };
  const recipe = designOf({
    name: "Dance floor",
    description: `A thin ${node.finish} deck.`,
    parameters: [param("width", "Width", 6, 1, 30, "m"), param("depth", "Depth", 6, 1, 30, "m")],
    parts: deckOf(node.finish, tile),
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
