import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@prism/ui/components/select";
import { formatPortalDate } from "@prism/ui/format-date";
import { isCoordinatorAssignmentActive } from "../model/coordinators-desk-rules";
import { Card } from "@prism/ui/components/card";

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
  // One assignment has nothing to switch between, so it is shown as text rather than a dropdown.
  if (cards.length === 1) {
    const [only] = cards;
    return (
      <Card className="gap-0 grid gap-1 rounded-lg border border-border bg-card px-3 py-2">
        <p className="text-sm font-semibold leading-5 text-foreground">{only.event.eventName}</p>
        <p className="text-xs text-muted-foreground">{formatPortalDate(only.event.eventDate)} · {only.assignment.role}</p>
      </Card>
    );
  }
  return (
    <Card className="gap-0 grid gap-1 rounded-lg border border-border bg-card px-3 py-2">
      <label htmlFor="coordinator-assigned-event" className="text-xs text-muted-foreground">Assigned event</label>
      <Select value={selectedEventId ?? ""} onValueChange={onSelect}>
        <SelectTrigger id="coordinator-assigned-event" aria-label="Assigned event" className="h-auto w-full min-w-0 border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none">
          <SelectValue placeholder="Choose an event" />
        </SelectTrigger>
        <SelectContent>
          {cards.map(({ event }) => <SelectItem key={event.id} value={event.id}><span className="truncate">{event.eventName} — {formatPortalDate(event.eventDate)}</span></SelectItem>)}
        </SelectContent>
      </Select>
      {selected ? <p className="text-xs text-muted-foreground">{formatPortalDate(selected.event.eventDate)} · {selected.assignment.role}</p> : null}
    </Card>
  );
}
