"use client";

import { CalendarDays } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { useClientWorkspace } from "../../client-workspace-context";
import { clientAccountEventChoiceRequired } from "../../model/client-dashboard-selectors";

/**
 * Names the event an account-level page is showing, and lets the client switch. With several events and
 * none chosen, it is the only thing the page shows until the client picks one.
 */
export function ClientAccountEventPicker({ purpose }: { purpose: string }) {
  const { events, selectedEvent, selectedEventId, setSelectedEventId } = useClientWorkspace();
  const choiceRequired = clientAccountEventChoiceRequired(events, selectedEventId);
  if (events.length === 0) return null;
  const current = choiceRequired ? undefined : selectedEvent;
  return (
    <section aria-label="Event" className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <CalendarDays aria-hidden="true" className="size-4 text-primary" />
        <h2 className="text-sm font-semibold text-foreground">
          {current ? `Showing ${current.eventName}` : `Choose an event to see its ${purpose}`}
        </h2>
      </div>
      {events.length > 1 ? (
        <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Events">
          {events.map((event) => (
            <Button
              key={event.id}
              size="sm"
              variant={event.id === current?.id ? "default" : "outline"}
              aria-pressed={event.id === current?.id}
              onClick={() => setSelectedEventId(event.id)}
            >
              {event.eventName}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

export function useClientAccountEventChoiceRequired() {
  const { events, selectedEventId } = useClientWorkspace();
  return clientAccountEventChoiceRequired(events, selectedEventId);
}
