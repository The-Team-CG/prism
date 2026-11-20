import { describe, expect, it } from "vitest";
import { pullSheet } from "./pull-sheet.js";
import { sceneWith } from "./__fixtures__/scenes.js";

const piece = (id: string, type: string, fields: Record<string, unknown>) => ({ id, type, parentId: "level_1", position: [0, 0, 0], rotation: 0, width: 1, depth: 1, ...fields });
const table = (id: string, fields: Record<string, unknown>) => piece(id, "prism-table", { shape: "round", guestIds: [], ...fields });

describe("pullSheet", () => {
  it("counts what a dressed plan needs, adding identical things into one line", () => {
    const dressed = { seats: 8, width: 1.8, depth: 1.8, chairStyle: "chiavari", linen: "ivory", sash: "gold", centerpiece: "tall floral" };
    const scene = sceneWith([
      table("prism-table_a", { ...dressed, number: 1 }),
      table("prism-table_b", { ...dressed, number: 2 }),
      table("prism-table_hidden", { ...dressed, visible: false }),
      table("prism-table_u", { shape: "u-shape", width: 6, depth: 5, seats: 18, chairStyle: "banquet", linen: "white" }),
      piece("prism-seating-block_a", "prism-seating-block", { style: "ceremony", rows: 8, columns: 6, aisle: 1.5, width: 4.5, depth: 7.2, chairStyle: "chiavari" }),
      piece("prism-dance-floor_a", "prism-dance-floor", { width: 6, depth: 6, finish: "checker" }),
      piece("prism-bar_a", "prism-bar", { shape: "straight", width: 4, depth: 0.8, stools: 6 }),
      piece("prism-stage_a", "prism-stage", { variant: "stage", width: 8, depth: 4, heightM: 0.8, steps: true }),
      piece("prism-zone_a", "prism-zone", { label: "Catering prep", width: 6, depth: 4 }),
    ]);
    const lines = Object.fromEntries(pullSheet(scene).map((line) => [line.item, line.quantity]));
    expect(lines).toMatchObject({
      "Round table 1.8 m": 2,
      "Chiavari chairs": 16 + 48,
      "Banquet chairs": 18,
      "Gold sashes": 16,
      "Ivory linen, round 1.8 m, to the floor": 2,
      "White linen, banquet run, fitted": 3,
      "Centerpiece: tall floral": 2,
      "Table number stands": 2,
      "Aisle runner": 8.2,
      "Checker dance floor": 36,
      "Bar stools": 6,
      "Stage deck 8 × 4 m, 0.8 m high": 1,
      "Stage steps with handrails": 1,
    });
    expect(Object.keys(lines).some((item) => item.includes("Catering prep"))).toBe(false);
    expect(pullSheet(scene)[0]?.group).toBe("Tables");
  });
});
