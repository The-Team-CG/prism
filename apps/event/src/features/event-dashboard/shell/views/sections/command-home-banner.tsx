"use client";

import { CalendarDays } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { commandHomeSummary, inquiryReviewLabel } from "../../model/command-home-copy";
import type { DashboardSection } from "../../model/event-dashboard-routing";

export function CommandHomeBanner({
  greeting,
  firstName,
  eventCount,
  unreviewedInquiries,
  daysToEvent,
  selectedEventName,
  onNavigateSection,
}: {
  greeting: string;
  firstName: string;
  eventCount: number;
  unreviewedInquiries: number;
  daysToEvent: number | null;
  selectedEventName?: string;
  onNavigateSection: (section: DashboardSection) => void;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-(--prism-signal) to-[#8b0f48] px-6 py-7 text-white shadow-lg sm:px-8 sm:py-8">
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white/70">P.R.I.S.M Event Command</p>
            <h1 className="mt-1 text-2xl font-black leading-tight sm:text-3xl">
              {greeting}, {firstName}.
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/80">
              {commandHomeSummary(eventCount, unreviewedInquiries)}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                className="rounded-lg bg-white font-bold text-(--prism-signal) hover:bg-white/90"
                onClick={() => onNavigateSection("events-list")}
              >
                <CalendarDays className="size-4" /> View events
              </Button>
              {unreviewedInquiries > 0 ? (
                <Button
                  variant="ghost"
                  className="rounded-lg font-semibold text-white hover:bg-white/15 hover:text-white"
                  onClick={() => onNavigateSection("inquiries")}
                >
                  {inquiryReviewLabel(unreviewedInquiries)}
                </Button>
              ) : null}
            </div>
          </div>
          {daysToEvent !== null ? (
            <div className="hidden shrink-0 flex-col items-center rounded-xl bg-white/15 px-5 py-4 text-center backdrop-blur-sm sm:flex">
              <span className="text-4xl font-black leading-none">{daysToEvent}</span>
              <span className="mt-1 text-xs font-semibold uppercase tracking-wider text-white/70">days to event</span>
              {selectedEventName ? (
                <span className="mt-1 max-w-30 truncate text-[10px] text-white/60">{selectedEventName}</span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
      <span className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/6" />
      <span className="pointer-events-none absolute -bottom-16 -right-8 size-64 rounded-full bg-white/4" />
    </div>
  );
}
