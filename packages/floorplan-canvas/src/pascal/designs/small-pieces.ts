import type { PrismPieceNode } from "@prism/types";
import { HALF_PI, add, box, cylinder, designOf, div, ellipsoid, floor, INDEX, max, min, mul, param, part, revolve, roundedBox, sub, type EventDesign, type Part, type Profile } from "./kit";
import { isKey } from "./lookup";
import type { Expr } from "@pascal-app/core/procedural-items";

const WIDTH = "width";
const DEPTH = "depth";
const TWO_SIDES = 2;
const THREE = 3;
const ARCH_BLOOMS = 7;

/** Spreads `repeats` items evenly across the piece's width, from the left edge. */
const spreadAcross = (repeats: Expr) => add(mul(-0.5, WIDTH), div(mul(WIDTH, add(INDEX, 0.5)), repeats));

/** The two ends of the width: −1 for the first repeat, +1 for the second, inset by `inset`. */
const sideOf = (inset: number) => mul(sub(mul(2, INDEX), 1), sub(div(WIDTH, 2), inset));
/** The two ends of the depth, the same way. */
const endOf = (inset: number) => mul(sub(mul(2, INDEX), 1), sub(div(DEPTH, 2), inset));
const front = (inset: Expr = 0) => sub(div(DEPTH, 2), inset);
const back = (inset: Expr = 0) => sub(inset, div(DEPTH, 2));
/** How many of something `pitch` apart fit across the width, at least one and at most 64. */
const fitAcross = (pitch: number) => max(1, min(64, floor(div(WIDTH, pitch))));

function desk(): Part[] {
  return [
    part("body", "Body", 1, [box("body", "desk_body", [WIDTH, 0.86, sub(DEPTH, 0.04)], [0, 0.43, 0])]),
    part("top", "Top", 1, [box("top", "desk_top", [add(WIDTH, 0.04), 0.04, DEPTH], [0, 0.88, 0])]),
  ];
}

/** A check counter with pigeonhole shelving behind it, for bags or coats. */
function checkCounter(): Part[] {
  return [
    ...desk(),
    part("shelves", "Shelves", 1, [box("rack", "desk", [WIDTH, 1.8, 0.4], [0, 0.9, back(0.2)])]),
    part("rails", "Rails", THREE, [box("rail", "decor_frame", [WIDTH, 0.03, 0.4], [0, add(0.45, mul(0.5, INDEX)), back(0.2)])]),
  ];
}

function booth(): Part[] {
  return [
    part("walls", "Walls", 1, [
      box("back", "booth_wall", [WIDTH, 2.4, 0.06], [0, 1.2, back(0.03)]),
      box("fascia", "booth_fascia", [WIDTH, 0.3, 0.06], [0, 2.25, front(0.03)]),
    ]),
    part("sides", "Side walls", TWO_SIDES, [box("side", "booth_wall", [0.06, 2.4, DEPTH], [sideOf(0.03), 1.2, 0])]),
    part("counter", "Counter", 1, [box("counter", "desk_body", [mul(WIDTH, 0.6), 1, 0.5], [0, 0.5, front(0.35)])]),
  ];
}

function buffet(): Part[] {
  return [
    part("cloth", "Cloth", 1, [roundedBox("cloth", "linen", [add(WIDTH, 0.04), 0.76, add(DEPTH, 0.04)], [0, 0.38, 0], 0.015)]),
    part("risers", "Risers", 1, [box("riser", "catering_top", [mul(WIDTH, 0.8), 0.12, 0.25], [0, 0.82, back(0.2)])]),
    part("dishes", "Chafing dishes", fitAcross(0.7), [
      box("pan", "catering_top", [0.5, 0.1, 0.32], [spreadAcross(fitAcross(0.7)), 0.81, front(0.3)]),
      ellipsoid("lid", "catering_top", [0.48, 0.12, 0.3], [spreadAcross(fitAcross(0.7)), 0.86, front(0.3)]),
    ]),
  ];
}

function dessert(): Part[] {
  return [
    part("cloth", "Cloth", 1, [roundedBox("cloth", "linen", [add(WIDTH, 0.04), 0.76, add(DEPTH, 0.04)], [0, 0.38, 0], 0.015)]),
    part("stands", "Cake stands", THREE, [
      cylinder("stand", "catering_top", [0.3, 0.02, 0.3], [mul(sub(INDEX, 1), div(WIDTH, THREE)), add(0.86, mul(0.08, INDEX)), 0]),
      cylinder("stem", "catering_top", [0.03, add(0.1, mul(0.08, INDEX)), 0.03], [mul(sub(INDEX, 1), div(WIDTH, THREE)), add(0.81, mul(0.04, INDEX)), 0]),
      cylinder("sweets", "cake", [0.24, 0.1, 0.24], [mul(sub(INDEX, 1), div(WIDTH, THREE)), add(0.92, mul(0.08, INDEX)), 0]),
    ]),
  ];
}

/** A round cake table under its linen with a three-tier cake. */
function cakeTable(): Part[] {
  const radius = div(min(WIDTH, DEPTH), 2);
  return [
    part("cloth", "Cloth", 1, [
      revolve("cloth", "linen", [[0, 0.755], [radius, 0.755], [add(radius, 0.02), 0.73], [add(radius, 0.06), 0.005]], [0, 0, 0], { segments: 40 }),
    ]),
    part("tiers", "Tiers", THREE, [
      cylinder("tier", "cake", [sub(0.4, mul(0.1, INDEX)), 0.16, sub(0.4, mul(0.1, INDEX))], [0, add(0.835, mul(0.16, INDEX)), 0], { segments: 32 }),
    ]),
    part("topper", "Topper", 1, [ellipsoid("topper", "florals", [0.14, 0.1, 0.14], [0, 1.27, 0])]),
  ];
}

/** A long grazing table: boards, bowls and greenery down a linen table. */
function grazing(): Part[] {
  const boards = fitAcross(0.55);
  return [
    part("cloth", "Cloth", 1, [roundedBox("cloth", "linen", [add(WIDTH, 0.04), 0.76, add(DEPTH, 0.04)], [0, 0.38, 0], 0.015)]),
    part("boards", "Boards", boards, [
      box("board", "wood_board", [0.45, 0.025, mul(DEPTH, 0.55)], [spreadAcross(boards), 0.775, 0]),
      ellipsoid("food", "food", [0.32, 0.08, mul(DEPTH, 0.35)], [spreadAcross(boards), 0.81, 0]),
    ]),
    part("greenery", "Greenery", 1, [box("garland", "greenery", [WIDTH, 0.06, 0.12], [0, 0.79, back(0.12)])]),
  ];
}

/** A carving station: a lechon on its tray on a clothed table, with a heat lamp over it. */
function carving(): Part[] {
  return [
    part("cloth", "Cloth", 1, [roundedBox("cloth", "linen", [add(WIDTH, 0.04), 0.76, add(DEPTH, 0.04)], [0, 0.38, 0], 0.015)]),
    part("roast", "Roast", 1, [
      box("tray", "wood_board", [mul(WIDTH, 0.7), 0.04, mul(DEPTH, 0.6)], [0, 0.78, 0]),
      ellipsoid("lechon", "roast", [mul(WIDTH, 0.55), 0.26, mul(DEPTH, 0.35)], [0, 0.9, 0]),
      ellipsoid("garnish", "greenery", [mul(WIDTH, 0.62), 0.05, mul(DEPTH, 0.45)], [0, 0.8, 0]),
    ]),
    part("lamp", "Heat lamp", 1, [
      cylinder("lamp_post", "decor_frame", [0.03, 0.75, 0.03], [0, 1.15, back(0.1)], { segments: 8 }),
      box("lamp_arm", "decor_frame", [0.04, 0.04, mul(DEPTH, 0.45)], [0, 1.52, sub(0, mul(DEPTH, 0.22))]),
      cylinder("lamp_head", "light_body", [0.22, 0.12, 0.22], [0, 1.45, 0], { segments: 16 }),
    ]),
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

/** A projection screen in a black frame on two legs, its bottom edge at head height. */
function projectionScreen(): Part[] {
  const height = mul(WIDTH, 0.5625);
  return [
    part("screen", "Screen", 1, [
      box("frame", "light_body", [add(WIDTH, 0.12), add(height, 0.12), 0.05], [0, add(1.4, div(height, 2)), 0]),
      box("surface", "screen", [WIDTH, height, 0.02], [0, add(1.4, div(height, 2)), 0.03]),
    ]),
    part("legs", "Legs", TWO_SIDES, [
      cylinder("leg", "light_body", [0.04, add(1.4, height), 0.04], [sideOf(-0.04), div(add(1.4, height), 2), 0], { segments: 8 }),
      box("foot", "light_body", [0.06, 0.04, DEPTH], [sideOf(-0.04), 0.02, 0]),
    ]),
  ];
}

function speaker(): Part[] {
  const face = add(div(DEPTH, 2), 0.02);
  return [
    part("cabinet", "Cabinet", 1, [box("cabinet", "av_body", [WIDTH, 1.6, DEPTH], [0, 0.8, 0])]),
    part("drivers", "Drivers", 1, [
      cylinder("woofer", "av_driver", [0.44, 0.04, 0.44], [0, 1.0, face], { rotation: [HALF_PI, 0, 0] }),
      cylinder("tweeter", "av_driver", [0.14, 0.03, 0.14], [0, 1.4, face], { rotation: [HALF_PI, 0, 0] }),
    ]),
  ];
}

/** A floor uplight washing the wall behind it: a can with its lit lens, and its soft beam. */
function uplight(): Part[] {
  return [
    part("can", "Can", 1, [
      cylinder("can", "light_body", [0.2, 0.22, 0.2], [0, 0.15, 0], { segments: 16, rotation: [-0.3, 0, 0] }),
      cylinder("lens", "bulb", [0.17, 0.012, 0.17], [0, 0.262, -0.034], { segments: 16, rotation: [-0.3, 0, 0] }),
    ]),
    part("beam", "Beam", 1, [revolve("beam", "light_beam", [[0.1, 0.2], [0.45, 2.6], [0, 2.6]], [0, 0, 0], { segments: 24, rotation: [-0.3, 0, 0] })]),
  ];
}

/** A lighting truss: two towers and a span with moving heads hung from it. */
function lightingTruss(): Part[] {
  const heads = max(1, min(8, floor(div(WIDTH, 1.5))));
  return [
    part("towers", "Towers", TWO_SIDES, [
      box("tower", "truss", [0.3, 4, 0.3], [sideOf(0.15), 2, 0]),
      box("base", "truss", [0.8, 0.04, 0.8], [sideOf(0.15), 0.02, 0]),
    ]),
    part("span", "Span", 1, [box("span", "truss", [WIDTH, 0.3, 0.3], [0, 4.15, 0])]),
    part("heads", "Moving heads", heads, [
      box("yoke", "light_body", [0.28, 0.16, 0.2], [spreadAcross(heads), 3.92, 0]),
      cylinder("head", "light_body", [0.2, 0.3, 0.2], [spreadAcross(heads), 3.72, 0], { segments: 16 }),
    ]),
  ];
}

/** A lectern: a slanted top on a solid wooden body with a gooseneck microphone. */
function podium(): Part[] {
  return [
    part("body", "Body", 1, [
      box("body", "lectern", [WIDTH, 1.05, DEPTH], [0, 0.525, 0]),
      box("top", "lectern", [add(WIDTH, 0.06), 0.04, add(DEPTH, 0.08)], [0, 1.1, 0], { rotation: [0.2, 0, 0] }),
      box("plinth", "light_body", [add(WIDTH, 0.04), 0.06, add(DEPTH, 0.04)], [0, 0.03, 0]),
    ]),
    part("mic", "Microphone", 1, [cylinder("mic", "light_body", [0.015, 0.35, 0.015], [0.12, 1.3, back(0.08)], { segments: 6, rotation: [0.5, 0, 0] })]),
  ];
}

/** A camera riser: a low platform with a rail round three sides. */
function cameraRiser(): Part[] {
  return [
    part("deck", "Deck", 1, [box("deck", "stage_deck", [WIDTH, 0.4, DEPTH], [0, 0.2, 0])]),
    part("rail", "Rail", 1, [box("rail_back", "rail", [WIDTH, 0.04, 0.04], [0, 1.4, back(0.02)])]),
    part("rails", "Side rails", TWO_SIDES, [
      box("rail_side", "rail", [0.04, 0.04, DEPTH], [sideOf(0.02), 1.4, 0]),
      cylinder("post", "rail", [0.035, 1, 0.035], [sideOf(0.02), 0.9, back(0.02)], { segments: 8 }),
    ]),
  ];
}

function arch(): Part[] {
  return [
    part("posts", "Posts", TWO_SIDES, [cylinder("post", "decor_frame", [0.08, 2.4, 0.08], [sideOf(0.04), 1.2, 0])]),
    part("beam", "Beam", 1, [box("beam", "decor_frame", [WIDTH, 0.1, 0.1], [0, 2.4, 0])]),
    part("florals", "Florals", ARCH_BLOOMS, [ellipsoid("bloom", "florals", [0.42, 0.32, 0.36], [spreadAcross(ARCH_BLOOMS), 2.5, 0])]),
    part("leaves", "Leaves", ARCH_BLOOMS, [ellipsoid("leaf", "greenery", [0.36, 0.22, 0.42], [spreadAcross(ARCH_BLOOMS), 2.4, 0.06])]),
    part("greens", "Greenery", TWO_SIDES, [ellipsoid("cascade", "greenery", [0.3, 1.2, 0.3], [sideOf(0.04), 1.8, 0])]),
    part("corner_blooms", "Corner blooms", TWO_SIDES, [ellipsoid("corner", "florals", [0.36, 0.5, 0.34], [sideOf(0.1), 2.15, 0.04])]),
  ];
}

function backdrop(): Part[] {
  return [
    part("panel", "Panel", 1, [box("panel", "decor_fabric", [WIDTH, 2.4, 0.05], [0, 1.2, 0])]),
    part("base", "Base", 1, [box("base", "decor_frame", [WIDTH, 0.05, DEPTH], [0, 0.025, 0])]),
  ];
}

/** A photo booth: a backdrop wall, a ring light on its stand and a props table. */
function photoBooth(): Part[] {
  return [
    part("wall", "Backdrop", 1, [
      box("wall", "decor_fabric", [WIDTH, 2.4, 0.06], [0, 1.2, back(0.03)]),
      ellipsoid("florals", "florals", [mul(WIDTH, 0.5), 0.3, 0.3], [0, 2.4, back(0.1)]),
    ]),
    part("ring", "Ring light", 1, [
      cylinder("stand", "light_body", [0.03, 1.5, 0.03], [0, 0.75, front(0.2)], { segments: 8 }),
      cylinder("ring", "ring_light", [0.5, 0.04, 0.5], [0, 1.6, front(0.2)], { rotation: [HALF_PI, 0, 0], segments: 32, inner: 0.72 }),
    ]),
    part("props", "Props table", 1, [box("props", "lectern", [0.6, 0.8, 0.4], [sub(div(WIDTH, 2), 0.4), 0.4, front(0.4)])]),
  ];
}

/** A lounge set on a rug: a sofa along the back, two armchairs facing each other and a coffee table between them. */
function lounge(): Part[] {
  const sofaWidth = max(0.8, min(2.2, sub(WIDTH, 1.6)));
  return [
    part("rug", "Rug", 1, [box("rug", "rug", [WIDTH, 0.01, DEPTH], [0, 0.005, 0])]),
    part("sofa", "Sofa", 1, [
      roundedBox("sofa_base", "sofa", [sofaWidth, 0.42, 0.85], [0, 0.21, back(0.45)], 0.05),
      roundedBox("sofa_back", "sofa", [sofaWidth, 0.42, 0.2], [0, 0.6, back(0.12)], 0.06),
      roundedBox("sofa_arm_l", "sofa", [0.18, 0.58, 0.85], [sub(0, div(sofaWidth, 2)), 0.29, back(0.45)], 0.05),
      roundedBox("sofa_arm_r", "sofa", [0.18, 0.58, 0.85], [div(sofaWidth, 2), 0.29, back(0.45)], 0.05),
    ]),
    part("armchairs", "Armchairs", TWO_SIDES, [
      roundedBox("chair_base", "sofa", [0.8, 0.42, 0.8], [sideOf(0.45), 0.21, front(0.75)], 0.05),
      roundedBox("chair_back", "sofa", [0.2, 0.45, 0.8], [sideOf(0.12), 0.6, front(0.75)], 0.06),
    ]),
    part("table", "Coffee table", 1, [roundedBox("coffee", "wood_board", [0.9, 0.4, 0.55], [0, 0.2, front(0.75)], 0.03)]),
  ];
}

/** A potted plant's leaves as overlapping clumps, given as [dx, lift, dz, size] against the plant's spread. */
const LEAF_CLUSTER: Array<[number, number, number, number]> = [
  [0, 1.25, 0, 0.55],
  [0.22, 1.05, 0.05, 0.5],
  [-0.2, 1.08, 0.08, 0.48],
  [0.04, 1.0, -0.22, 0.5],
  [-0.06, 0.92, 0.22, 0.45],
  [0.18, 1.32, -0.12, 0.4],
  [-0.16, 1.3, -0.08, 0.42],
];
const PLANT_SPREAD = min(WIDTH, 0.9);

function plant(): Part[] {
  return [
    part("pot", "Pot", 1, [revolve("pot", "plant_pot", [[0, 0], [0.16, 0], [0.2, 0.45], [0, 0.45]], [0, 0, 0], { segments: 24 })]),
    part("foliage", "Foliage", 1, [
      cylinder("trunk", "wood_board", [0.04, 0.5, 0.04], [0, 0.65, 0], { segments: 8 }),
      ...LEAF_CLUSTER.map(([dx, lift, dz, size], index) =>
        ellipsoid(`leaves_${index}`, "greenery", [mul(PLANT_SPREAD, size), mul(PLANT_SPREAD, size * 0.75), mul(PLANT_SPREAD, size)], [mul(PLANT_SPREAD, dx), lift, mul(PLANT_SPREAD, dz)]),
      ),
    ]),
  ];
}

/** A market umbrella over its base. */
function umbrella(): Part[] {
  const radius = div(min(WIDTH, DEPTH), 2);
  return [
    part("pole", "Pole", 1, [
      cylinder("pole", "decor_frame", [0.04, 2.4, 0.04], [0, 1.2, 0], { segments: 8 }),
      cylinder("base", "light_body", [0.5, 0.06, 0.5], [0, 0.03, 0], { segments: 20 }),
    ]),
    part("canopy", "Canopy", 1, [revolve("canopy", "canopy", [[0, 2.65], [radius, 2.2], [0, 2.2]], [0, 0, 0], { segments: 8 })]),
  ];
}

const STRANDS = 6;
/** A festoon globe hanging from its strand, turned from this profile; a few sides keep a hundred of them light to draw. */
const FESTOON_GLOBE: Profile = [[0, 0], [0.026, 0.012], [0.036, 0.042], [0.03, 0.07], [0.012, 0.09], [0, 0.095]];

/** Festoon string lights: strands across the area at 3 m, each a line of bulbs, on posts at both ends. */
function stringLights(): Part[] {
  const strands = max(1, min(STRANDS, floor(div(DEPTH, 3))));
  const bulbs = max(2, min(16, floor(div(WIDTH, 0.6))));
  const strandZ = add(mul(-0.5, DEPTH), mul(div(DEPTH, strands), add(INDEX, 0.5)));
  return [
    part("posts", "Posts", TWO_SIDES, [cylinder("post", "decor_frame", [0.06, 3.2, 0.06], [sideOf(0.03), 1.6, 0], { segments: 8 })]),
    part("strands", "Strands", strands, [box("wire", "light_body", [WIDTH, 0.01, 0.01], [0, 3.1, strandZ])]),
    ...Array.from({ length: STRANDS }, (_, strand) =>
      part(`bulbs_${strand}`, `Bulbs ${strand + 1}`, bulbs, [
        revolve("bulb", "bulb", FESTOON_GLOBE, [spreadAcross(bulbs), 2.995, add(mul(-0.5, DEPTH), mul(div(DEPTH, strands), strand + 0.5))], { segments: 10 }),
      ], { when: max(0, sub(strands, strand)) }),
    ),
  ];
}

/** The debutante's chair: a high carved back and arms in gold, cushioned in velvet. */
function throne(): Part[] {
  return [
    part("frame", "Frame", 1, [
      roundedBox("seat", "velvet", [WIDTH, 0.12, mul(DEPTH, 0.75)], [0, 0.48, front(mul(DEPTH, 0.4))], 0.04),
      roundedBox("base", "throne", [WIDTH, 0.42, mul(DEPTH, 0.75)], [0, 0.21, front(mul(DEPTH, 0.4))], 0.03),
      roundedBox("back", "throne", [WIDTH, 1.4, 0.12], [0, 1.0, back(0.06)], 0.05),
      roundedBox("back_pad", "velvet", [sub(WIDTH, 0.2), 0.9, 0.04], [0, 1.0, back(0.13)], 0.015),
      ellipsoid("crest", "throne", [mul(WIDTH, 0.6), 0.3, 0.12], [0, 1.75, back(0.06)]),
    ]),
    part("arms", "Arms", TWO_SIDES, [roundedBox("arm", "throne", [0.1, 0.25, mul(DEPTH, 0.7)], [sideOf(0.05), 0.68, front(mul(DEPTH, 0.38))], 0.03)]),
  ];
}

/** A gift table: a clothed table with wrapped boxes and a card box. */
function giftTable(): Part[] {
  return [
    part("cloth", "Cloth", 1, [roundedBox("cloth", "linen", [add(WIDTH, 0.04), 0.76, add(DEPTH, 0.04)], [0, 0.38, 0], 0.015)]),
    part("gifts", "Gifts", THREE, [box("gift", "gift", [0.3, add(0.18, mul(0.07, INDEX)), 0.25], [mul(sub(INDEX, 1), div(WIDTH, THREE)), add(0.85, mul(0.035, INDEX)), 0])]),
    part("card_box", "Card box", 1, [box("card_box", "throne", [0.25, 0.25, 0.25], [sub(div(WIDTH, 2), 0.25), 0.88, back(0.2)])]),
  ];
}

/** A welcome sign on an easel. */
function welcomeSign(): Part[] {
  return [
    part("easel", "Easel", 1, [
      box("leg_front", "wood_board", [0.04, 1.7, 0.04], [0, 0.85, 0.1], { rotation: [0.12, 0, 0] }),
      box("leg_back", "wood_board", [0.04, 1.7, 0.04], [0, 0.85, -0.12], { rotation: [-0.15, 0, 0] }),
    ]),
    part("board", "Board", 1, [box("board", "screen", [min(WIDTH, 0.6), 0.8, 0.02], [0, 1.25, 0.14], { rotation: [0.12, 0, 0] })]),
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

/** An emergency exit kept clear: a green running-man sign over a hatched floor area the width of the exit. */
function emergencyExit(): Part[] {
  return [
    part("clear", "Clear area", 1, [box("clear", "exit_green", [WIDTH, 0.008, DEPTH], [0, 0.004, 0])]),
    part("sign", "Sign", 1, [
      box("sign", "exit_green", [0.6, 0.25, 0.04], [0, 2.3, back(0.02)]),
      box("arrow", "screen", [0.3, 0.06, 0.045], [0, 2.3, back(0.02)]),
    ]),
  ];
}

/** A queue line: chrome stanchions across the width joined by velvet ropes. */
function stanchions(): Part[] {
  const posts = max(2, min(32, add(floor(div(WIDTH, 1.2)), 1)));
  const x = add(mul(-0.5, WIDTH), mul(div(WIDTH, sub(posts, 1)), INDEX));
  return [
    part("posts", "Posts", posts, [
      cylinder("post", "barrier", [0.06, 0.95, 0.06], [x, 0.475, 0], { segments: 12 }),
      cylinder("base", "barrier", [0.32, 0.03, 0.32], [x, 0.015, 0], { segments: 20 }),
    ]),
    part("rope", "Rope", 1, [box("rope", "rope", [WIDTH, 0.04, 0.04], [0, 0.85, 0])]),
  ];
}

/** A crowd barrier run: steel panels with feet, one per two metres. */
function barrier(): Part[] {
  const panels = fitAcross(2);
  return [
    part("panels", "Panels", panels, [
      box("panel", "barrier", [sub(div(WIDTH, panels), 0.05), 1.0, 0.04], [spreadAcross(panels), 0.6, 0]),
      box("foot", "barrier", [0.06, 0.04, 0.7], [spreadAcross(panels), 0.02, 0]),
    ]),
  ];
}

/** A wheelchair space marked on the floor with its blue square. */
function wheelchairSpace(): Part[] {
  return [
    part("marking", "Marking", 1, [
      box("area", "floor_marking", [WIDTH, 0.006, DEPTH], [0, 0.003, 0]),
      box("symbol", "screen", [mul(WIDTH, 0.4), 0.008, mul(WIDTH, 0.4)], [0, 0.005, 0]),
    ]),
  ];
}

/** A ramp rising from the floor at its front to a landing at the back, with side rails. */
function ramp(): Part[] {
  return [
    part("slope", "Slope", 1, [box("slope", "ramp", [WIDTH, 0.05, DEPTH], [0, add(mul(DEPTH, 0.04), 0.03), 0], { rotation: [-0.08, 0, 0] })]),
    part("rails", "Rails", TWO_SIDES, [box("rail", "rail", [0.04, 0.04, DEPTH], [sideOf(0.03), 1.1, 0], { rotation: [-0.08, 0, 0] })]),
  ];
}

const ROOF_PITCH = 0.32;
const ROOF_RISE = Math.tan(ROOF_PITCH);
const ROOF_SLOPE_LENGTH = 1 / Math.cos(ROOF_PITCH);

/** A frame tent: corner poles, eaves and a peaked fabric roof pitched at about 18°. */
function tent(): Part[] {
  const eave = 2.6;
  const halfSpan = div(DEPTH, 2);
  return [
    part("poles", "Poles", TWO_SIDES, [
      cylinder("pole_back", "truss", [0.08, eave, 0.08], [sideOf(0.04), eave / 2, back(0.04)], { segments: 8 }),
      cylinder("pole_front", "truss", [0.08, eave, 0.08], [sideOf(0.04), eave / 2, front(0.04)], { segments: 8 }),
    ]),
    part("eaves", "Eaves", TWO_SIDES, [box("eave", "truss", [WIDTH, 0.08, 0.08], [0, eave, endOf(0.04)])]),
    part("roof", "Roof", TWO_SIDES, [
      box("roof", "canopy", [add(WIDTH, 0.2), 0.03, add(mul(halfSpan, ROOF_SLOPE_LENGTH), 0.25)], [0, add(eave, mul(halfSpan, ROOF_RISE / 2)), mul(endOf(0), 0.5)], {
        rotation: [mul(sub(1, mul(2, INDEX)), -ROOF_PITCH), 0, 0],
      }),
    ]),
  ];
}

/** Portable toilets in a row, a cabin per 1.2 m. */
function portableToilets(): Part[] {
  const cabins = fitAcross(1.2);
  return [
    part("cabins", "Cabins", cabins, [
      roundedBox("cabin", "toilet", [1.1, 2.3, mul(DEPTH, 0.95)], [spreadAcross(cabins), 1.15, 0], 0.05),
      box("door", "floor_marking", [0.7, 1.9, 0.02], [spreadAcross(cabins), 1.05, front(0.02)]),
      roundedBox("roof", "screen", [1.15, 0.08, DEPTH], [spreadAcross(cabins), 2.34, 0], 0.03),
    ]),
  ];
}

function generator(): Part[] {
  return [
    part("body", "Body", 1, [
      roundedBox("body", "generator", [WIDTH, 1.4, DEPTH], [0, 0.75, 0], 0.05),
      box("skid", "light_body", [add(WIDTH, 0.1), 0.1, add(DEPTH, 0.1)], [0, 0.05, 0]),
      cylinder("exhaust", "light_body", [0.1, 0.4, 0.1], [sub(div(WIDTH, 2), 0.2), 1.6, back(0.2)], { segments: 10 }),
    ]),
  ];
}

/** A floor power box with its cable cover. */
function powerPoint(): Part[] {
  return [
    part("box", "Box", 1, [roundedBox("box", "generator", [0.4, 0.3, 0.3], [0, 0.15, 0], 0.03)]),
    part("cable", "Cable cover", 1, [box("cover", "safety_yellow", [0.3, 0.04, sub(DEPTH, 0.3)], [0, 0.02, add(0.15, div(sub(DEPTH, 0.3), 2))])]),
  ];
}

function generic(): Part[] {
  return [part("body", "Body", 1, [box("body", "piece_body", [WIDTH, 0.9, DEPTH], [0, 0.45, 0])])];
}

/** The designs by variant. A variant with no drawing of its own is a plain block of its footprint. */
const VARIANTS: Record<string, () => Part[]> = {
  desk,
  "bag-check": checkCounter,
  booth,
  buffet,
  dessert,
  "cake-table": cakeTable,
  grazing,
  carving,
  "foh-desk": fohDesk,
  "led-wall": ledWall,
  "projection-screen": projectionScreen,
  speaker,
  uplight,
  "lighting-truss": lightingTruss,
  podium,
  "camera-riser": cameraRiser,
  arch,
  backdrop,
  "photo-booth": photoBooth,
  lounge,
  plant,
  umbrella,
  "string-lights": stringLights,
  throne,
  "gift-table": giftTable,
  "welcome-sign": welcomeSign,
  extinguisher,
  "first-aid": firstAid,
  "emergency-exit": emergencyExit,
  stanchions,
  barrier,
  "wheelchair-space": wheelchairSpace,
  ramp,
  tent,
  "portable-toilets": portableToilets,
  generator,
  power: powerPoint,
};

/** Whether `variant` has a drawing of its own here (a stage variant that does is not drawn as a stage). */
export function hasSmallPieceDesign(variant: string): boolean {
  return isKey(VARIANTS, variant);
}

/**
 * A size parameter ranging from half to twice the piece's own size. Pascal checks a design across its whole range, and a podium
 * or an umbrella drawn 25 m deep is no longer one.
 */
const sizeParameter = (id: string, label: string, value: number) => param(id, label, value, Math.max(0.2, value / 2), Math.min(29.9, Math.max(1, value * 2)), "m");

/** A piece of the small kinds: its variant's drawing, sized by its footprint. */
export function smallPieceDesign(node: PrismPieceNode): EventDesign {
  const parts = isKey(VARIANTS, node.variant) ? VARIANTS[node.variant]!() : generic();
  const recipe = designOf({
    name: node.variant,
    description: `Event piece: ${node.variant}.`,
    parameters: [sizeParameter("width", "Width", node.width), sizeParameter("depth", "Depth", node.depth)],
    parts,
  });
  return { recipe, values: { width: node.width, depth: node.depth } };
}
