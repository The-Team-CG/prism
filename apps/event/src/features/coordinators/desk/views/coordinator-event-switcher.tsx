import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";

type CoordinatorEventCard = {
  event: PrismEvent;
  assignment: PrismCoordinatorAssignment;
};

function eventCards(events: PrismEvent[], assignments: PrismCoordinatorAssignment[]): CoordinatorEventCard[] {
  return events.flatMap((event) => {
    const eventAssignments = assignments.filter((assignment) => assignment.eventId === event.id);
    if (!eventAssignments.length) return [];

    const assignment = eventAssignments.find(isCoordinatorAssignmentActive);
    if (!assignment) return [];
    return [{ event, assignment }];
  });
}

/** Sidebar event picker, in the same place PMCM and clients switch events. */
export function CoordinatorEventSwitcher({
  events,
  assignments,
  selectedEventId,
  onSelect,
}: {
  events: PrismEvent[];
  assignments: PrismCoordinatorAssignment[];
  selectedEventId?: string;
  onSelect: (eventId: string) => void;
}) {
  const cards = eventCards(events, assignments);
  const selected = cards.find(({ event }) => event.id === selectedEventId);

  if (!cards.length) {
    return <p className="rounded-lg border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">No events are assigned to you yet.</p>;
  }
  return (
    <div className="grid gap-1 rounded-lg border border-border bg-card px-3 py-2">
      <label htmlFor="coordinator-assigned-event" className="text-xs text-muted-foreground">Assigned event</label>
      <select
        id="coordinator-assigned-event"
        value={selectedEventId ?? ""}
        onChange={(event) => onSelect(event.target.value)}
        className="w-full truncate rounded-md border-0 bg-transparent p-0 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <option value="" disabled>Choose an event</option>
        {cards.map(({ event }) => <option key={event.id} value={event.id}>{event.eventName} — {formatPortalDate(event.eventDate)}</option>)}
      </select>
      {selected ? <p className="truncate text-xs text-muted-foreground">{selected.event.venue || "Venue to be confirmed"} · {selected.assignment.role}</p> : null}
    </div>
  );
}
