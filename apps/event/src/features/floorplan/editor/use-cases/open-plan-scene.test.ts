import { describe, expect, it } from "vitest";
import type { FloorPlanCanvasObject, FloorPlanGuest, FloorplanSceneDocument, PrismFloorplanSeatingGuest } from "@prism/types";
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
  assignedGuestIds: ["g1", "g2"],
  locked: false,
  hidden: false,
};

const stored: FloorplanSceneDocument = {
  format: "pascal-v1",
  pascalVersion: "1.1.6",
  nodes: { site_1: { id: "site_1", type: "site", parentId: null, visible: true } },
  rootNodeIds: ["site_1"],
};

const legacyGuests: FloorPlanGuest[] = [
  { id: "g1", name: "Ana Reyes", rsvp: "confirmed" },
  { id: "g2", name: "Someone Unlisted", rsvp: "confirmed" },
];
const roster: PrismFloorplanSeatingGuest[] = [{ id: "roster_ana", name: "Ana Reyes", group: "Family", rsvp: "confirmed", dietary: null }];
const legacyPlan = { scene: null, name: "Ballroom", widthM: 20, heightM: 15, objects: [table], guests: legacyGuests };

describe("openPlanScene", () => {
  it("opens the stored scene as it is, with nothing to match", () => {
    expect(openPlanScene({ ...legacyPlan, scene: stored }, "1.1.6", roster)).toEqual({ scene: stored, converted: false, unmatchedSeats: 0 });
  });

  it("converts a legacy plan, seating each legacy guest as the roster guest of the same name and counting the rest", () => {
    const opened = openPlanScene(legacyPlan, "1.1.6", roster);

    expect(opened).toMatchObject({ converted: true, unmatchedSeats: 1, scene: { format: "pascal-v1", pascalVersion: "1.1.6" } });
    expect(Object.values(opened.scene.nodes)).toContainEqual(expect.objectContaining({ type: "prism-table", guestIds: ["roster_ana"] }));
  });
});
