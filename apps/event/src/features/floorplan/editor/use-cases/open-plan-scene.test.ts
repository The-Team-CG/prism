import { describe, expect, it } from "vitest";
import type { FloorPlanCanvasObject, FloorplanSceneDocument } from "@prism/types";
import { openPlanScene } from "./open-plan-scene";

const table: FloorPlanCanvasObject = {
  id: "round-banquet_a",
  name: "Round Banquet (10pax)",
  kind: "ellipse",
  category: "furniture",
  x: 2,
  y: 3,
  w: 1.8,
  h: 1.8,
  rotation: 0,
  fill: "#FFF4EC",
  stroke: "#9060A0",
  strokeWidth: 0.04,
  seats: 10,
  assignedGuestIds: ["g1"],
  locked: false,
  hidden: false,
};

const stored: FloorplanSceneDocument = {
  format: "pascal-v1",
  pascalVersion: "1.1.6",
  nodes: { site_1: { id: "site_1", type: "site", parentId: null, visible: true } },
  rootNodeIds: ["site_1"],
};

describe("openPlanScene", () => {
  it("opens the stored scene as it is", () => {
    expect(openPlanScene({ scene: stored, name: "Ballroom", widthM: 20, heightM: 15, objects: [table] }, "1.1.6")).toEqual({ scene: stored, converted: false });
  });

  it("converts a plan that has only legacy objects, and says so", () => {
    const opened = openPlanScene({ scene: null, name: "Ballroom", widthM: 20, heightM: 15, objects: [table] }, "1.1.6");

    expect(opened.converted).toBe(true);
    expect(opened.scene).toMatchObject({ format: "pascal-v1", pascalVersion: "1.1.6" });
    expect(Object.values(opened.scene.nodes)).toContainEqual(expect.objectContaining({ type: "prism-table", guestIds: ["g1"] }));
  });
});
