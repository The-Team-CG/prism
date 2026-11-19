import type { FloorPlanCanvasObject } from "@prism/types";

type LegacyFields = Partial<FloorPlanCanvasObject> & Pick<FloorPlanCanvasObject, "id" | "name" | "kind" | "category">;

/** A legacy editor object with the asset library's defaults for the fields a test does not name. */
export function legacyObject(fields: LegacyFields): FloorPlanCanvasObject {
  return {
    x: 0,
    y: 0,
    w: 1,
    h: 1,
    rotation: 0,
    fill: "#FFF4EC",
    stroke: "#9060A0",
    strokeWidth: 0.04,
    locked: false,
    hidden: false,
    ...fields,
  };
}

/** Objects as the legacy editor's asset library creates them, one per mapping rule. */
export const legacyAssets = {
  roundBanquet: legacyObject({ id: "round-banquet_a", name: "Round Banquet (10pax)", kind: "ellipse", category: "furniture", x: 2, y: 3, w: 1.8, h: 1.8, seats: 10, label: "T12", assignedGuestIds: ["g1"] }),
  cocktail: legacyObject({ id: "cocktail_a", name: "Cocktail High-Top", kind: "ellipse", category: "furniture", w: 0.7, h: 0.7 }),
  vipTable: legacyObject({ id: "vip-table_a", name: "VIP Table", kind: "rect", category: "furniture", x: 5, y: 5, w: 2.8, h: 1, seats: 10, rotation: Math.PI / 2 }),
  chair: legacyObject({ id: "chair_a", name: "Chair", kind: "rect", category: "furniture", w: 0.45, h: 0.45, locked: true, hidden: true }),
  buffet: legacyObject({ id: "buffet_a", name: "Buffet Table", kind: "rect", category: "furniture", w: 3, h: 0.8, assignedSupplierIds: ["s1"] }),
  stage: legacyObject({ id: "stage_a", name: "Stage", kind: "rect", category: "stage", w: 6, h: 3 }),
  ledWall: legacyObject({ id: "led-wall_a", name: "LED Wall", kind: "rect", category: "stage", w: 5, h: 0.4 }),
  registrationDesk: legacyObject({ id: "reg-desk_a", name: "Registration Desk", kind: "rect", category: "registration", w: 2, h: 0.8 }),
  booth: legacyObject({ id: "booth_a", name: "Exhibit Booth", kind: "rect", category: "registration", w: 3, h: 3 }),
  photoWall: legacyObject({ id: "photo-wall_a", name: "Photo Wall", kind: "rect", category: "registration", w: 3, h: 0.3 }),
  fireExtinguisher: legacyObject({ id: "fire-ext_a", name: "Fire Extinguisher", kind: "ellipse", category: "safety", w: 0.3, h: 0.3 }),
  wall: legacyObject({ id: "wall_a", name: "Wall", kind: "rect", category: "architecture", x: 0, y: 0, w: 4, h: 0.2 }),
  pillar: legacyObject({ id: "pillar_a", name: "Pillar", kind: "rect", category: "architecture", x: 1, y: 1, w: 0.6, h: 0.6 }),
  door: legacyObject({ id: "door_a", name: "Door", kind: "rect", category: "architecture", w: 1, h: 0.15 }),
  line: legacyObject({ id: "draw_1", name: "Line", kind: "line", category: "architecture", w: 3, h: 0.01, label: "Cable run" }),
  labelledRect: legacyObject({ id: "draw_2", name: "Mystery", kind: "rect", category: "registration", w: 0.01, h: 0, label: "Sign here" }),
} satisfies Record<string, FloorPlanCanvasObject>;
