import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
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

  return (
    <CCard>
      <CCardHeader>
        <h2 className="text-sm font-bold text-foreground">Your events</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open any event assigned to you, including previous events.</p>
      </CCardHeader>
      <CCardBody>
        {cards.length ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {cards.map(({ event, assignment }) => {
              const selected = event.id === selectedEventId;
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-label={`Open ${event.eventName}`}
                  aria-pressed={selected}
                  onClick={() => onSelect(event.id)}
                  className={`min-h-28 rounded-lg border p-4 text-left transition ${selected ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40 hover:bg-secondary/35"}`}
                >
                  <span className="block truncate text-sm font-black text-foreground">{event.eventName}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{event.eventDate} · {assignment.role}</span>
                  <span className="mt-2 block text-xs text-muted-foreground">{event.venue?.trim() ? `Venue: ${event.venue}` : "Venue not recorded"}</span>
                  <span className="mt-2 block text-xs font-semibold text-muted-foreground">Assignment: {assignment.status}</span>
                </button>
              );
            })}
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No coordinator events are assigned to you.</p>
        )}
      </CCardBody>
    </CCard>
  );
}
