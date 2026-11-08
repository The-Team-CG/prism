import type { TableAssignmentIneligibleReason } from "./schemas/floorplan-inputs.js";
import type { PrismEventPrivacy } from "./schemas/event-lifecycle-inputs.js";
export { tableAssignmentIneligibleReasonSchema, type TableAssignmentIneligibleReason } from "./schemas/floorplan-inputs.js";

/** Table assignment and the printable seating list are for events under this many guests (catalog FR-84). */
export const SEATING_LIST_MAX_GUESTS = 200;

/**
 * Table assignment and the seating list need a private event under SEATING_LIST_MAX_GUESTS (catalog FR-84).
 * An unset guest count (0) does not block seating. Returns the refusal reason, or null when seating is open.
 */
export function seatingUnavailableReason(
  pax: number | undefined | null,
  eventPrivacy: PrismEventPrivacy | undefined,
): "event-public" | "event-too-large" | null {
  // An unknown privacy never opens seating: only an event PMCM marked private can seat guests.
  if (eventPrivacy !== "private") return "event-public";
  return pax && pax >= SEATING_LIST_MAX_GUESTS ? "event-too-large" : null;
}

export function isSeatingListAvailable(pax: number | undefined | null, eventPrivacy: PrismEventPrivacy | undefined): boolean {
  return seatingUnavailableReason(pax, eventPrivacy) === null;
}

/**
 * Role-neutral table seating eligibility shared by the floorplan editor and the API. A guest may sit
 * at a table only when the guest is known and not declined, the target is a visible seating table
 * with a seat count, and the table still has a free seat once the guest's own existing seat (if any)
 * is discounted.
 */
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

export interface SeatingEvent {
  pax?: number | null;
  eventPrivacy?: PrismEventPrivacy;
}

export function evaluateTableAssignment(input: {
  objects: readonly TableEligibilityObject[];
  guests: readonly TableEligibilityGuest[];
  guestId: string;
  objectId: string;
  /**
   * The event's guest count and privacy. Omitted by the whole-plan check, which leaves the event gate to the
   * new-assignment guard so seats made before the event became ineligible are not reported as broken.
   */
  event?: SeatingEvent;
}): TableAssignmentEligibility {
  if (input.event) {
    const unavailable = seatingUnavailableReason(input.event.pax, input.event.eventPrivacy);
    if (unavailable) return refuse(unavailable);
  }
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

/**
 * Returns the first seat assignment in a plan that breaks eligibility, or null when every assignment is
 * valid. A guest may appear at one table only: `evaluateTableAssignment` treats a move as eligible (the
 * editor strips the old seat), so the whole-plan check is where a guest listed at two tables is caught.
 */
export function findTableAssignmentRejection(
  objects: readonly TableEligibilityObject[],
  guests: readonly TableEligibilityGuest[],
): TableAssignmentRejection | null {
  for (const object of objects) {
    for (const guestId of object.assignedGuestIds ?? []) {
      const eligibility = evaluateTableAssignment({ objects, guests, guestId, objectId: object.id });
      if (!eligibility.eligible) return { guestId, objectId: object.id, reason: eligibility.reason };
      if (isSeatedAtAnotherTable(objects, object.id, guestId)) {
        return { guestId, objectId: object.id, reason: "guest-already-seated" };
      }
    }
  }
  return null;
}

function isSeatedAtAnotherTable(objects: readonly TableEligibilityObject[], objectId: string, guestId: string): boolean {
  return objects.some((other) => other.id !== objectId && (other.assignedGuestIds ?? []).includes(guestId));
}

/**
 * Seat assignments present in `next` that were not in `previous`. A plan that already seated guests before the size
 * limit applied keeps its seats; only additions are refused for a large event.
 */
export function newTableAssignments(
  previous: readonly TableEligibilityObject[],
  next: readonly TableEligibilityObject[],
): Array<{ guestId: string; objectId: string }> {
  const before = new Set(previous.flatMap((object) => (object.assignedGuestIds ?? []).map((guestId) => object.id + "|" + guestId)));
  return next.flatMap((object) =>
    (object.assignedGuestIds ?? [])
      .filter((guestId) => !before.has(object.id + "|" + guestId))
      .map((guestId) => ({ guestId, objectId: object.id })),
  );
}
