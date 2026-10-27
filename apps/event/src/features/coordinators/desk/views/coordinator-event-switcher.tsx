import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";
import { CCard, CCardBody, CCardHeader } from "./sections/coordinator-view-primitives";

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

  return (
    <CCard>
      <CCardHeader><h2 className="text-sm font-semibold text-foreground">Your assigned event</h2></CCardHeader>
      <CCardBody>
        {cards.length ? (
          <div className="grid gap-2">
            <label htmlFor="coordinator-assigned-event" className="text-sm text-muted-foreground">Assigned event</label>
            <select
              id="coordinator-assigned-event"
              value={selectedEventId ?? ""}
              onChange={(event) => onSelect(event.target.value)}
              className="w-full max-w-lg rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <option value="" disabled>Choose an event</option>
              {cards.map(({ event }) => <option key={event.id} value={event.id}>{event.eventName} — {formatPortalDate(event.eventDate)}</option>)}
            </select>
            {selected ? <p className="text-sm text-muted-foreground">{formatPortalDate(selected.event.eventDate)} · {selected.event.venue || "Ask PMCM for the venue"} · {selected.assignment.role}</p> : null}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No coordinator events are assigned to you.</p>
        )}
      </CCardBody>
    </CCard>
  );
}
