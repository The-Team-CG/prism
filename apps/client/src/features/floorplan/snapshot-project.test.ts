import { describe, expect, it } from "vitest";
import { layoutFromSnapshot } from "./snapshot-project";
import { sceneWith, roomWalls } from "./scene-fixture";

const snapshot = { id: "plan_1", name: "Approved plan", venue: "Hall A", width: 24, height: 12, gridSize: 1, pax: 50 };

describe("snapshot layout", () => {
  it("reads a saved layout as its Pascal scene, or as no scene when the plan has none", () => {
    const scene = sceneWith(roomWalls(10, 6));
    expect(layoutFromSnapshot({ ...snapshot, scene })).toEqual({ id: "plan_1", name: "Approved plan", venue: "Hall A", scene });
    expect(layoutFromSnapshot({ ...snapshot, scene: null }).scene).toBeNull();
    expect(layoutFromSnapshot(snapshot).scene).toBeNull();
  });
});
