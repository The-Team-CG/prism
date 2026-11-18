import { describe, expect, it } from "vitest";
import { FLOORPLAN_SCENE_FORMAT, type FloorplanSceneDocument, type PrismFloorplanSeatingGuest } from "@prism/types";
import { footerCounts } from "./footer-counts";

const guest = (id: string, rsvp: PrismFloorplanSeatingGuest["rsvp"] = "confirmed"): PrismFloorplanSeatingGuest => ({
  id,
  name: id,
  group: null,
  rsvp,
  dietary: null,
});

function scene(nodes: Array<Record<string, unknown> & { id: string; type: string }>): FloorplanSceneDocument {
  return {
    format: FLOORPLAN_SCENE_FORMAT,
    pascalVersion: "1.1.6",
    rootNodeIds: ["level"],
    nodes: Object.fromEntries(
      [{ id: "level", type: "level", parentId: null }, ...nodes].map((node) => [node.id, { parentId: "level", visible: true, ...node }]),
    ) as FloorplanSceneDocument["nodes"],
  };
}

describe("footerCounts", () => {
  it("counts guests who have not declined, seats in the room, and each seated guest once", () => {
    const room = scene([
      { id: "t1", type: "prism-table", seats: 8, guestIds: ["a", "b"] },
      { id: "t2", type: "prism-table", seats: 6, guestIds: ["b", "c"] },
      { id: "block", type: "prism-seating-block", rows: 2, columns: 5 },
    ]);
    expect(footerCounts(room, [guest("a"), guest("b", "pending"), guest("c"), guest("d", "declined")], 120)).toEqual({
      guests: 3,
      seats: 24,
      seated: 3,
    });
  });

  it("falls back to the event's guest count when the roster is empty", () => {
    expect(footerCounts(scene([]), [], 120)).toEqual({ guests: 120, seats: 0, seated: 0 });
  });

  it("does not count guests at a hidden table", () => {
    const room = scene([{ id: "t1", type: "prism-table", seats: 8, guestIds: ["a"], visible: false }]);
    expect(footerCounts(room, [guest("a")], 0)).toEqual({ guests: 1, seats: 0, seated: 0 });
  });
});
