import { describe, expect, it } from "vitest";
import { evaluateTableAssignment, findTableAssignmentRejection, isSeatingListAvailable, newTableAssignments, type TableEligibilityObject } from "./floorplan-table-eligibility";
import { updatePlanSchema } from "./schemas/session-spatial-inputs";

const seatingTable = (overrides: Partial<TableEligibilityObject> = {}): TableEligibilityObject => ({
  id: "t1",
  kind: "ellipse",
  category: "furniture",
  seats: 2,
  hidden: false,
  assignedGuestIds: [],
  ...overrides,
});

const guests = [
  { id: "g-ana", rsvp: "confirmed" },
  { id: "g-ben", rsvp: "pending" },
  { id: "g-dee", rsvp: "declined" },
];

const editorObject = {
  id: "t1",
  name: "Table 1",
  kind: "ellipse",
  category: "furniture",
  x: 1,
  y: 2,
  w: 2,
  h: 2,
  rotation: 0,
  fill: "#fff",
  stroke: "#000",
  strokeWidth: 1,
  seats: 4,
  locked: false,
  hidden: false,
};

describe("table assignment eligibility on saved plans", () => {
  it.each([
    { case: "unknown guest", objects: [seatingTable({ assignedGuestIds: ["g-nobody"] })], reason: "unknown-guest" },
    { case: "declined guest", objects: [seatingTable({ assignedGuestIds: ["g-dee"] })], reason: "guest-declined" },
    {
      case: "guest assigned to a stage object",
      objects: [seatingTable({ category: "stage", assignedGuestIds: ["g-ana"] })],
      reason: "not-a-table",
    },
    { case: "hidden table", objects: [seatingTable({ hidden: true, assignedGuestIds: ["g-ana"] })], reason: "table-hidden" },
    {
      case: "more guests than seats",
      objects: [seatingTable({ seats: 1, assignedGuestIds: ["g-ana", "g-ben"] })],
      reason: "table-full",
    },
    {
      case: "guest listed at two tables",
      objects: [
        seatingTable({ id: "t1", assignedGuestIds: ["g-ana"] }),
        seatingTable({ id: "t2", assignedGuestIds: ["g-ana"] }),
      ],
      reason: "guest-already-seated",
    },
  ])("rejects a $case with the $reason reason", ({ objects, reason }) => {
    const rejection = findTableAssignmentRejection(objects, guests);
    expect(rejection).toEqual({ guestId: expect.any(String), objectId: "t1", reason });
  });

  it("accepts seated guests that fit within the table's seats", () => {
    expect(findTableAssignmentRejection([seatingTable({ assignedGuestIds: ["g-ana", "g-ben"] })], guests)).toBeNull();
  });

  it("parses plan objects saved without assignment fields and keeps unknown editor fields", () => {
    const parsed = updatePlanSchema.safeParse({
      expectedUpdatedAt: "2026-05-05T00:00:00.000Z",
      objects: [{ ...editorObject, customNote: "keep" }],
      guests: [{ id: "g-ana", name: "Ana", rsvp: "confirmed" }],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.objects?.[0]).toMatchObject({ id: "t1", customNote: "keep" });
  });

  it("rejects kernel-shaped plan objects that carry position and size instead of the editor's x, y, w, h", () => {
    const legacyObject = {
      id: "legacy-table",
      kind: "table",
      position: { x: 1, y: 1 },
      size: { width: 2, height: 2 },
      rotation: 0,
      zIndex: 0,
    };
    const parsed = updatePlanSchema.safeParse({
      expectedUpdatedAt: "2026-05-05T00:00:00.000Z",
      objects: [legacyObject],
    });

    expect(parsed.success).toBe(false);
  });

  it("refuses to parse the same guest listed twice at one table", () => {
    const parsed = updatePlanSchema.safeParse({
      expectedUpdatedAt: "2026-05-05T00:00:00.000Z",
      objects: [{ ...editorObject, assignedGuestIds: ["g-ana", "g-ana"] }],
    });

    expect(parsed.success).toBe(false);
  });

  it("parses an editor-shaped supplier roster", () => {
    const editorSupplier = { id: "s-cater", name: "Mesa Catering", kind: "catering", status: "confirmed", contact: "mesa@example.test" };
    const parsed = updatePlanSchema.safeParse({
      expectedUpdatedAt: "2026-05-05T00:00:00.000Z",
      suppliers: [editorSupplier],
    });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.suppliers?.[0]).toMatchObject({ id: "s-cater", contact: "mesa@example.test" });
  });

  it("refuses an editor supplier with a kind outside the supplier list", () => {
    const parsed = updatePlanSchema.safeParse({
      expectedUpdatedAt: "2026-05-05T00:00:00.000Z",
      suppliers: [{ id: "s-x", name: "Unknown", kind: "fireworks", status: "booked" }],
    });

    expect(parsed.success).toBe(false);
  });
});

describe("seating list size limit", () => {
  const table: TableEligibilityObject = { id: "t1", kind: "ellipse", category: "furniture", seats: 10, assignedGuestIds: [] };
  const guests = [{ id: "g1", rsvp: "confirmed" }];

  it("is open only for private events below 200 guests (or with an unset count), and closed otherwise", () => {
    const sizes = [undefined, 0, 1, 199, 200, 450].map((pax) => isSeatingListAvailable(pax, "private"));
    expect(sizes).toEqual([true, true, true, true, false, false]);
    expect([undefined, 0, 199].map((pax) => isSeatingListAvailable(pax, "public"))).toEqual([false, false, false]);
  });

  it("refuses to seat a guest at a large or public event before any other check", () => {
    const seat = (pax: number | undefined, eventPrivacy: "private" | "public") => evaluateTableAssignment({ objects: [table], guests, guestId: "g1", objectId: "t1", event: { pax, eventPrivacy } });
    expect(seat(199, "private")).toEqual({ eligible: true });
    expect(seat(200, "private")).toEqual({ eligible: false, reason: "event-too-large" });
    expect(seat(50, "public")).toEqual({ eligible: false, reason: "event-public" });
    expect(evaluateTableAssignment({ objects: [table], guests, guestId: "ghost", objectId: "t1", event: { pax: 500, eventPrivacy: "private" } })).toEqual({ eligible: false, reason: "event-too-large" });
  });

  it("lists only the seats a save adds, so seats made before the limit stay", () => {
    const seated = { ...table, assignedGuestIds: ["g1"] };
    const other = { ...table, id: "t2", assignedGuestIds: [] };

    expect(newTableAssignments([seated, other], [seated, other])).toEqual([]);
    expect(newTableAssignments([seated, other], [{ ...seated, assignedGuestIds: [] }, { ...other, assignedGuestIds: ["g1"] }])).toEqual([{ guestId: "g1", objectId: "t2" }]);
    expect(newTableAssignments([], [seated])).toEqual([{ guestId: "g1", objectId: "t1" }]);
  });
});
