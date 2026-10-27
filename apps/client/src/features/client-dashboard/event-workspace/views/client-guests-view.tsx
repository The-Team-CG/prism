"use client";

import { Badge } from "@/app/components/ui/badge";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientGuestsView() {
  const { selectedEvent, briefing } = useClientWorkspace();

  return (
  <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
    <p className="text-xs font-bold uppercase tracking-widest text-primary">Guests / attendees</p>
    <h2 className="mt-1 text-xl font-black text-foreground">{briefing?.guestCount ? `${briefing.guestCount} expected guests` : "Guest count pending"}</h2>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">
      Guest registration details remain PMCM-managed. Client-visible attendee summaries will appear here once the event team publishes them.
    </p>
    {selectedEvent?.guestAccessCode ? (
      <Badge className="mt-4 rounded-full">Guest access code: {selectedEvent.guestAccessCode}</Badge>
    ) : null}
  </div>
  );
}
