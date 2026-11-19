import {
  SEATING_LIST_MAX_GUESTS,
  seatingUnavailableReason,
  type PrismEventPrivacy,
  type PrismFloorplanSeatingGuest,
  type PrismFloorplanSupplier,
  type PrismGuestRosterEntry,
  type PrismSupplierQuoteRequest,
} from "@prism/types";

/** Guests the editor can seat: eligible roster entries that were not withdrawn, as the API's seating check reads them. */
export function seatingGuestsFromRoster(entries: readonly PrismGuestRosterEntry[]): PrismFloorplanSeatingGuest[] {
  return entries
    .filter((entry) => !entry.withdrawnAt && entry.eligibility === "eligible")
    .map((entry) => ({ id: entry.id, name: entry.guestName, group: entry.category || null, rsvp: entry.rsvp, dietary: entry.dietary || null }));
}

/** Suppliers a zone may name: each supplier with a selected quote on the event, once. */
export function bookedSuppliers(requests: readonly PrismSupplierQuoteRequest[], eventId: string): PrismFloorplanSupplier[] {
  const booked = new Map<string, PrismFloorplanSupplier>();
  for (const request of requests) {
    if (request.eventId !== eventId || request.status !== "selected" || !request.supplierId) continue;
    booked.set(request.supplierId, { id: request.supplierId, name: request.supplierName, kind: request.category });
  }
  return [...booked.values()];
}

const UNAVAILABLE = {
  "event-public": "Table assignment is only available for private events.",
  "event-too-large": `Table assignment is only available for events under ${SEATING_LIST_MAX_GUESTS} guests.`,
} as const;

/** Whether guests can be seated on this event's plan, and why not when they cannot. */
export function seatingFor(pax: number, privacy: PrismEventPrivacy | undefined): { allowed: boolean; reason: string | null } {
  const unavailable = seatingUnavailableReason(pax, privacy);
  return unavailable ? { allowed: false, reason: UNAVAILABLE[unavailable] } : { allowed: true, reason: null };
}
