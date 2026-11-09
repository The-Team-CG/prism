"use client";
import { formatPortalDate } from "@prism/ui/format-date";

import { Card, CardContent, CardHeader, CardTitle } from "@prism/ui/components/card";
import { StatusBadge } from "@prism/ui/components/status-badge";
import { formatStatusLabel } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";

export function ClientEventDetailsView() {
  const { selectedEvent, briefing } = useClientWorkspace();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-foreground">Event details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Event name</span><span className="font-semibold text-foreground">{selectedEvent?.eventName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Client</span><span className="font-semibold text-foreground">{selectedEvent?.clientName}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date</span><span className="font-semibold text-foreground">{formatPortalDate(selectedEvent?.eventDate)}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><StatusBadge status={selectedEvent?.status ?? "pending"} label={formatStatusLabel(selectedEvent?.status)} /></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-bold text-foreground">Briefing basis</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-foreground">{briefing?.venue ?? "To be confirmed"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Guests</span><span className="font-semibold text-foreground">{briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Budget</span><span className="font-semibold text-foreground">{briefing?.budgetRange ?? "Pending"}</span></div>
          <div className="flex justify-between gap-3"><span className="text-muted-foreground">Submitted</span><span className="font-semibold text-foreground">{briefing?.submittedAt ? formatPortalDate(briefing.submittedAt) : "Pending"}</span></div>
        </CardContent>
      </Card>
    </div>
  );
}
