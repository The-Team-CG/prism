import type { Expr } from "@pascal-app/core/procedural-items";
import type { ChairStyle } from "../dressing";
import { box, cylinder, ellipsoid, flag, max, mul, roundedBox, sub, type Shape } from "./kit";

/**
 * One chair, drawn in its own frame: the seat's centre at the origin, the front facing +z (toward the table) and the
 * back at −z. Its parent part's frame places and turns it. A bare chair stands on four thin legs with a cushioned seat and
 * two back posts under a top rail; its style fills the back: `spindle_back` (chiavari, tiffany) adds thin spindles,
 * `cross_back` an X, and with neither the back is a padded panel (banquet, ghost). A `covered` chair is wrapped in a
 * fitted cover to the floor instead, and `sash` ties a band and bow round its back.
 */
export const CHAIR_SEAT_HEIGHT_M = 0.46;
const LEG_HEIGHT_M = CHAIR_SEAT_HEIGHT_M - 0.025;
const BACK_TOP_M = 0.9;
const BACK_Z = -0.18;
const POST_X = 0.18;
const LEG = 0.024;
const BACK_MIDDLE_M = (CHAIR_SEAT_HEIGHT_M + BACK_TOP_M) / 2;

const bare: Expr = sub(1, "covered");
const paddedBack: Expr = mul(bare, sub(1, max("cross_back", "spindle_back")));
const crossBack: Expr = mul(bare, "cross_back");
const spindleBack: Expr = mul(bare, "spindle_back");

function legs(): Shape[] {
  const corners: Array<[number, number]> = [[-POST_X, 0.17], [POST_X, 0.17], [-POST_X, BACK_Z], [POST_X, BACK_Z]];
  return corners.map(([x, z], index) =>
    cylinder(`leg_${index}`, "chair_frame", [LEG, LEG_HEIGHT_M, LEG], [x, LEG_HEIGHT_M / 2, z], { segments: 8, when: bare }),
  );
}

function backFrame(): Shape[] {
  const postHeight = BACK_TOP_M - CHAIR_SEAT_HEIGHT_M;
  return [
    ...[-POST_X, POST_X].map((x, index) =>
      cylinder(`post_${index}`, "chair_frame", [LEG, postHeight, LEG], [x, CHAIR_SEAT_HEIGHT_M + postHeight / 2, BACK_Z], { segments: 8, when: bare }),
    ),
    roundedBox("top_rail", "chair_frame", [2 * POST_X + LEG, 0.05, 0.03], [0, BACK_TOP_M - 0.025, BACK_Z], 0.01, { when: bare }),
  ];
}

function backFill(): Shape[] {
  return [
    roundedBox("panel", "chair_back", [2 * POST_X - 0.02, 0.32, 0.05], [0, BACK_MIDDLE_M, BACK_Z], 0.02, { when: paddedBack }),
    box("cross_a", "chair_frame", [0.46, 0.03, 0.02], [0, BACK_MIDDLE_M, BACK_Z], { rotation: [0, 0, 0.75], when: crossBack }),
    box("cross_b", "chair_frame", [0.46, 0.03, 0.02], [0, BACK_MIDDLE_M, BACK_Z], { rotation: [0, 0, -0.75], when: crossBack }),
    ...[-0.09, 0, 0.09].map((x, index) =>
      cylinder(`spindle_${index}`, "chair_frame", [0.014, 0.36, 0.014], [x, BACK_MIDDLE_M, BACK_Z], { segments: 6, when: spindleBack }),
    ),
  ];
}

/** A fitted cover: a skirt from the floor to the seat and a sleeve over the back. */
function cover(): Shape[] {
  return [
    roundedBox("cover_skirt", "chair_cover", [0.47, CHAIR_SEAT_HEIGHT_M + 0.03, 0.45], [0, (CHAIR_SEAT_HEIGHT_M + 0.03) / 2, -0.005], 0.03, { when: "covered" }),
    roundedBox("cover_back", "chair_cover", [0.45, BACK_TOP_M - CHAIR_SEAT_HEIGHT_M + 0.04, 0.09], [0, BACK_MIDDLE_M + 0.02, BACK_Z], 0.04, { when: "covered" }),
  ];
}

/** A band round the back with a bow behind it. */
function sash(): Shape[] {
  const height = BACK_MIDDLE_M - 0.04;
  return [
    box("sash_band", "sash", [0.47, 0.08, 0.11], [0, height, BACK_Z], { when: "sash" }),
    ellipsoid("sash_bow", "sash", [0.2, 0.1, 0.06], [0, height, BACK_Z - 0.07], { when: "sash" }),
    box("sash_tail", "sash", [0.07, 0.3, 0.015], [0.03, height - 0.18, BACK_Z - 0.07], { when: "sash" }),
  ];
}

export function chairShapes(): Shape[] {
  return [
    ...legs(),
    roundedBox("seat", "chair_seat", [0.42, 0.05, 0.4], [0, CHAIR_SEAT_HEIGHT_M, 0], 0.02, { when: bare }),
    ...backFrame(),
    ...backFill(),
    ...cover(),
    ...sash(),
  ];
}

/** The chair's style flags, for a recipe that draws chairs. */
export const CHAIR_PARAMETERS = [flag("cross_back", "Cross back"), flag("spindle_back", "Spindle back"), flag("covered", "Covered"), flag("sash", "Sash")];

/** The flag values that draw a chair of `style`, with or without a sash. */
export function chairValues(style: ChairStyle, sashed: boolean): Record<string, number> {
  return {
    cross_back: style === "cross-back" ? 1 : 0,
    spindle_back: style === "chiavari" || style === "tiffany" ? 1 : 0,
    covered: style === "covered" ? 1 : 0,
    sash: sashed ? 1 : 0,
  };
}
