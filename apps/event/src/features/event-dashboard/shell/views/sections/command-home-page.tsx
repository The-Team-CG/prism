"use client";

import { CalendarDays, FileCheck2, RotateCcw, ShieldCheck } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { CommandStat } from "./command-stat";
import { CommandHomeBanner } from "./command-home-banner";
import { commandGreeting } from "../../model/command-home-copy";
import type { EventSession } from "@/app/lib/session";
import type { PrismPmcmCommandInbox } from "@prism/types";
import type { DashboardSection } from "../../model/event-dashboard-routing";

export function CommandHomePage({
  session,
  summary,
  onNavigateSection,
  onReset,
}: {
  session: EventSession;
  summary: PrismPmcmCommandInbox["summary"];
  onNavigateSection: (section: DashboardSection) => void;
  onReset: () => void;
}) {
  const greeting = commandGreeting(new Date().getHours());
  const firstName = session.name.split(" ")[0];

  return (
    <div className="space-y-6">
      <CommandHomeBanner
        greeting={greeting}
        firstName={firstName}
        eventCount={summary.activeEvents}
        unreviewedInquiries={summary.pendingInquiries}
        daysToEvent={null}
        onNavigateSection={onNavigateSection}
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <CommandStat
          label="Active events"
          value={summary.activeEvents}
          icon={CalendarDays}
          accent="text-(--prism-signal)"
          onClick={() => onNavigateSection("events-list")}
        />
        <CommandStat
          label="Pending inquiries"
          value={summary.pendingInquiries}
          icon={FileCheck2}
          accent="text-(--prism-amber)"
          onClick={() => onNavigateSection("inquiries")}
        />
        <CommandStat
          label="Pending approvals"
          value={summary.pendingApprovals}
          icon={ShieldCheck}
          accent="text-(--prism-success)"
        />
      </div>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" className="rounded-lg font-bold" onClick={onReset}>
          <RotateCcw className="mr-1.5 size-3.5" /> Reset sample data
        </Button>
      </div>
    </div>
  );
}
