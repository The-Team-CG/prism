import { describe, expect, it } from "vitest";
import { evaluateTableAssignment, findTableAssignmentRejection, isSeatingListAvailable, newTableAssignments, type TableEligibilityObject } from "./floorplan-table-eligibility";

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
