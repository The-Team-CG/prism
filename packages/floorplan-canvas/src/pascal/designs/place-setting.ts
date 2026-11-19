import { CHAIR_CENTRE_OUTSET_M } from "@prism/floorplan-scene";
import { box, designOf, flag, part, revolve, roundedBox, type EventDesign, type Shape } from "./kit";
import { TABLE_TOP_M } from "./tables";

/**
 * One cover laid at a seat, in the chair's frame (the table is toward +z): a gold charger under a dinner plate with a
 * folded napkin on it, a fork to the left and a knife to the right, a water goblet and a wine glass above the knife.
 * Tables repeat it with instancing at their seat spots, as they do their chairs.
 */
const EDGE_Z = CHAIR_CENTRE_OUTSET_M;
const PLATE_Z = EDGE_Z + 0.2;
const TOP = TABLE_TOP_M + 0.002;

/** A stemmed glass: foot, stem and bowl, revolved. */
function glass(id: string, x: number, z: number, bowl: number, height: number, when?: string): Shape {
  return revolve(
    id,
    "glassware",
    [
      [0, TOP],
      [0.032, TOP],
      [0.032, TOP + 0.004],
      [0.005, TOP + 0.01],
      [0.005, TOP + height * 0.45],
      [bowl * 0.7, TOP + height * 0.55],
      [bowl, TOP + height * 0.8],
      [bowl * 0.92, TOP + height],
    ],
    [x, 0, z],
    { segments: 20, ...(when ? { when } : {}) },
  );
}

function cover(): Shape[] {
  return [
    revolve("charger", "charger", [[0, TOP], [0.15, TOP], [0.155, TOP + 0.008], [0.14, TOP + 0.012], [0, TOP + 0.01]], [0, 0, PLATE_Z], { segments: 40 }),
    revolve("plate", "china", [[0, TOP + 0.013], [0.1, TOP + 0.013], [0.13, TOP + 0.022], [0.125, TOP + 0.025], [0.095, TOP + 0.017], [0, TOP + 0.017]], [0, 0, PLATE_Z], {
      segments: 40,
    }),
    roundedBox("napkin", "napkin", [0.11, 0.022, 0.19], [0, TOP + 0.03, PLATE_Z - 0.01], 0.009),
    box("fork", "cutlery", [0.018, 0.004, 0.19], [-0.185, TOP + 0.003, PLATE_Z]),
    box("knife", "cutlery", [0.016, 0.004, 0.21], [0.185, TOP + 0.003, PLATE_Z]),
    glass("goblet", 0.15, PLATE_Z + 0.17, 0.042, 0.17),
    glass("wine", 0.23, PLATE_Z + 0.11, 0.036, 0.15, "wine_glass"),
  ];
}

export function placeSettingDesign(): EventDesign {
  return {
    recipe: designOf({ name: "Place setting", description: "One cover: charger, plate, napkin, cutlery and glasses.", parameters: [flag("wine_glass", "Wine glass")], parts: [part("cover", "Cover", 1, cover())] }),
    values: { wine_glass: 1 },
  };
}
