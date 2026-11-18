import { describe, expect, it } from "vitest";
const PASCAL_VERSION = "1.1.6";
import { sceneWith, roomWalls, tablePiece } from "@/features/floorplan/scene-fixture";
import { openingScene } from "./open-preference-scene";

const plan = { name: "Summit preference", widthM: 30, heightM: 20, scene: null, updatedAt: "2026-11-19T00:00:00.000Z" };

describe("openingScene", () => {
  it("opens a preference the client already saved as saved", () => {
    const saved = sceneWith(roomWalls(12, 9));
    expect(openingScene({ ...plan, scene: saved }, sceneWith(roomWalls(40, 30)), PASCAL_VERSION)).toBe(saved);
  });

  it("starts a new preference from the official layout without its seated guests", () => {
    const official = sceneWith([...roomWalls(40, 30), { ...tablePiece("prism-table_a", { x: 5, y: 5, width: 2, depth: 2 }), guestIds: ["guest_ana"] }]);
    const opened = openingScene(plan, official, PASCAL_VERSION);
    expect(opened.nodes["prism-table_a"]).toMatchObject({ guestIds: [] });
    expect(opened.rootNodeIds).toEqual(official.rootNodeIds);
  });

  it("starts from a blank room of the plan's size when there is no official layout", () => {
    const opened = openingScene(plan, null, PASCAL_VERSION);
    expect(opened.format).toBe("pascal-v1");
    expect(Object.values(opened.nodes).filter((node) => node.type === "prism-table")).toEqual([]);
  });
});
