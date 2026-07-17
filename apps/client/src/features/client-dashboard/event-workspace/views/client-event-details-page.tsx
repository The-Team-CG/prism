"use client";

import { StatusBadge } from "@/app/components/ui/status-badge";
import { formatStatusLabel } from "../../workspace/model/client-dashboard-view-rules";
import { useClientWorkspace } from "../../workspace/client-workspace-context";

export function ClientEventDetailsPage() {
  const { selectedEvent, briefing } = useClientWorkspace();

  return (
  <div className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-bold text-foreground">Event details</p>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Event name</span><span className="font-semibold text-foreground">{selectedEvent?.eventName}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Client</span><span className="font-semibold text-foreground">{selectedEvent?.clientName}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Date</span><span className="font-semibold text-foreground">{selectedEvent?.eventDate}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Status</span><StatusBadge status={selectedEvent?.status ?? "pending"} label={formatStatusLabel(selectedEvent?.status)} /></div>
      </div>
    </div>
    <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
      <p className="text-sm font-bold text-foreground">Briefing basis</p>
      <div className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Venue</span><span className="font-semibold text-foreground">{briefing?.venue ?? "To be confirmed"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Guests</span><span className="font-semibold text-foreground">{briefing?.guestCount ? `${briefing.guestCount} guests` : "Pending"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Budget</span><span className="font-semibold text-foreground">{briefing?.budgetRange ?? "Pending"}</span></div>
        <div className="flex justify-between gap-3"><span className="text-muted-foreground">Submitted</span><span className="font-semibold text-foreground">{briefing?.submittedAt ?? "Pending"}</span></div>
      </div>
    </div>
  </div>
  );
}
