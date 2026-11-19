import type { PrismTableNode } from "@prism/types";
import { CHAIR_PARAMETERS, chairPart } from "./chairs";
import {
  HALF_PI,
  PI,
  add,
  roundedBox,
  ceil,
  count,
  cos,
  cylinder,
  designOf,
  div,
  INDEX,
  metres,
  mul,
  param,
  part,
  revolve,
  ringAngle,
  sin,
  sub,
  type EventDesign,
} from "./kit";
import { isKey } from "./lookup";

const DINING_HEIGHT_M = 0.75;
const COCKTAIL_HEIGHT_M = 1.1;
/** How far a chair's centre stands out from the table edge: clear of the linen and the seat's depth. */
const CHAIR_CENTRE_OUTSET_M = 0.45;

const CENTREPIECE_WIDTH_M = 0.14;

/** Centrepiece heights by card choice; "none" and an unset value leave the table bare. */
const CENTREPIECE_HEIGHTS_M = { none: 0, "low floral": 0.2, "tall floral": 0.55, candles: 0.16 } as const;

function centrepieceHeight(centerpiece: string | undefined): number {
  if (centerpiece === undefined) return 0;
  if (!isKey(CENTREPIECE_HEIGHTS_M, centerpiece)) throw new Error(`Unknown centerpiece "${centerpiece}"`);
  return CENTREPIECE_HEIGHTS_M[centerpiece];
}

const centrepieceParameter = metres("centerpiece_height", "Centerpiece height", 0, 0, 0.6);

/**
 * A round or cocktail table under a floor-length linen: the cloth lies flat over the top, rolls over its edge and drapes
 * out to the floor, so no frame shows. One chair per seat rings it.
 */
function roundRecipe() {
  const diameter = "diameter";
  const height = "height";
  const radius = div(diameter, 2);
  const seatRadius = add(radius, CHAIR_CENTRE_OUTSET_M);
  const angle = ringAngle("seats");
  const centrepiece = "centerpiece_height";
  const clothTop = add(height, 0.005);
  return designOf({
    name: "Round table",
    description: "A round or cocktail table under a floor-length linen, with chairs ringing it.",
    parameters: [
      param("diameter", "Diameter", 1.8, 0.4, 3, "m"),
      param("height", "Height", DINING_HEIGHT_M, 0.4, 1.2, "m"),
      count("seats", "Seats", 8, 0, 24),
      ...CHAIR_PARAMETERS,
      centrepieceParameter,
    ],
    parts: [
      part("linen", "Linen", 1, [
        revolve(
          "cloth",
          "linen",
          [
            [0, clothTop],
            [add(radius, 0.01), clothTop],
            [add(radius, 0.03), sub(height, 0.025)],
            [add(radius, 0.045), mul(height, 0.5)],
            [add(radius, 0.07), 0.005],
          ],
          [0, 0, 0],
          { segments: 48 },
        ),
      ]),
      part("centrepiece", "Centerpiece", 1, [
        cylinder("vase", "centerpiece", [CENTREPIECE_WIDTH_M, centrepiece, CENTREPIECE_WIDTH_M], [0, add(clothTop, div(centrepiece, 2)), 0], {
          when: centrepiece,
        }),
      ]),
      chairPart("chairs", "Chairs", "seats", [mul(seatRadius, cos(angle)), 0, mul(seatRadius, sin(angle))], [0, sub(0, add(angle, HALF_PI)), 0]),
    ],
  });
}

/**
 * A banquet table under a fitted linen box to the floor, with chairs along both long sides. The near side takes
 * the odd seat, matching the plan symbol.
 */
function banquetRecipe() {
  const width = "width";
  const depth = "depth";
  const seats = "seats";
  const nearCount = ceil(div(seats, 2));
  const farCount = sub(seats, nearCount);
  const sideOutset = add(div(depth, 2), CHAIR_CENTRE_OUTSET_M);
  const spread = (repeats: typeof nearCount) => add(mul(-0.5, width), div(mul(width, add(INDEX, 0.5)), repeats));
  const centrepiece = "centerpiece_height";
  return designOf({
    name: "Banquet table",
    description: "A rectangular banquet table under a fitted floor-length linen, with chairs along both long sides.",
    parameters: [
      param("width", "Width", 2.4, 1, 4, "m"),
      param("depth", "Depth", 0.75, 0.5, 1.4, "m"),
      count("seats", "Seats", 8, 0, 24),
      ...CHAIR_PARAMETERS,
      centrepieceParameter,
    ],
    parts: [
      part("linen", "Linen", 1, [
        roundedBox("cloth", "linen", [add(width, 0.04), DINING_HEIGHT_M, add(depth, 0.04)], [0, add(div(DINING_HEIGHT_M, 2), 0.005), 0], 0.015),
      ]),
      part("centrepiece", "Centerpiece", 1, [
        cylinder("vase", "centerpiece", [CENTREPIECE_WIDTH_M, centrepiece, CENTREPIECE_WIDTH_M], [0, add(DINING_HEIGHT_M + 0.005, div(centrepiece, 2)), 0], {
          when: centrepiece,
        }),
      ]),
      chairPart("chairs_near", "Chairs, near side", nearCount, [spread(nearCount), 0, sideOutset], [0, PI, 0]),
      chairPart("chairs_far", "Chairs, far side", farCount, [spread(farCount), 0, sub(0, sideOutset)], [0, 0, 0]),
    ],
  });
}

export function tableDesign(node: PrismTableNode): EventDesign {
  const flags = {
    cross_back: node.chairStyle === "cross-back" ? 1 : 0,
    spindle_back: node.chairStyle === "chiavari" ? 1 : 0,
  };
  const centerpiece_height = centrepieceHeight(node.centerpiece);
  if (node.shape === "rect") {
    return { recipe: banquetRecipe(), values: { width: node.width, depth: node.depth, seats: node.seats, ...flags, centerpiece_height } };
  }
  const height = node.shape === "cocktail" ? COCKTAIL_HEIGHT_M : DINING_HEIGHT_M;
  return { recipe: roundRecipe(), values: { diameter: node.width, height, seats: node.seats, ...flags, centerpiece_height } };
}

