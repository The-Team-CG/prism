import { afterEach, describe, expect, it, vi } from "vitest";
import type { Project } from "@prism/floorplan-canvas";
import { projectFromSnapshot, type ApiFloorPlanSnapshot } from "./snapshot-project";

const snapshot: ApiFloorPlanSnapshot = {
  id: "plan_1", name: "Approved plan", venue: "Hall A", width: 24, height: 12, gridSize: 1, pax: 50,
  updatedAt: "2026-11-07T00:00:00.000Z",
};

afterEach(() => vi.useRealTimers());

describe("snapshot project", () => {
  it("converts official dimensions and time while preserving canvas geometry and extra saved fields", () => {
    const object: Project["objects"][number] = {
      id: "table_1", name: "Table", kind: "rect", category: "furniture",
      x: 2, y: 3, w: 4, h: 2, rotation: 0, fill: "white", stroke: "black", strokeWidth: 1,
      locked: true, hidden: false, assignedGuestIds: ["guest_1"], venueFixture: true,
    };
    const guest: Project["guests"][number] = { id: "guest_1", name: "Ana", rsvp: "confirmed", group: "Family" };
    const supplier: Project["suppliers"][number] = { id: "supplier_1", name: "Caterer", kind: "catering", status: "booked" };
    expect(projectFromSnapshot({ ...snapshot, objects: [object], guests: [guest], suppliers: [supplier] })).toEqual({
      id: "plan_1", name: "Approved plan", venue: "Hall A", widthM: 24, heightM: 12, pax: 50,
      objects: [object], guests: [guest], suppliers: [supplier],
      createdAt: 1794009600000, updatedAt: 1794009600000,
    });
  });

  it("opens an empty snapshot with the current time when no saved timestamp exists", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-07T00:00:00.000Z"));
    expect(projectFromSnapshot({ ...snapshot, updatedAt: undefined })).toMatchObject({
      objects: [], guests: [], suppliers: [], createdAt: 1794009600000, updatedAt: 1794009600000,
    });
  });

  it("opens plans saved in the older canvas shape that the API still accepts", () => {
    const legacyObject = {
      id: "table_1", kind: "table", position: { x: 2, y: 3 }, size: { width: 4, height: 2 }, rotation: 0, zIndex: 1,
    };
    const project = projectFromSnapshot({ ...snapshot, objects: [legacyObject] } as unknown as ApiFloorPlanSnapshot);
    expect(project.objects).toEqual([legacyObject]);
  });
});
