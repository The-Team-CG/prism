import { describe, expect, it } from "vitest";
import { roomWalls, sceneWith, tablePiece } from "@/features/floorplan/scene-fixture";
import { anchorFromRoomPoint, objectAtAnchor, readReviewRoom } from "./floorplan-annotation-geometry";

const plan = sceneWith([
  ...roomWalls(20, 10),
  tablePiece("floor-table", { x: 4, y: 3, width: 4, depth: 4, shape: "round", label: "Table 1" }),
  tablePiece("stage", { x: 4, y: 4, width: 2, depth: 2, label: "Stage" }),
  tablePiece("hidden-table", { x: 15, y: 5, width: 4, depth: 4, visible: false }),
]);

describe("readReviewRoom", () => {
  it("draws the submitted scene's room and its visible pieces, leaving hidden ones out", () => {
    const room = readReviewRoom({ scene: plan });

    expect(room?.room).toEqual({ minX: 0, minY: 0, width: 20, depth: 10 });
    expect(room?.pieces.map((piece) => piece.name)).toEqual(["Table 1", "Stage"]);
  });

  it("has no drawn room for a snapshot without a scene, or with a scene that has no walls", () => {
    expect(readReviewRoom({ objects: [{ id: "legacy", x: 1, y: 1, w: 2, h: 2 }] })).toBeNull();
    expect(readReviewRoom({ scene: sceneWith([tablePiece("t", { x: 1, y: 1, width: 1, depth: 1 })]) })).toBeNull();
    expect(readReviewRoom(null)).toBeNull();
  });
});

describe("annotation anchors", () => {
  const room = readReviewRoom({ scene: plan });
  if (!room) throw new Error("the fixture plan has a room");

  it("turns a point in plan metres into a 0 to 1 anchor and clamps points outside the room", () => {
    expect(anchorFromRoomPoint(room, 10, 5)).toEqual({ x: 0.5, y: 0.5 });
    expect(anchorFromRoomPoint(room, -3, 99)).toEqual({ x: 0, y: 1 });
  });

  it("pins to the piece under the point, and to nothing on open floor", () => {
    expect(objectAtAnchor(room, { x: 4 / 20, y: 4 / 10 })?.id).toBe("stage");
    expect(objectAtAnchor(room, { x: 2.5 / 20, y: 2.5 / 10 })?.id).toBe("floor-table");
    expect(objectAtAnchor(room, { x: 15 / 20, y: 8 / 10 })).toBeNull();
  });

  it("does not pin to the corner of a round table's box, which is outside the table", () => {
    const corner = { x: (4 - 1.9) / 20, y: (3 - 1.9) / 10 };
    expect(objectAtAnchor(room, corner)).toBeNull();
  });

  it("pins to a U-shape's runs, and not to the open floor inside the U", () => {
    const withU = readReviewRoom({
      scene: sceneWith([...roomWalls(20, 10), { ...tablePiece("u", { x: 10, y: 5, width: 6, depth: 5 }), shape: "u-shape", seats: 18 }]),
    });
    if (!withU) throw new Error("the fixture plan has a room");
    expect(objectAtAnchor(withU, { x: 10 / 20, y: (5 - 2.2) / 10 })?.id).toBe("u");
    expect(objectAtAnchor(withU, { x: 10 / 20, y: 5 / 10 })).toBeNull();
  });

  it("follows a rotated piece's box, turned by its rotation", () => {
    const rotated = readReviewRoom({
      scene: sceneWith([...roomWalls(20, 10), tablePiece("bar", { x: 10, y: 5, width: 4, depth: 0.4, rotation: Math.PI / 6 })]),
    });
    if (!rotated) throw new Error("the fixture plan has a room");
    // A point 1.8 m along the piece's long side at 30 degrees: on the piece once turned, off it when unturned.
    const alongLongSide = { x: (10 + 1.8 * Math.cos(Math.PI / 6)) / 20, y: (5 - 1.8 * Math.sin(Math.PI / 6)) / 10 };
    expect(objectAtAnchor(rotated, alongLongSide)?.id).toBe("bar");
    const unturned = readReviewRoom({ scene: sceneWith([...roomWalls(20, 10), tablePiece("bar", { x: 10, y: 5, width: 4, depth: 0.4 })]) });
    if (!unturned) throw new Error("the fixture plan has a room");
    expect(objectAtAnchor(unturned, alongLongSide)).toBeNull();
  });
});
