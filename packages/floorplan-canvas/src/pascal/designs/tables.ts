import type { Expr } from "@pascal-app/core/procedural-items";
import type { PrismTableNode } from "@prism/types";
import { accentOf, centerpieceOf, type Centerpiece } from "../dressing";
import { RUN_DEPTH_M, joinedRuns, type TableRun } from "@prism/floorplan-scene";
import {
  HALF_PI,
  PI,
  add,
  box,
  cos,
  count,
  cylinder,
  designOf,
  div,
  ellipsoid,
  flag,
  mul,
  param,
  part,
  revolve,
  ringAngle,
  roundedBox,
  sin,
  sub,
  type EventDesign,
  type Shape,
  type Vec3,
} from "./kit";

/**
 * A table's own design: its cloth, overlay or runner, centrepiece and number card. Its chairs and place settings are not
 * part of it; they stand at the table's seat spots (`seatSpots` in `@prism/floorplan-scene`), drawn as copies of one
 * chair and one setting (see `index.ts`).
 */

const DINING_HEIGHT_M = 0.75;
const COCKTAIL_HEIGHT_M = 1.1;
const CLOTH_LIFT_M = 0.005;
export const TABLE_TOP_M = DINING_HEIGHT_M + CLOTH_LIFT_M;
/** How far a cloth's skirt hangs out from the table's edge, and the spacing of its folds round a round table. */
const SKIRT_OUT_M = 0.035;
const FOLD_SPACING_M = 0.15;

/** The dressing flags a dining table's design takes, set from its card. */
const DRESSING_PARAMETERS = [flag("overlay", "Overlay"), flag("numbered", "Table number")];

function dressingValues(node: PrismTableNode): Record<string, number> {
  return { overlay: accentOf(node.overlay) ? 1 : 0, numbered: node.number === undefined ? 0 : 1 };
}

/** Points round a centre: a bloom cluster's heads, given as [dx, dz, lift, size]. */
const DOME: Array<[number, number, number, number]> = [
  [0, 0, 0.17, 0.13],
  [0.1, 0.02, 0.14, 0.11],
  [-0.09, 0.05, 0.14, 0.11],
  [0.02, -0.1, 0.14, 0.11],
  [-0.05, -0.08, 0.12, 0.1],
  [0.07, 0.09, 0.12, 0.1],
  [-0.12, -0.03, 0.1, 0.09],
  [0.13, -0.06, 0.1, 0.09],
];

/** A low arrangement: a short glass bowl under a dome of blooms, with greenery spilling over the rim. */
function lowFloral(): Shape[] {
  return [
    revolve("low_bowl", "vase", [[0, 0.002], [0.08, 0.002], [0.11, 0.07], [0.105, 0.075], [0, 0.03]], [0, TABLE_TOP_M, 0], { segments: 24 }),
    ...DOME.map(([dx, dz, lift, size], index) => ellipsoid(`bloom_${index}`, "florals", [size, size * 0.8, size], [dx, TABLE_TOP_M + lift, dz])),
    ...[0, 1, 2, 3, 4, 5].map((index) => {
      const angle = (index / 6) * 2 * PI + 0.3;
      return ellipsoid(`leaf_${index}`, "greenery", [0.16, 0.035, 0.07], [Math.cos(angle) * 0.14, TABLE_TOP_M + 0.07, Math.sin(angle) * 0.14]);
    }),
  ];
}

/** A tall arrangement: a slim glass cylinder under a crown of blooms, with greenery falling from it. */
function tallFloral(): Shape[] {
  const crown = TABLE_TOP_M + 0.68;
  return [
    cylinder("tall_vase", "vase", [0.1, 0.58, 0.1], [0, TABLE_TOP_M + 0.29, 0], { segments: 20 }),
    ...DOME.map(([dx, dz, lift, size], index) =>
      ellipsoid(`crown_${index}`, "florals", [size * 1.3, size, size * 1.3], [dx * 1.6, crown + lift * 0.7, dz * 1.6]),
    ),
    ...[0, 1, 2, 3, 4].map((index) => {
      const angle = (index / 5) * 2 * PI;
      return ellipsoid(`trail_${index}`, "greenery", [0.07, 0.24, 0.05], [Math.cos(angle) * 0.2, crown - 0.06, Math.sin(angle) * 0.2]);
    }),
  ];
}

/** Three pillar candles of stepped heights, each in a hurricane glass, on a ring of greenery. */
function candles(): Shape[] {
  return [0, 1, 2].flatMap((index) => {
    const dx = (index - 1) * 0.12;
    const height = 0.14 + index * 0.06;
    return [
      cylinder(`pillar_${index}`, "candle", [0.07, height, 0.07], [dx, TABLE_TOP_M + height / 2, 0], { segments: 16 }),
      cylinder(`hurricane_${index}`, "vase", [0.11, height + 0.08, 0.11], [dx, TABLE_TOP_M + (height + 0.08) / 2, 0], { segments: 20 }),
      ellipsoid(`sprig_${index}`, "greenery", [0.14, 0.03, 0.06], [dx, TABLE_TOP_M + 0.015, 0.08]),
    ];
  });
}

const CENTREPIECES: Record<Exclude<Centerpiece, "none">, { label: string; shapes: () => Shape[] }> = {
  "low floral": { label: "Low floral", shapes: lowFloral },
  "tall floral": { label: "Tall floral", shapes: tallFloral },
  candles: { label: "Candles", shapes: candles },
};

/** The card's centrepiece as a design of its own, which a table repeats along its length; none for a bare table. */
export function centrepieceDesign(node: PrismTableNode): EventDesign | null {
  const kind = centerpieceOf(node.centerpiece);
  if (kind === "none") return null;
  const { label, shapes } = CENTREPIECES[kind];
  const recipe = designOf({
    name: label,
    description: `A ${label.toLowerCase()} centrepiece.`,
    parameters: [flag("greenery", "Greenery")],
    parts: [part("centrepiece", label, 1, shapes().map((shape) => (shape.slot === "greenery" ? { ...shape, when: "greenery" } : shape)))],
  });
  return { recipe, values: { greenery: 1 } };
}

/** Space a long run's centrepieces this far apart, as a banquet is dressed. */
const CENTREPIECE_SPACING_M = 1.8;

/** Where a table's centrepieces stand: the middle of a round, and evenly along each run of a long table. */
export function centrepieceSpots(node: PrismTableNode): Array<{ x: number; z: number }> {
  if (node.shape === "round" || node.shape === "cocktail") return [{ x: 0, z: 0 }];
  const runs = node.shape === "rect" ? [{ id: "table", length: node.width, centre: [0, 0] as [number, number], alongZ: false, outward: 1 as const }] : joinedRuns(node);
  return runs.flatMap(({ length, centre: [x, z], alongZ }) => {
    const pieces = Math.max(1, Math.round(length / CENTREPIECE_SPACING_M));
    return Array.from({ length: pieces }, (_, index) => {
      const along = (index + 0.5) * (length / pieces) - length / 2;
      return alongZ ? { x, z: z + along } : { x: x + along, z };
    });
  });
}

/** A table-number card in a slim stand. */
function numberCard(x: Expr, z: Expr): Shape[] {
  return [
    cylinder("number_stand", "number_card", [0.008, 0.14, 0.008], [x, TABLE_TOP_M + 0.07, z], { segments: 6, when: "numbered" }),
    roundedBox("number_card", "number_card", [0.14, 0.1, 0.008], [x, TABLE_TOP_M + 0.19, z], 0.003, { when: "numbered" }),
  ];
}

/**
 * The round cloth's section, from the middle of the top out over a soft rolled edge and down to a slight pool on the
 * floor. Revolved, it is the cloth's body; its folds stand round it.
 */
function roundClothProfile(radius: Expr): [Expr, Expr][] {
  return [
    [0, TABLE_TOP_M],
    [sub(radius, 0.02), TABLE_TOP_M],
    [add(radius, 0.008), TABLE_TOP_M - 0.006],
    [add(radius, 0.024), TABLE_TOP_M - 0.024],
    [add(radius, SKIRT_OUT_M), TABLE_TOP_M - 0.06],
    [add(radius, SKIRT_OUT_M), 0.08],
    [add(radius, SKIRT_OUT_M + 0.025), 0.02],
    [add(radius, SKIRT_OUT_M + 0.045), 0.003],
  ];
}

/** Soft vertical folds round a round cloth's skirt: one shallow rounded pleat every 15 cm of its circumference. */
function roundFolds(radius: Expr): Shape[] {
  const angle = ringAngle("folds");
  const ring = add(radius, SKIRT_OUT_M);
  const height = TABLE_TOP_M - 0.09;
  return [
    cylinder("fold", "linen", [0.075, height, 0.03], [mul(cos(angle), ring), height / 2 + 0.01, mul(sin(angle), ring)], {
      rotation: [0, sub(mul(-1, angle), HALF_PI), 0],
      segments: 10,
    }),
  ];
}

/** How many folds a round cloth of `diameter` falls in. */
const foldsFor = (diameter: number) => Math.min(64, Math.max(16, Math.round((PI * (diameter + 0.1)) / FOLD_SPACING_M)));

/**
 * A round table under a floor-length linen: the cloth lies flat over the top, rolls over its edge and falls in soft
 * folds to a slight pool on the floor, so no frame shows. A square overlay sits on the diagonal when it has one.
 */
function roundDesign(node: PrismTableNode): EventDesign {
  const radius = div("diameter", 2);
  const recipe = designOf({
    name: "Round table",
    description: "A round table under a floor-length linen.",
    parameters: [param("diameter", "Diameter", 1.8, 0.6, 3.6, "m"), count("folds", "Folds", 40, 16, 64), ...DRESSING_PARAMETERS],
    parts: [
      part("linen", "Linen", 1, [
        revolve("cloth", "linen", roundClothProfile(radius), [0, 0, 0], { segments: 64 }),
        roundedBox("overlay", "overlay", [mul("diameter", 0.74), 0.006, mul("diameter", 0.74)], [0, TABLE_TOP_M + 0.004, 0], 0.002, {
          rotation: [0, PI / 4, 0],
          when: "overlay",
        }),
      ]),
      part("folds", "Folds", "folds", roundFolds(radius)),
      part("number", "Number", 1, numberCard(0, mul(radius, 0.42))),
    ],
  });
  return { recipe, values: { diameter: node.width, folds: foldsFor(node.width), ...dressingValues(node) } };
}

/**
 * A standing cocktail table under a stretch cover, cinched at its waist by a band in the overlay colour when it has one,
 * flaring to the floor.
 */
function cocktailDesign(node: PrismTableNode): EventDesign {
  const radius = div("diameter", 2);
  const top = COCKTAIL_HEIGHT_M + CLOTH_LIFT_M;
  const waist = COCKTAIL_HEIGHT_M * 0.55;
  const recipe = designOf({
    name: "Cocktail table",
    description: "A standing cocktail table under a stretch cover cinched at the waist.",
    parameters: [param("diameter", "Diameter", 0.7, 0.4, 1.2, "m"), flag("overlay", "Waist band")],
    parts: [
      part("cover", "Cover", 1, [
        revolve(
          "cover",
          "linen",
          [
            [0, top],
            [sub(radius, 0.015), top],
            [radius, top - 0.012],
            [radius, COCKTAIL_HEIGHT_M - 0.04],
            [mul(radius, 0.55), COCKTAIL_HEIGHT_M - 0.2],
            [0.1, waist],
            [mul(radius, 0.55), waist - 0.25],
            [mul(radius, 0.82), 0.02],
            [mul(radius, 0.86), 0.003],
          ],
          [0, 0, 0],
          { segments: 48 },
        ),
        revolve("band", "overlay", [[0.105, waist - 0.03], [0.118, waist], [0.105, waist + 0.03]], [0, 0, 0], { segments: 32, when: "overlay" }),
      ]),
    ],
  });
  return { recipe, values: { diameter: node.width, overlay: accentOf(node.overlay) ? 1 : 0 } };
}

/**
 * A run of table: its fitted floor-length cloth with a slight pool at the hem, its runner falling over both ends when it
 * has an overlay, and its centrepiece.
 */
function runShapes({ id, length, centre: [x, z], alongZ }: TableRun, depth: number): Shape[] {
  const along = (a: number, b: number): [number, number] => (alongZ ? [b, a] : [a, b]);
  const [sizeX, sizeZ] = along(length + 0.05, depth + 0.05);
  const [hemX, hemZ] = along(length + 0.1, depth + 0.1);
  const [runnerX, runnerZ] = along(length + 0.06, 0.34);
  const drop = (end: number): Vec3 => {
    const [dx, dz] = along(end * (length / 2 + 0.035), 0);
    return [dx, TABLE_TOP_M - 0.16, dz];
  };
  const [dropX, dropZ] = along(0.008, 0.34);
  return [
    roundedBox(`${id}_cloth`, "linen", [sizeX, TABLE_TOP_M, sizeZ], [x, TABLE_TOP_M / 2, z], 0.02),
    roundedBox(`${id}_hem`, "linen", [hemX, 0.03, hemZ], [x, 0.015, z], 0.012),
    roundedBox(`${id}_runner`, "overlay", [runnerX, 0.006, runnerZ], [x, TABLE_TOP_M + 0.004, z], 0.002, { when: "overlay" }),
    box(`${id}_runner_end_a`, "overlay", [dropX, 0.32, dropZ], drop(-1), { when: "overlay" }),
    box(`${id}_runner_end_b`, "overlay", [dropX, 0.32, dropZ], drop(1), { when: "overlay" }),
  ];
}

function runsDesign(node: PrismTableNode, name: string, runs: TableRun[], depth: number, number: [number, number]): EventDesign {
  const recipe = designOf({
    name,
    description: `${name} under fitted floor-length linens.`,
    parameters: DRESSING_PARAMETERS,
    parts: [part("tables", "Tables", 1, [...runs.flatMap((run) => runShapes(run, depth)), ...numberCard(...number)])],
  });
  return { recipe, values: dressingValues(node) };
}

export function tableDesign(node: PrismTableNode): EventDesign {
  switch (node.shape) {
    case "rect": {
      const table: TableRun = { id: "table", length: node.width, centre: [0, 0], alongZ: false, outward: 1 };
      return runsDesign(node, "Banquet table", [table], node.depth, [-node.width / 2 + 0.25, 0]);
    }
    case "cocktail":
      return cocktailDesign(node);
    case "u-shape":
      return runsDesign(node, "U-shape", joinedRuns(node), RUN_DEPTH_M, [0.4, -node.depth / 2 + RUN_DEPTH_M / 2]);
    case "hollow-square":
      return runsDesign(node, "Hollow square", joinedRuns(node), RUN_DEPTH_M, [0.4, -node.depth / 2 + RUN_DEPTH_M / 2]);
    default:
      return roundDesign(node);
  }
}
