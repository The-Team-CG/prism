import { describe, expect, it } from "vitest";
import type { FloorplanSceneDocument } from "@prism/types";
import { buildSeatingList, seatingListHtml } from "./seating-list";

function table(id: string, fields: Record<string, unknown>): FloorplanSceneDocument["nodes"][string] {
  return { id, type: "prism-table", parentId: "level_1", visible: true, shape: "round", position: [0, 0, 0], rotation: 0, width: 2, depth: 2, seats: 2, guestIds: [], supplierIds: [], locked: false, ...fields } as unknown as FloorplanSceneDocument["nodes"][string];
}

function sceneWith(tables: FloorplanSceneDocument["nodes"][string][]): FloorplanSceneDocument {
  const nodes: FloorplanSceneDocument["nodes"] = {
    site_1: { id: "site_1", type: "site", parentId: null, visible: true, children: [] },
  } as FloorplanSceneDocument["nodes"];
  for (const node of tables) nodes[node.id] = node;
  return { format: "pascal-v1", pascalVersion: "1.1.6", nodes, rootNodeIds: ["site_1"] } as FloorplanSceneDocument;
}

const guests = [
  { id: "g-ana", name: "Ana Reyes", group: null, rsvp: "confirmed" as const, dietary: null },
  { id: "g-ben", name: "Ben Cruz", group: null, rsvp: "pending" as const, dietary: null },
  { id: "g-dee", name: "Dee Lim", group: null, rsvp: "declined" as const, dietary: null },
];

describe("buildSeatingList", () => {
  it("lists each visible table's guests, numbered tables first, with unseated guests and no declined guests", () => {
    const scene = sceneWith([
      table("t-2", { number: 2, label: "", guestIds: ["g-ben"], seats: 4 }),
      table("t-10", { number: 10, label: "", guestIds: ["g-ana"], seats: 4 }),
      table("t-hidden", { number: 3, label: "", guestIds: ["g-dee"], seats: 4, visible: false }),
    ]);

    const list = buildSeatingList(scene, guests);

    expect(list.rows.map((row) => row.table)).toEqual(["T2", "T10"]);
    expect(list.rows[1]).toEqual({ table: "T10", seats: 4, guests: ["Ana Reyes"] });
    expect(list.unseated).toEqual([]);
    expect(list.totalSeated).toBe(2);
  });

  it("escapes names in the printable page", () => {
    const scene = sceneWith([table("t-1", { number: 1, label: "", guestIds: ["g-ana"], seats: 2 })]);
    const html = seatingListHtml("Gala <script>", buildSeatingList(scene, [{ ...guests[0], name: "<b>Ana</b>" }]));
    expect(html).toContain("&lt;b&gt;Ana&lt;/b&gt;");
    expect(html).not.toContain("<script>");
  });
});
