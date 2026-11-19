import type { PrismPieceNode } from "@prism/types";
import { HALF_PI, add, box, cylinder, designOf, div, ellipsoid, INDEX, mul, param, part, sub, type EventDesign, type Part } from "./kit";
import { isKey } from "./lookup";

const WIDTH = "width";
const DEPTH = "depth";
const TWO_SIDES = 2;
const THREE = 3;
const FIVE = 5;

/** Spreads `repeats` items evenly across the piece's width, from the left edge. */
const spreadAcross = (repeats: number) => add(mul(-0.5, WIDTH), div(mul(WIDTH, add(INDEX, 0.5)), repeats));

/** The two ends of the width: −1 for the first repeat, +1 for the second, inset by `inset`. */
const sideOf = (inset: number) => mul(sub(mul(2, INDEX), 1), sub(div(WIDTH, 2), inset));

function desk(): Part[] {
  return [
    part("body", "Body", 1, [box("body", "desk_body", [WIDTH, 0.86, sub(DEPTH, 0.04)], [0, 0.43, 0])]),
    part("top", "Top", 1, [box("top", "desk_top", [add(WIDTH, 0.04), 0.04, DEPTH], [0, 0.88, 0])]),
  ];
}

function booth(): Part[] {
  return [
    part("walls", "Walls", 1, [
      box("back", "booth_wall", [WIDTH, 2.4, 0.06], [0, 1.2, sub(0.03, div(DEPTH, 2))]),
      box("fascia", "booth_fascia", [WIDTH, 0.3, 0.06], [0, 2.25, sub(div(DEPTH, 2), 0.03)]),
    ]),
    part("sides", "Side walls", TWO_SIDES, [box("side", "booth_wall", [0.06, 2.4, DEPTH], [sideOf(0.03), 1.2, 0])]),
    part("counter", "Counter", 1, [box("counter", "desk_body", [mul(WIDTH, 0.6), 1, 0.5], [0, 0.5, sub(div(DEPTH, 2), 0.35)])]),
  ];
}

function buffet(): Part[] {
  return [
    part("body", "Body", 1, [box("body", "catering_body", [WIDTH, 0.9, DEPTH], [0, 0.45, 0])]),
    part("top", "Top", 1, [box("top", "catering_top", [add(WIDTH, 0.04), 0.04, add(DEPTH, 0.04)], [0, 0.92, 0])]),
    part("dishes", "Chafing dishes", THREE, [cylinder("dish", "catering_top", [0.3, 0.14, 0.3], [spreadAcross(THREE), 0.99, 0])]),
  ];
}

function dessert(): Part[] {
  return [
    part("base", "Base", 1, [box("base", "catering_body", [WIDTH, 0.8, DEPTH], [0, 0.4, 0])]),
    part("cakes", "Cake stands", THREE, [cylinder("cake", "cake", [0.22, 0.22, 0.22], [mul(sub(INDEX, 1), div(WIDTH, THREE)), 0.91, 0])]),
  ];
}

function fohDesk(): Part[] {
  return [
    part("console", "Console", 1, [
      box("body", "av_body", [WIDTH, 0.78, DEPTH], [0, 0.39, 0]),
      box("slope", "av_body", [WIDTH, 0.05, mul(DEPTH, 0.6)], [0, 0.82, sub(0, mul(DEPTH, 0.2))], { rotation: [-0.25, 0, 0] }),
    ]),
    part("screen", "Screen", 1, [box("screen", "led_panel", [mul(WIDTH, 0.5), 0.3, 0.03], [0, 1.0, sub(0, mul(DEPTH, 0.45))])]),
  ];
}

function ledWall(): Part[] {
  return [
    part("panel", "Panel", 1, [box("panel", "led_panel", [WIDTH, 2.8, 0.08], [0, 1.6, 0])]),
    part("feet", "Feet", TWO_SIDES, [box("foot", "av_body", [0.12, 0.2, DEPTH], [sideOf(0.3), 0.1, 0])]),
  ];
}

function speaker(): Part[] {
  const front = add(div(DEPTH, 2), 0.02);
  return [
    part("cabinet", "Cabinet", 1, [box("cabinet", "av_body", [WIDTH, 1.6, DEPTH], [0, 0.8, 0])]),
    part("drivers", "Drivers", 1, [
      cylinder("woofer", "av_driver", [0.44, 0.04, 0.44], [0, 1.0, front], { rotation: [HALF_PI, 0, 0] }),
      cylinder("tweeter", "av_driver", [0.14, 0.03, 0.14], [0, 1.4, front], { rotation: [HALF_PI, 0, 0] }),
    ]),
  ];
}

function arch(): Part[] {
  return [
    part("posts", "Posts", TWO_SIDES, [cylinder("post", "decor_frame", [0.08, 2.4, 0.08], [sideOf(0.04), 1.2, 0])]),
    part("beam", "Beam", 1, [box("beam", "decor_frame", [WIDTH, 0.1, 0.1], [0, 2.4, 0])]),
    part("florals", "Florals", FIVE, [ellipsoid("bloom", "greenery", [0.5, 0.35, 0.4], [spreadAcross(FIVE), 2.5, 0])]),
  ];
}

function backdrop(): Part[] {
  return [
    part("panel", "Panel", 1, [box("panel", "decor_fabric", [WIDTH, 2.4, 0.05], [0, 1.2, 0])]),
    part("base", "Base", 1, [box("base", "decor_frame", [WIDTH, 0.05, DEPTH], [0, 0.025, 0])]),
  ];
}

function extinguisher(): Part[] {
  return [
    part("base", "Base", 1, [box("base", "decor_frame", [WIDTH, 0.02, DEPTH], [0, 0.01, 0])]),
    part("body", "Body", 1, [cylinder("body", "safety_red", [0.24, 0.6, 0.24], [0, 0.3, 0])]),
    part("head", "Head", 1, [cylinder("head", "decor_frame", [0.08, 0.1, 0.08], [0, 0.65, 0])]),
  ];
}

function firstAid(): Part[] {
  const sign = 1.45;
  return [
    part("post", "Post", 1, [box("post", "decor_frame", [0.06, 0.35, 0.06], [0, 1.075, 0])]),
    part("base", "Base", 1, [box("base", "safety_body", [WIDTH, 0.9, DEPTH], [0, 0.45, 0])]),
    part("sign", "Sign", 1, [
      box("plate", "safety_red", [0.5, 0.5, 0.03], [0, sign, 0]),
      box("cross_h", "safety_body", [0.36, 0.1, 0.04], [0, sign, 0.03]),
      box("cross_v", "safety_body", [0.1, 0.36, 0.04], [0, sign, 0.03]),
    ]),
  ];
}

function generic(): Part[] {
  return [part("body", "Body", 1, [box("body", "piece_body", [WIDTH, 0.9, DEPTH], [0, 0.45, 0])])];
}

/** The designs by variant. A variant with no drawing of its own is a plain block of its footprint. */
const VARIANTS: Record<string, () => Part[]> = {
  desk,
  booth,
  buffet,
  dessert,
  "foh-desk": fohDesk,
  "led-wall": ledWall,
  speaker,
  arch,
  backdrop,
  extinguisher,
  "first-aid": firstAid,
};

/** A piece of the small kinds: its variant's drawing, sized by its footprint. */
export function smallPieceDesign(node: PrismPieceNode): EventDesign {
  const parts = isKey(VARIANTS, node.variant) ? VARIANTS[node.variant]!() : generic();
  const recipe = designOf({
    name: node.variant,
    description: `Event piece: ${node.variant}.`,
    parameters: [param("width", "Width", 1, 0.2, 10, "m"), param("depth", "Depth", 1, 0.2, 10, "m")],
    parts,
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
