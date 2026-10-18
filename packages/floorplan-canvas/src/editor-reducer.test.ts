import { describe, expect, it } from "vitest";
import { initialState } from "./store";
import { reducer } from "./editor-reducer";
import type { CanvasObject, Guest, Project } from "./types";

const project: Project = {
  id: "event-1",
  name: "Reception",
  venue: "Hall",
  widthM: 20,
  heightM: 12,
  pax: 80,
  objects: [],
  guests: [],
  suppliers: [],
  updatedAt: 0,
  createdAt: 0,
};

describe("floorplan editor project history", () => {
  it("applies layout size changes as undoable project edits", () => {
    const start = initialState(project);
    const changed = reducer(start, { type: "UPDATE_PROJECT", patch: { widthM: 24 } });

    expect(changed.project.widthM).toBe(24);
    expect(reducer(changed, { type: "UNDO" }).project.widthM).toBe(20);
    expect(reducer(reducer(changed, { type: "UNDO" }), { type: "REDO" }).project.widthM).toBe(24);
  });
});

function tableObject(overrides: Partial<CanvasObject> & { id: string }): CanvasObject {
  return {
    name: "Round Table",
    kind: "ellipse",
    category: "furniture",
    x: 0,
    y: 0,
    w: 1.4,
    h: 1.4,
    rotation: 0,
    fill: "#fff",
    stroke: "#000",
    strokeWidth: 1,
    seats: 2,
    assignedGuestIds: [],
    locked: false,
    hidden: false,
    ...overrides,
  };
}

describe("table assignment eligibility in the floorplan editor", () => {
  const guests: Guest[] = [
    { id: "g-ana", name: "Ana", rsvp: "confirmed" },
    { id: "g-ben", name: "Ben", rsvp: "pending" },
    { id: "g-cy", name: "Cy", rsvp: "confirmed" },
    { id: "g-dee", name: "Dee", rsvp: "declined" },
  ];
  const withLayout = (objects: CanvasObject[]) =>
    initialState({ ...project, objects, guests });

  it("seats eligible guests and moves a guest between tables without duplicating seats", () => {
    const start = withLayout([
      tableObject({ id: "t1" }),
      tableObject({ id: "t2" }),
    ]);
    const seated = reducer(start, { type: "ASSIGN_GUEST", guestId: "g-ana", objectId: "t1" });
    expect(seated.project.objects.find((o) => o.id === "t1")?.assignedGuestIds).toEqual(["g-ana"]);

    const moved = reducer(seated, { type: "ASSIGN_GUEST", guestId: "g-ana", objectId: "t2" });
    expect(moved.project.objects.map((o) => o.assignedGuestIds)).toEqual([[], ["g-ana"]]);
    expect(reducer(moved, { type: "UNDO" }).project.objects.find((o) => o.id === "t1")?.assignedGuestIds).toEqual(["g-ana"]);
  });

  it.each([
    {
      case: "declined guest",
      objects: [tableObject({ id: "t1" })],
      guestId: "g-dee",
      objectId: "t1",
      reason: "guest-declined",
    },
    {
      case: "unknown guest",
      objects: [tableObject({ id: "t1" })],
      guestId: "g-nobody",
      objectId: "t1",
      reason: "unknown-guest",
    },
    {
      case: "non-furniture object such as a stage",
      objects: [tableObject({ id: "stage", category: "stage", kind: "rect", seats: 4 })],
      guestId: "g-ana",
      objectId: "stage",
      reason: "not-a-table",
    },
    {
      case: "table without a seat count",
      objects: [tableObject({ id: "t1", seats: undefined })],
      guestId: "g-ana",
      objectId: "t1",
      reason: "not-a-table",
    },
    {
      case: "hidden table",
      objects: [tableObject({ id: "t1", hidden: true })],
      guestId: "g-ana",
      objectId: "t1",
      reason: "table-hidden",
    },
    {
      case: "table already at capacity",
      objects: [tableObject({ id: "t1", seats: 1, assignedGuestIds: ["g-ben"] })],
      guestId: "g-ana",
      objectId: "t1",
      reason: "table-full",
    },
  ])(
    "keeps the layout unchanged and records the $reason rejection for a $case",
    ({ objects, guestId, objectId, reason }) => {
      const start = withLayout(objects);
      const result = reducer(start, { type: "ASSIGN_GUEST", guestId, objectId });
      expect(result.project).toBe(start.project);
      expect(result.history).toEqual(start.history);
      expect(result.assignmentRejection).toEqual({ guestId, objectId, reason });
    },
  );

  it("clears a recorded rejection on the next eligible assignment or on dismissal", () => {
    const start = withLayout([tableObject({ id: "t1", seats: 1 }), tableObject({ id: "t2" })]);
    const refused = reducer(start, { type: "ASSIGN_GUEST", guestId: "g-dee", objectId: "t1" });
    expect(refused.assignmentRejection?.reason).toBe("guest-declined");

    expect(reducer(refused, { type: "DISMISS_ASSIGNMENT_REJECTION" }).assignmentRejection).toBeNull();

    const seated = reducer(refused, { type: "ASSIGN_GUEST", guestId: "g-ana", objectId: "t2" });
    expect(seated.assignmentRejection).toBeNull();
    expect(seated.project.objects.find((o) => o.id === "t2")?.assignedGuestIds).toEqual(["g-ana"]);
  });

  it("keeps a guest's seat at a full table when reassigning them to that same table", () => {
    const start = withLayout([tableObject({ id: "t1", seats: 1, assignedGuestIds: ["g-ana"] })]);
    const result = reducer(start, { type: "ASSIGN_GUEST", guestId: "g-ana", objectId: "t1" });
    expect(result.project.objects[0].assignedGuestIds).toEqual(["g-ana"]);
  });
});