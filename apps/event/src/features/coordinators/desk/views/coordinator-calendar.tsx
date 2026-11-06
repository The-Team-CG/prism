"use client";

import { Button } from "@prism/ui/components/button";
import { manilaDateKey } from "@prism/ui/format-date";
import { PortalCalendar, type PortalCalendarKind } from "@prism/ui/portal-calendar";
import type { CoordinatorCalendarItem, CoordinatorCalendarKind } from "../model/coordinator-calendar-items";
import type { CoordinatorViewId } from "../model/coordinator-portal-routes";

const KINDS: Record<CoordinatorCalendarKind, PortalCalendarKind> = {
  event: { label: "Event day", chip: "bg-primary/10 text-primary hover:bg-primary/15", dot: "bg-primary" },
  task: { label: "Task due", chip: "bg-attention-soft text-attention hover:bg-attention/15", dot: "bg-attention" },
  schedule_day: { label: "Event-day schedule", chip: "bg-accent text-accent-foreground hover:bg-accent/80", dot: "bg-accent-foreground" },
};

const ACTIONS: Record<CoordinatorCalendarKind, string> = {
  event: "Open my shift",
  task: "Open tasks",
  schedule_day: "Open run sheet",
};

/** The coordinator's events and the open event's deadlines on the shared portal calendar. */
export function CoordinatorCalendar({ items, onOpen }: { items: CoordinatorCalendarItem[]; onOpen: (view: CoordinatorViewId, eventId: string) => void }) {
  const today = manilaDateKey();
  if (items.length === 0) {
    return <p role="status" className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">Nothing scheduled yet. Event days and task deadlines appear here once you are assigned.</p>;
  }
  return (
    <PortalCalendar
      items={items}
      kinds={KINDS}
      today={today}
      initialDate={items.find((item) => item.date >= today)?.date ?? today}
      detail={{
        action: (item) => <Button type="button" onClick={() => onOpen(item.view, item.eventId)}>{ACTIONS[item.kind]}</Button>,
      }}
    />
  );
}
