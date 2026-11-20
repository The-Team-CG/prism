import { tableAssignmentsOf } from "@prism/floorplan-scene";
import {
  evaluateTableAssignment,
  type FloorplanSceneDocument,
  type PrismFloorplanSeatingGuest,
  type TableAssignmentIneligibleReason,
  type TableEligibilityObject,
} from "@prism/types";

/** PMCM copy for each refused seat, as the legacy editor words it. */
export const SEAT_REFUSALS: Record<TableAssignmentIneligibleReason, string> = {
  "unknown-guest": "This guest is not on the event guest list.",
  "guest-declined": "Guests who declined cannot be seated.",
  "not-a-table": "Choose a table with seats to seat a guest.",
  "table-hidden": "Hidden tables cannot take guests. Unhide the table first.",
  "table-full": "This table has no free seats.",
  "guest-already-seated": "A guest can only be seated at one table.",
  "event-too-large": "Table assignment is only available for events under 200 guests.",
  "event-public": "Table assignment is only available for private events.",
};

/** The scene's tables in the shape the shared seating rule reads. */
function tableObjects(scene: FloorplanSceneDocument): TableEligibilityObject[] {
  return tableAssignmentsOf(scene).map((table) => ({
    id: table.tableId,
    kind: "ellipse",
    category: "furniture",
    seats: table.seats,
    hidden: table.hidden,
    assignedGuestIds: table.guestIds,
  }));
}

export type SeatResult = { guestIds: string[] } | { refusal: string };

/** Seats a guest at a table if the shared rule allows it, returning the table's new guest list or the refusal. */
export function seatGuest(scene: FloorplanSceneDocument, guests: readonly PrismFloorplanSeatingGuest[], tableId: string, guestId: string): SeatResult {
  const objects = tableObjects(scene);
  const eligibility = evaluateTableAssignment({ objects, guests, guestId, objectId: tableId });
  if (!eligibility.eligible) return { refusal: SEAT_REFUSALS[eligibility.reason] };
  const seated = objects.find((table) => table.id === tableId)?.assignedGuestIds ?? [];
  return { guestIds: [...seated, guestId] };
}

export type GuestGroup = { group: string; guests: PrismFloorplanSeatingGuest[] };

/** Guests still to seat, grouped by their group: declined guests and guests seated at any table are left out. */
export function unseatedGuestGroups(scene: FloorplanSceneDocument, guests: readonly PrismFloorplanSeatingGuest[], query = ""): GuestGroup[] {
  const seated = new Set(tableAssignmentsOf(scene).flatMap((table) => table.guestIds));
  const needle = query.trim().toLowerCase();
  const groups = new Map<string, PrismFloorplanSeatingGuest[]>();
  for (const guest of guests) {
    if (guest.rsvp === "declined" || seated.has(guest.id)) continue;
    if (needle && !`${guest.name} ${guest.group ?? ""}`.toLowerCase().includes(needle)) continue;
    const group = guest.group || "No group";
    groups.set(group, [...(groups.get(group) ?? []), guest]);
  }
  return [...groups].map(([group, members]) => ({ group, guests: members }));
}
