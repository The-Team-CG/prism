import type { Expr } from "@pascal-app/core/procedural-items";
import type { PrismTableNode } from "@prism/types";
import { accentOf, centerpieceOf, type Centerpiece } from "../dressing";
import { RUN_DEPTH_M, joinedRuns, type TableRun } from "@prism/floorplan-scene";
import { PI, add, box, cylinder, designOf, div, ellipsoid, flag, mul, param, part, revolve, roundedBox, type EventDesign, type Shape, type Vec3 } from "./kit";

/**
 * A table's own design: its cloth, overlay or runner, centrepiece and number card. Its chairs are not part of it; they
 * stand at the table's seat spots (`seatSpots` in `@prism/floorplan-scene`), drawn as copies of one chair (see `index.ts`).
 */

const DINING_HEIGHT_M = 0.75;
const COCKTAIL_HEIGHT_M = 1.1;
const CLOTH_LIFT_M = 0.005;
const TABLE_TOP_M = DINING_HEIGHT_M + CLOTH_LIFT_M;

/** The dressing flags a dining table's design takes, set from its card. */
const DRESSING_PARAMETERS = [flag("overlay", "Overlay"), flag("numbered", "Table number"), flag("low_floral", "Low floral"), flag("tall_floral", "Tall floral"), flag("candles", "Candles")];

const CENTERPIECE_FLAGS: Record<Centerpiece, Record<string, number>> = {
  none: { low_floral: 0, tall_floral: 0, candles: 0 },
  "low floral": { low_floral: 1, tall_floral: 0, candles: 0 },
  "tall floral": { low_floral: 0, tall_floral: 1, candles: 0 },
  candles: { low_floral: 0, tall_floral: 0, candles: 1 },
};

function dressingValues(node: PrismTableNode): Record<string, number> {
  return { ...CENTERPIECE_FLAGS[centerpieceOf(node.centerpiece)], overlay: accentOf(node.overlay) ? 1 : 0, numbered: node.number === undefined ? 0 : 1 };
}

/** The centrepiece a card picked, standing at (x, top, z): a floral bowl, a tall vase under a bloom, or three pillar candles. */
function centrepiece(prefix: string, x: number, z: number): Shape[] {
  const at = (lift: number, dx = 0): Vec3 => [x + dx, TABLE_TOP_M + lift, z];
  return [
    cylinder(`${prefix}low_bowl`, "vase", [0.22, 0.08, 0.22], at(0.04), { when: "low_floral" }),
    ellipsoid(`${prefix}low_bloom`, "florals", [0.42, 0.2, 0.42], at(0.13), { when: "low_floral" }),
    cylinder(`${prefix}tall_vase`, "vase", [0.09, 0.55, 0.09], at(0.275), { when: "tall_floral" }),
    ellipsoid(`${prefix}tall_bloom`, "florals", [0.55, 0.4, 0.55], at(0.7), { when: "tall_floral" }),
    ...[-0.08, 0, 0.08].map((dx, index) =>
      cylinder(`${prefix}candle_${index}`, "candle", [0.07, 0.12 + index * 0.06, 0.07], at((0.12 + index * 0.06) / 2, dx), { when: "candles" }),
    ),
  ];
}

/** A table-number card on a thin stand. */
function numberCard(x: Expr, z: Expr): Shape[] {
  return [
    cylinder("number_stand", "number_card", [0.01, 0.16, 0.01], [x, TABLE_TOP_M + 0.08, z], { segments: 6, when: "numbered" }),
    box("number_card", "number_card", [0.13, 0.09, 0.006], [x, TABLE_TOP_M + 0.2, z], { when: "numbered" }),
  ];
}

/**
 * A round table under a floor-length linen: the cloth lies flat over the top, rolls over its edge and drapes out to the
 * floor, so no frame shows. A square overlay sits on the diagonal when it has one.
 */
function roundDesign(node: PrismTableNode): EventDesign {
  const radius = div("diameter", 2);
  const recipe = designOf({
    name: "Round table",
    description: "A round table under a floor-length linen.",
    parameters: [param("diameter", "Diameter", 1.8, 0.6, 3.6, "m"), ...DRESSING_PARAMETERS],
    parts: [
      part("linen", "Linen", 1, [
        revolve(
          "cloth",
          "linen",
          [
            [0, TABLE_TOP_M],
            [add(radius, 0.01), TABLE_TOP_M],
            [add(radius, 0.03), DINING_HEIGHT_M - 0.025],
            [add(radius, 0.045), DINING_HEIGHT_M * 0.5],
            [add(radius, 0.07), 0.005],
          ],
          [0, 0, 0],
          { segments: 48 },
        ),
        box("overlay", "overlay", [mul("diameter", 0.72), 0.006, mul("diameter", 0.72)], [0, TABLE_TOP_M + 0.003, 0], { rotation: [0, PI / 4, 0], when: "overlay" }),
      ]),
      part("centrepiece", "Centerpiece", 1, [...centrepiece("", 0, 0), ...numberCard(0, mul(radius, 0.55))]),
    ],
  });
  return { recipe, values: { diameter: node.width, ...dressingValues(node) } };
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
            [radius, top],
            [radius, COCKTAIL_HEIGHT_M - 0.03],
            [0.11, waist],
            [mul(radius, 0.85), 0.005],
          ],
          [0, 0, 0],
          { segments: 40 },
        ),
        cylinder("band", "overlay", [0.25, 0.05, 0.25], [0, waist, 0], { segments: 24, when: "overlay" }),
      ]),
    ],
  });
  return { recipe, values: { diameter: node.width, overlay: accentOf(node.overlay) ? 1 : 0 } };
}

/** A run of table: its fitted cloth, its runner when it has an overlay, and its centrepiece. */
function runShapes({ id, length, centre: [x, z], alongZ }: TableRun, depth: number): Shape[] {
  const [sizeX, sizeZ] = alongZ ? [depth + 0.04, length + 0.04] : [length + 0.04, depth + 0.04];
  const [runnerX, runnerZ] = alongZ ? [0.35, length + 0.1] : [length + 0.1, 0.35];
  return [
    roundedBox(`${id}_cloth`, "linen", [sizeX, DINING_HEIGHT_M, sizeZ], [x, DINING_HEIGHT_M / 2 + CLOTH_LIFT_M, z], 0.015),
    box(`${id}_runner`, "overlay", [runnerX, 0.006, runnerZ], [x, TABLE_TOP_M + 0.003, z], { when: "overlay" }),
    ...centrepiece(`${id}_`, x, z),
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
