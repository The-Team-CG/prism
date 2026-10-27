"use client";

import {
  CalendarDays,
} from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import type { PrismEvent } from "@prism/types";
import { Card, CardBody, CardHeader, SectionAccent } from "./shell-ui";


export function EventQueueCard({
  events,
  selectedEventId,
  onSelectEvent,
  onNavigateEvent,
}: {
  events: PrismEvent[];
  selectedEventId?: string;
  onSelectEvent: (id: string) => void;
  onNavigateEvent: (id: string) => void;
}) {
  function statusAccent(status: string) {
    if (/approved|confirmed|complete|paid/i.test(status)) return "border-l-success";
    if (/planning|in_progress|active|draft/i.test(status)) return "border-l-primary";
    if (/pending|review/i.test(status)) return "border-l-attention";
    return "border-l-border";
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <SectionAccent>Active events</SectionAccent>
            <h2 className="mt-1 text-base font-bold text-foreground">
              {events.length} confirmed workspace{events.length === 1 ? "" : "s"}
            </h2>
          </div>
        </div>
      </CardHeader>
      {events.length === 0 ? (
        <CardBody>
          <EmptyState
            icon={CalendarDays}
            title="No confirmed events"
            description="Accept an inquiry and upload signed conforme to activate an event workspace."
          />
        </CardBody>
      ) : (
        <div className="divide-y divide-border">
          {events.map((ev) => (
            <button
              key={ev.id}
              type="button"
              onClick={() => onNavigateEvent(ev.id)}
              className={`group flex w-full items-center justify-between gap-4 border-l-4 ${statusAccent(ev.status)} px-6 py-4 text-left transition hover:bg-muted/30`}
            >
              <div className="min-w-0">
                <p className={`truncate text-sm font-bold ${ev.id === selectedEventId ? "text-primary" : "text-foreground"}`}>
                  {ev.eventName}
                </p>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><CalendarDays className="size-3" />{ev.eventDate ?? "Date pending"}</span>
                  <span>{ev.clientName}</span>
                </div>
              </div>
              <StatusBadge status={ev.status} />
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

