"use client";

import { CalendarDays, FileCheck2, ShieldCheck } from "lucide-react";
import { CommandStat } from "./command-stat";
import { CommandHomeBanner } from "./command-home-banner";
import { CommandHomeQueues } from "./command-home-queues";
import { commandGreeting, daysUntilEvent } from "../../model/command-home-copy";
import type { EventSession } from "@/app/lib/session";
import type { PrismApprovalRequest, PrismDefenseReadiness, PrismEvent, PrismPmcmDashboardWorkspace } from "@prism/types";
import type { DashboardSection, DetailTab } from "../../model/event-dashboard-routing";

export function CommandHomePage({
  session,
  events,
  selectedEvent,
  unreviewedInquiries,
  pendingApprovals,
  onNavigateSection,
  onNavigateEvent,
  onReset,
}: {
  session: EventSession;
  state: PrismPmcmDashboardWorkspace;
  events: PrismEvent[];
  selectedEvent?: PrismEvent;
  unreviewedInquiries: number;
  pendingApprovals: PrismApprovalRequest[];
  defenseReadiness: PrismDefenseReadiness | null;
  onNavigateSection: (section: DashboardSection) => void;
  onNavigateEvent: (id: string, tab?: DetailTab) => void;
  onReset: () => void;
}) {
  const greeting = commandGreeting(new Date().getHours());
  const firstName = session.name.split(" ")[0];
  const daysToEvent = daysUntilEvent(selectedEvent?.eventDate);

  return (
    <div className="space-y-6">
      <CommandHomeBanner
        greeting={greeting}
        firstName={firstName}
        eventCount={events.length}
        unreviewedInquiries={unreviewedInquiries}
        daysToEvent={daysToEvent}
        selectedEventName={selectedEvent?.eventName}
        onNavigateSection={onNavigateSection}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CommandStat
          label="Active events"
          value={events.length}
          icon={CalendarDays}
          accent="text-(--prism-signal)"
          onClick={() => onNavigateSection("events-list")}
        />
        <CommandStat
          label="Pending inquiries"
          value={unreviewedInquiries}
          icon={FileCheck2}
          accent="text-(--prism-amber)"
          onClick={() => onNavigateSection("inquiries")}
        />
        <CommandStat
          label="Pending approvals"
          value={pendingApprovals.length}
          icon={ShieldCheck}
          accent="text-(--prism-success)"
        />
      </div>

      <CommandHomeQueues
        events={events}
        selectedEvent={selectedEvent}
        pendingApprovals={pendingApprovals}
        onNavigateEvent={onNavigateEvent}
        onReset={onReset}
      />
    </div>
  );
}
