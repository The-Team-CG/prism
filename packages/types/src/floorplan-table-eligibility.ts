import { z } from "zod";

/**
 * Role-neutral table seating eligibility shared by the floorplan editor and the API. A guest may sit
 * at a table only when the guest is known and not declined, the target is a visible seating table
 * with a seat count, and the table still has a free seat once the guest's own existing seat (if any)
 * is discounted.
 */
export const tableAssignmentIneligibleReasonSchema = z.enum([
  "unknown-guest",
  "guest-declined",
  "not-a-table",
  "table-hidden",
  "table-full",
]);
export type TableAssignmentIneligibleReason = z.infer<typeof tableAssignmentIneligibleReasonSchema>;

export type TableAssignmentEligibility =
  | { eligible: true }
  | { eligible: false; reason: TableAssignmentIneligibleReason };

/** Structural subset of a floorplan object that the seating rule reads. */
export interface TableEligibilityObject {
  id: string;
  kind: string;
  category?: string;
  seats?: number;
  hidden?: boolean;
  assignedGuestIds?: string[];
}

/** Structural subset of a guest that the seating rule reads. */
export interface TableEligibilityGuest {
  id: string;
  rsvp?: string;
}

export interface TableAssignmentRejection {
  guestId: string;
  objectId: string;
  reason: TableAssignmentIneligibleReason;
}

export function evaluateTableAssignment(input: {
  objects: readonly TableEligibilityObject[];
  guests: readonly TableEligibilityGuest[];
  guestId: string;
  objectId: string;
}): TableAssignmentEligibility {
  const guest = input.guests.find((g) => g.id === input.guestId);
  if (!guest) return refuse("unknown-guest");
  if (guest.rsvp === "declined") return refuse("guest-declined");

  const target = input.objects.find((o) => o.id === input.objectId);
  if (!target || !isSeatingTable(target)) return refuse("not-a-table");
  if (target.hidden) return refuse("table-hidden");
  if (seatedElsewhereCount(target, input.guestId) >= (target.seats ?? 0)) return refuse("table-full");

  return { eligible: true };
}

function refuse(reason: TableAssignmentIneligibleReason): TableAssignmentEligibility {
  return { eligible: false, reason };
}

function isSeatingTable(target: TableEligibilityObject): boolean {
  return (
    target.category === "furniture" &&
    (target.kind === "rect" || target.kind === "ellipse") &&
    (target.seats ?? 0) > 0
  );
}

function seatedElsewhereCount(target: TableEligibilityObject, guestId: string): number {
  return (target.assignedGuestIds ?? []).filter((gid) => gid !== guestId).length;
}

/** Returns the first seat assignment in a plan that breaks eligibility, or null when every assignment is valid. */
export function findTableAssignmentRejection(
  objects: readonly TableEligibilityObject[],
  guests: readonly TableEligibilityGuest[],
): TableAssignmentRejection | null {
  for (const object of objects) {
    for (const guestId of object.assignedGuestIds ?? []) {
      const eligibility = evaluateTableAssignment({ objects, guests, guestId, objectId: object.id });
      if (!eligibility.eligible) return { guestId, objectId: object.id, reason: eligibility.reason };
    }
  }
  return null;
}
