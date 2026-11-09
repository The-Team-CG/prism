import { describe, expect, it } from "vitest";
import { anchorFromRoomPoint, objectAtAnchor, readReviewRoom } from "./floorplan-annotation-geometry";

const snapshot = {
  width: 20,
  height: 10,
  objects: [
    { id: "floor-table", label: "Table 1", kind: "ellipse", x: 2, y: 2, w: 4, h: 4 },
    { id: "stage", name: "Stage", kind: "rect", x: 3, y: 3, w: 2, h: 2 },
    { id: "ghost", name: "Hidden", kind: "rect", x: 0, y: 0, w: 20, h: 10, hidden: true },
    { name: "No id", kind: "rect", x: 10, y: 1, w: 2, h: 2 },
    { id: "bad", kind: "rect", x: "left", y: 0, w: 1, h: 1 },
  ],
};

describe("readReviewRoom", () => {
  it("keeps the plan's room size and only the objects that can be drawn", () => {
    const room = readReviewRoom(snapshot);

    expect([room.width, room.height]).toEqual([20, 10]);
    expect(room.objects.map((object) => object.name)).toEqual(["Table 1", "Stage", "No id"]);
  });

  it("draws a submitted plan's canvas objects at their saved box", () => {
    const room = readReviewRoom({
      width: 1200,
      height: 800,
      objects: [
        { id: "coverage-table", name: "Table", kind: "ellipse", category: "furniture", x: 100, y: 100, w: 80, h: 80, rotation: 0, fill: "#FFFFFF", stroke: "#000000", strokeWidth: 1, locked: false, hidden: false },
      ],
    });

    expect(room.objects).toMatchObject([{ id: "coverage-table", name: "Table", kind: "ellipse", x: 100, y: 100, w: 80, h: 80 }]);
  });

  it("falls back to the objects' extent, then to a default room, when the plan carries no size", () => {
    expect(readReviewRoom({ objects: [{ id: "a", x: 1, y: 1, w: 4, h: 2 }] })).toMatchObject({ width: 6, height: 4 });
    expect(readReviewRoom(null)).toMatchObject({ width: 20, height: 12, objects: [] });
    expect(readReviewRoom({ widthM: 8, heightM: 5, objects: [] })).toMatchObject({ width: 8, height: 5 });
  });
});

describe("annotation anchors", () => {
  const room = readReviewRoom(snapshot);

  it("turns a point in metres into a 0 to 1 anchor and clamps points outside the room", () => {
    expect(anchorFromRoomPoint(room, 10, 5)).toEqual({ x: 0.5, y: 0.5 });
    expect(anchorFromRoomPoint(room, -3, 99)).toEqual({ x: 0, y: 1 });
  });

  it("pins to the topmost object under the point, and to nothing in open floor or on an object without an id", () => {
    expect(objectAtAnchor(room, { x: 4 / 20, y: 4 / 10 })?.id).toBe("stage");
    expect(objectAtAnchor(room, { x: 2.5 / 20, y: 2.5 / 10 })?.id).toBe("floor-table");
    expect(objectAtAnchor(room, { x: 15 / 20, y: 8 / 10 })).toBeNull();
    expect(objectAtAnchor(room, { x: 11 / 20, y: 2 / 10 })).toBeNull();
  });
});
