import type { ChairStyle } from "../dressing";
import { HALF_PI, box, cylinder, ellipsoid, flag, roundedBox, type Shape, type Vec3 } from "./kit";

/**
 * One chair, drawn in its own frame: the seat's centre at the origin, the front facing +z (toward the table) and the
 * back at −z. Its parent part's frame places and turns it. Each style is drawn as itself, at a rental chair's real
 * proportions: a 46 cm seat, a back to about 92 cm raked a little back, rounded edges throughout. A `sash` ties a satin
 * band round the back with a bow and two tails behind.
 */
export const CHAIR_SEAT_HEIGHT_M = 0.46;
const BACK_TOP_M = 0.92;
/** How far a back leans back from upright, in radians, and so how far back its top sits. */
const RAKE = 0.08;
const BACK_Z = -0.18;
const atRake = (height: number) => BACK_Z - (height - CHAIR_SEAT_HEIGHT_M) * Math.tan(RAKE);
const LEAN: Vec3 = [-RAKE, 0, 0];

/** A post from the floor to `top`, standing at (x, z) and leaning back with the chair's rake. */
const backPost = (id: string, slot: "chair_frame", x: number, thickness: number, top: number): Shape =>
  cylinder(id, slot, [thickness, top, thickness], [x, top / 2, atRake(top / 2)], { rotation: LEAN, segments: 10 });

/** A horizontal rod along x at height y and depth z: rungs and back rails. */
const rod = (id: string, slot: "chair_frame", length: number, thickness: number, y: number, z: number): Shape =>
  cylinder(id, slot, [thickness, length, thickness], [0, y, z], { rotation: [0, 0, HALF_PI], segments: 8 });

/** A rod along z at (x, y): side stretchers. */
const sideRod = (id: string, x: number, thickness: number, y: number): Shape =>
  cylinder(id, "chair_frame", [thickness, 0.36, thickness], [x, y, 0], { rotation: [HALF_PI, 0, 0], segments: 8 });

/**
 * The chiavari: bamboo-turned legs with rings, an H of stretchers, a seat apron under a tied cushion, and a back of three
 * rails with short spindles between the upper two. The tiffany is the same chair in resin.
 */
function chiavari(): Shape[] {
  const legX = 0.19;
  const rings = [0.14, 0.29].flatMap((y, level) =>
    [-legX, legX].flatMap((x, side) => [
      cylinder(`ring_f${side}_${level}`, "chair_frame", [0.036, 0.014, 0.036], [x, y, 0.17], { segments: 10 }),
      cylinder(`ring_b${side}_${level}`, "chair_frame", [0.036, 0.014, 0.036], [x, y, atRake(y)], { segments: 10 }),
    ]),
  );
  const spindles = [-0.12, -0.06, 0, 0.06, 0.12].map((x, index) =>
    cylinder(`spindle_${index}`, "chair_frame", [0.012, 0.12, 0.012], [x, 0.84, atRake(0.84)], { rotation: LEAN, segments: 6 }),
  );
  return [
    ...[-legX, legX].map((x, index) => cylinder(`front_leg_${index}`, "chair_frame", [0.026, 0.44, 0.026], [x, 0.22, 0.17], { segments: 10 })),
    ...[-legX + 0.01, legX - 0.01].map((x, index) => backPost(`back_post_${index}`, "chair_frame", x, 0.028, BACK_TOP_M)),
    ...rings,
    rod("front_rung", "chair_frame", 0.37, 0.016, 0.13, 0.17),
    sideRod("side_rung_l", -legX, 0.016, 0.2),
    sideRod("side_rung_r", legX, 0.016, 0.2),
    roundedBox("apron", "chair_frame", [0.42, 0.035, 0.4], [0, CHAIR_SEAT_HEIGHT_M - 0.03, -0.005], 0.012),
    roundedBox("cushion", "chair_seat", [0.39, 0.045, 0.37], [0, CHAIR_SEAT_HEIGHT_M + 0.012, 0], 0.02),
    ...[0.62, 0.78, BACK_TOP_M - 0.02].map((y, index) => rod(`back_rail_${index}`, "chair_frame", 0.36, 0.022, y, atRake(y))),
    ...spindles,
  ];
}

/** The banquet chair: a deep padded seat and a raked padded back on a slim tubular frame. */
function banquet(): Shape[] {
  const legs: Array<[number, number]> = [[-0.19, 0.18], [0.19, 0.18], [-0.19, -0.17], [0.19, -0.17]];
  return [
    ...legs.map(([x, z], index) => cylinder(`leg_${index}`, "chair_frame", [0.022, 0.43, 0.022], [x, 0.215, z], { segments: 10 })),
    ...[-0.19, 0.19].map((x, index) => backPost(`back_post_${index}`, "chair_frame", x, 0.02, BACK_TOP_M - 0.02)),
    sideRod("side_rail_l", -0.19, 0.018, 0.4),
    sideRod("side_rail_r", 0.19, 0.018, 0.4),
    roundedBox("seat", "chair_seat", [0.44, 0.08, 0.43], [0, CHAIR_SEAT_HEIGHT_M - 0.005, 0], 0.035),
    roundedBox("back", "chair_back", [0.42, 0.4, 0.065], [0, 0.71, atRake(0.71) - 0.01], 0.03, { rotation: LEAN }),
  ];
}

/** The cross-back: square wood legs and aprons, an X between two back rails, and a linen seat pad. */
function crossBack(): Shape[] {
  const xLegs: Array<[number, number]> = [[-0.19, 0.18], [0.19, 0.18]];
  const crossLength = Math.hypot(0.34, 0.3);
  const crossAngle = Math.atan2(0.3, 0.34);
  const crossY = 0.69;
  return [
    ...xLegs.map(([x, z], index) => box(`front_leg_${index}`, "chair_frame", [0.042, 0.44, 0.042], [x, 0.22, z])),
    ...[-0.185, 0.185].map((x, index) => box(`back_post_${index}`, "chair_frame", [0.045, BACK_TOP_M, 0.045], [x, BACK_TOP_M / 2, atRake(BACK_TOP_M / 2)], { rotation: LEAN })),
    roundedBox("apron", "chair_frame", [0.42, 0.06, 0.4], [0, CHAIR_SEAT_HEIGHT_M - 0.045, 0], 0.008),
    box("front_stretcher", "chair_frame", [0.36, 0.025, 0.025], [0, 0.12, 0.18]),
    roundedBox("pad", "chair_seat", [0.4, 0.035, 0.38], [0, CHAIR_SEAT_HEIGHT_M + 0.004, 0], 0.016),
    roundedBox("top_rail", "chair_frame", [0.4, 0.065, 0.028], [0, BACK_TOP_M - 0.04, atRake(BACK_TOP_M - 0.04)], 0.01, { rotation: LEAN }),
    box("low_rail", "chair_frame", [0.36, 0.04, 0.024], [0, 0.52, atRake(0.52)], { rotation: LEAN }),
    box("cross_a", "chair_frame", [crossLength, 0.032, 0.022], [0, crossY, atRake(crossY)], { rotation: [-RAKE, 0, crossAngle] }),
    box("cross_b", "chair_frame", [crossLength, 0.032, 0.022], [0, crossY, atRake(crossY)], { rotation: [-RAKE, 0, -crossAngle] }),
  ];
}

/** The ghost chair: clear acrylic, tapered legs, a rounded seat and a Louis medallion back on two short stems. */
function ghost(): Shape[] {
  const legs: Array<[number, number]> = [[-0.18, 0.17], [0.18, 0.17], [-0.18, -0.16], [0.18, -0.16]];
  return [
    ...legs.map(([x, z], index) => cylinder(`leg_${index}`, "chair_frame", [0.034, 0.44, 0.034], [x, 0.22, z], { segments: 12 })),
    roundedBox("seat", "chair_seat", [0.44, 0.04, 0.42], [0, CHAIR_SEAT_HEIGHT_M - 0.01, 0], 0.018),
    ...[-0.12, 0.12].map((x, index) => box(`stem_${index}`, "chair_back", [0.03, 0.12, 0.025], [x, 0.53, atRake(0.53)], { rotation: LEAN })),
    ellipsoid("medallion", "chair_back", [0.4, 0.4, 0.03], [0, 0.75, atRake(0.75)]),
  ];
}

/** A fitted spandex cover: a skirt from the floor to the seat and a sleeve over the back, soft at every edge. */
function covered(): Shape[] {
  return [
    roundedBox("cover_skirt", "chair_cover", [0.47, CHAIR_SEAT_HEIGHT_M + 0.02, 0.46], [0, (CHAIR_SEAT_HEIGHT_M + 0.02) / 2, 0], 0.045),
    roundedBox("cover_back", "chair_cover", [0.45, BACK_TOP_M - CHAIR_SEAT_HEIGHT_M + 0.04, 0.1], [0, 0.7, atRake(0.7)], 0.05, { rotation: LEAN }),
  ];
}

/** A satin band round the back, tied behind in a bow with two tails. */
function sash(style: ChairStyle): Shape[] {
  const height = 0.68;
  const z = atRake(height);
  const depth = style === "covered" ? 0.13 : 0.06;
  const behind = z - depth / 2 - 0.015;
  return [
    roundedBox("sash_band", "sash", [0.47, 0.085, depth], [0, height, z], 0.02, { rotation: LEAN, when: "sash" }),
    ellipsoid("sash_loop_l", "sash", [0.13, 0.075, 0.035], [-0.06, height + 0.005, behind], { when: "sash" }),
    ellipsoid("sash_loop_r", "sash", [0.13, 0.075, 0.035], [0.06, height + 0.005, behind], { when: "sash" }),
    ellipsoid("sash_knot", "sash", [0.04, 0.05, 0.04], [0, height, behind - 0.005], { when: "sash" }),
    box("sash_tail_l", "sash", [0.055, 0.3, 0.008], [-0.03, height - 0.17, behind], { rotation: [0, 0, 0.12], when: "sash" }),
    box("sash_tail_r", "sash", [0.055, 0.26, 0.008], [0.035, height - 0.15, behind], { rotation: [0, 0, -0.1], when: "sash" }),
  ];
}

const STYLES: Record<ChairStyle, () => Shape[]> = { chiavari, tiffany: chiavari, banquet, "cross-back": crossBack, ghost, covered };

export function chairShapes(style: ChairStyle): Shape[] {
  return [...STYLES[style](), ...sash(style)];
}

/** The chair's flags: a sash is the one choice a chair of a style still takes. */
export const CHAIR_PARAMETERS = [flag("sash", "Sash")];
