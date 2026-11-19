import { describe, expect, it } from "vitest";
import { nextTableNumber, sceneSeatCount, zoneSupplierIds } from "./scene-capacity.js";
import { sceneWith, table } from "./__fixtures__/scenes.js";

const block = (id: string, rows: number, columns: number, visible = true) => ({
  id, type: "prism-seating-block", parentId: "level_1", visible, style: "theater", position: [5, 0, 5], rotation: 0, width: 6, depth: 4, rows, columns, aisle: 1,
});
const zone = (id: string, supplierIds: string[]) => ({
  id, type: "prism-zone", parentId: "level_1", label: "BOH", position: [1, 0, 1], rotation: 0, width: 3, depth: 3, supplierIds,
});

describe("scene capacity", () => {
  it("counts seats at visible tables and seating blocks, not hidden ones", () => {
    const scene = sceneWith([table("prism-table_a", { seats: 8 }), table("prism-table_b", { seats: 10, visible: false }), block("prism-seating-block_a", 5, 4), block("prism-seating-block_b", 2, 2, false)]);
    expect(sceneSeatCount(scene)).toBe(28);
  });

  it("numbers the next table one past the highest", () => {
    const numbered = (id: string, number: number) => ({ ...table(id), number });
    expect(nextTableNumber(sceneWith([numbered("prism-table_a", 1), numbered("prism-table_b", 7)]))).toBe(8);
    expect(nextTableNumber(sceneWith([]))).toBe(1);
  });

  it("lists each supplier named on a zone once", () => {
    expect(zoneSupplierIds(sceneWith([zone("prism-zone_a", ["sup_1", "sup_2"]), zone("prism-zone_b", ["sup_2"])]))).toEqual(["sup_1", "sup_2"]);
  });
});
