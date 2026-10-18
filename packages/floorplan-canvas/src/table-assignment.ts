import type { CanvasObject, Guest, TableAssignmentIneligibleReason } from "./types";

export type { TableAssignmentIneligibleReason } from "./types";

/**
 * Role-neutral table assignment eligibility. A guest may sit at a table only when the guest is
 * known and not declined, the target is a visible seating table with a seat count, and the table
 * still has a free seat once the guest's own existing seat (if any) is discounted.
 */
export type TableAssignmentEligibility =
  | { eligible: true }
  | { eligible: false; reason: TableAssignmentIneligibleReason };

export function evaluateTableAssignment(input: {
  objects: CanvasObject[];
  guests: Guest[];
  guestId: string;
  objectId: string;
}): TableAssignmentEligibility {
  const guest = input.guests.find((g) => g.id === input.guestId);
  if (!guest) return { eligible: false, reason: "unknown-guest" };
  if (guest.rsvp === "declined") return { eligible: false, reason: "guest-declined" };

  const target = input.objects.find((o) => o.id === input.objectId);
  const isSeatingTable =
    target !== undefined &&
    target.category === "furniture" &&
    (target.kind === "rect" || target.kind === "ellipse") &&
    (target.seats ?? 0) > 0;
  if (!target || !isSeatingTable) return { eligible: false, reason: "not-a-table" };
  if (target.hidden) return { eligible: false, reason: "table-hidden" };

  const seatedElsewhere = (target.assignedGuestIds ?? []).filter((gid) => gid !== input.guestId).length;
  if (seatedElsewhere >= (target.seats ?? 0)) return { eligible: false, reason: "table-full" };

  return { eligible: true };
}
