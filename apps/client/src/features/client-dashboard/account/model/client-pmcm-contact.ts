import type { PrismClientPmcmContact, PrismEvent } from "@prism/types";

export type ClientPmcmContact = { name: string; detail: string };

/**
 * The PMCM coordinator a client talks to: the one on their soonest upcoming event (falling back to their latest past
 * one), with the events they coordinate for this client. Null when no coordinator is assigned yet.
 */
export function clientPmcmContact(
  /** Coordinators on the client's events; the API sends only assignments still in force. */
  assignments: PrismClientPmcmContact[],
  events: Pick<PrismEvent, "id" | "eventName" | "eventDate">[],
  today: string,
): ClientPmcmContact | null {
  const byId = new Map(events.map((event) => [event.id, event]));
  const active = assignments.filter((assignment) => assignment.coordinatorName && byId.has(assignment.eventId));
  if (active.length === 0) return null;
  const dateOf = (eventId: string) => byId.get(eventId)?.eventDate.slice(0, 10) ?? "";
  const upcoming = active.filter((assignment) => dateOf(assignment.eventId) >= today).sort((a, b) => dateOf(a.eventId).localeCompare(dateOf(b.eventId)));
  const past = active.filter((assignment) => dateOf(assignment.eventId) < today).sort((a, b) => dateOf(b.eventId).localeCompare(dateOf(a.eventId)));
  const lead = [...upcoming, ...past][0];
  const theirEvents = [...new Set(active.filter((assignment) => assignment.coordinatorName === lead.coordinatorName).map((assignment) => byId.get(assignment.eventId)?.eventName ?? ""))];
  const more = theirEvents.length - 1;
  return { name: lead.coordinatorName, detail: `Coordinates ${byId.get(lead.eventId)?.eventName ?? "your event"}${more > 0 ? ` and ${more} more` : ""}` };
}
