import { describe, expect, it } from "vitest";
import { tableAssignmentsOf, withoutEventAssignments, withoutSeatedGuests } from "./table-assignments.js";
import { sceneWith, table } from "./__fixtures__/scenes.js";

describe("tableAssignmentsOf", () => {
  it("lists every table with its seats and guests", () => {
    const scene = sceneWith([table("prism-table_a", { seats: 8, guestIds: ["g1", "g2"] }), table("prism-table_b")]);
    expect(tableAssignmentsOf(scene)).toEqual([
      { tableId: "prism-table_a", seats: 8, hidden: false, guestIds: ["g1", "g2"] },
      { tableId: "prism-table_b", seats: 10, hidden: false, guestIds: [] },
    ]);
  });

  it("marks a table hidden when it or its level is hidden", () => {
    expect(tableAssignmentsOf(sceneWith([table("prism-table_a", { visible: false })]))[0]?.hidden).toBe(true);
    expect(tableAssignmentsOf(sceneWith([table("prism-table_a")], { levelVisible: false }))[0]?.hidden).toBe(true);
  });

  it("ignores nodes that are not tables", () => {
    const stage = { id: "prism-stage_a", type: "prism-stage", parentId: "level_1", variant: "stage", position: [0, 0, 0], rotation: 0, width: 6, depth: 3 };
    expect(tableAssignmentsOf(sceneWith([stage]))).toEqual([]);
  });
});

describe("withoutEventAssignments", () => {
  it("empties tables' guests and supplier zones' suppliers, keeping the rest of the layout", () => {
    const zone = { id: "prism-zone_a", type: "prism-zone", parentId: "level_1", variant: "supplier", position: [0, 0, 0], rotation: 0, width: 4, depth: 4, supplierIds: ["sup_1"] };
    const scene = sceneWith([table("prism-table_a", { guestIds: ["g1"] }), zone]);
    const copied = withoutEventAssignments(scene);
    expect(tableAssignmentsOf(copied).map((entry) => entry.guestIds)).toEqual([[]]);
    expect(copied.nodes["prism-zone_a"]).toMatchObject({ supplierIds: [], width: 4 });
    expect(Object.keys(copied.nodes)).toEqual(Object.keys(scene.nodes));
  });
});

describe("withoutSeatedGuests", () => {
  it("empties every table's guests and keeps the rest of the layout", () => {
    const scene = sceneWith([table("prism-table_a", { guestIds: ["g1"] }), table("prism-table_b", { guestIds: ["g2", "g3"] })]);
    const copied = withoutSeatedGuests(scene);
    expect(tableAssignmentsOf(copied).map((table) => table.guestIds)).toEqual([[], []]);
    expect(Object.keys(copied.nodes)).toEqual(Object.keys(scene.nodes));
    expect(copied.rootNodeIds).toEqual(scene.rootNodeIds);
  });
});
