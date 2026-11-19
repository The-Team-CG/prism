import type { Expr } from "@pascal-app/core/procedural-items";
import { box, cylinder, flag, max, part, roundedBox, sub, type Part, type Shape, type Vec3 } from "./kit";

/**
 * One chair, drawn in its own frame: the seat's centre at the origin, the front facing +z (toward the table) and the
 * back at −z. Its parent part's frame places and turns it. Every chair stands on four thin legs with a cushioned seat and
 * two back posts under a top rail; its style fills the back: `spindle_back` (chiavari) adds thin spindles, `cross_back` an
 * X, and with neither the back is a padded panel (banquet, ghost).
 */
export const CHAIR_SEAT_HEIGHT_M = 0.46;
const LEG_HEIGHT_M = CHAIR_SEAT_HEIGHT_M - 0.025;
const BACK_TOP_M = 0.9;
const BACK_Z = -0.18;
const POST_X = 0.18;
const LEG = 0.024;

const paddedBack: Expr = sub(1, max("cross_back", "spindle_back"));

function legs(): Shape[] {
  const corners: Array<[number, number]> = [[-POST_X, 0.17], [POST_X, 0.17], [-POST_X, BACK_Z], [POST_X, BACK_Z]];
  return corners.map(([x, z], index) => cylinder(`leg_${index}`, "chair_frame", [LEG, LEG_HEIGHT_M, LEG], [x, LEG_HEIGHT_M / 2, z], { segments: 8 }));
}

function backFrame(): Shape[] {
  const postHeight = BACK_TOP_M - CHAIR_SEAT_HEIGHT_M;
  return [
    ...[-POST_X, POST_X].map((x, index) =>
      cylinder(`post_${index}`, "chair_frame", [LEG, postHeight, LEG], [x, CHAIR_SEAT_HEIGHT_M + postHeight / 2, BACK_Z], { segments: 8 }),
    ),
    roundedBox("top_rail", "chair_frame", [2 * POST_X + LEG, 0.05, 0.03], [0, BACK_TOP_M - 0.025, BACK_Z], 0.01),
  ];
}

function backFill(): Shape[] {
  const middle = (CHAIR_SEAT_HEIGHT_M + BACK_TOP_M) / 2;
  return [
    roundedBox("panel", "chair_back", [2 * POST_X - 0.02, 0.32, 0.05], [0, middle, BACK_Z], 0.02, { when: paddedBack }),
    box("cross_a", "chair_frame", [0.46, 0.03, 0.02], [0, middle, BACK_Z], { rotation: [0, 0, 0.75], when: "cross_back" }),
    box("cross_b", "chair_frame", [0.46, 0.03, 0.02], [0, middle, BACK_Z], { rotation: [0, 0, -0.75], when: "cross_back" }),
    ...[-0.09, 0, 0.09].map((x, index) =>
      cylinder(`spindle_${index}`, "chair_frame", [0.014, 0.36, 0.014], [x, middle, BACK_Z], { segments: 6, when: "spindle_back" }),
    ),
  ];
}

export function chairShapes(): Shape[] {
  return [...legs(), roundedBox("seat", "chair_seat", [0.42, 0.05, 0.4], [0, CHAIR_SEAT_HEIGHT_M, 0], 0.02), ...backFrame(), ...backFill()];
}

/** The chair's two style flags, for a recipe that draws chairs. */
export const CHAIR_PARAMETERS = [flag("cross_back", "Cross back"), flag("spindle_back", "Spindle back")];

/**
 * A repeat of chairs placed by its frame. `position` and `rotation` are expressions of `index`, so each repeat lands on its
 * own seat.
 */
export function chairPart(id: string, label: string, repeat: Expr, position: Vec3, rotation: Vec3): Part {
  return part(id, label, repeat, chairShapes(), { frame: { position, rotation } });
}
