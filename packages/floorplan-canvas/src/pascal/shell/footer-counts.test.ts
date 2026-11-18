import { describe, expect, it } from "vitest";
import { FLOORPLAN_SCENE_FORMAT, type FloorplanSceneDocument, type PrismFloorplanSeatingGuest } from "@prism/types";
import { footerCounts, roomSize } from "./footer-counts";

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

describe("roomSize", () => {
  it("measures the visible walls, and has no size without walls", () => {
    const room = scene([
      { id: "w1", type: "wall", start: [0, 0], end: [36, 0] },
      { id: "w2", type: "wall", start: [36, 0], end: [36, 24.25] },
      { id: "w3", type: "wall", start: [0, 0], end: [90, 0], visible: false },
    ]);
    expect(roomSize(room)).toEqual({ width: 36, depth: 24.25 });
    expect(roomSize(scene([]))).toBeNull();
  });
});
