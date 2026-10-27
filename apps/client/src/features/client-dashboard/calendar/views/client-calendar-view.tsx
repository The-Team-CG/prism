"use client";

import { CalendarDays } from "lucide-react";
import { StatusBadge } from "@/app/components/ui/status-badge";
import { EmptyState } from "@/app/components/ui/empty-state";
import { cn } from "@/app/components/ui/utils";
import { formatStatusLabel } from "../../workspace/shared";
import { CLIENT_PORTAL_VIEW_META } from "../../workspace/shared";
import { useClientWorkspace } from "../../workspace/shared";
import { buildClientCalendarItems, type ClientCalendarItem } from "../model/client-calendar-items";

export function ClientCalendarView() {
  const {
    portalView,
    state,
    events,
    selectedEvent,
  } = useClientWorkspace();
  if (!state) return null;
  const portalViewMeta = portalView ? CLIENT_PORTAL_VIEW_META[portalView] : undefined;

    const toIsoDate = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const dateFromIso = (date: string) => new Date(`${date}T00:00:00`);
    const formatCalendarDate = (date: string) =>
      dateFromIso(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const calendarItemClass = (item: ClientCalendarItem) => {
      if (item.kind === "event") return "border-primary/20 bg-primary/10 text-primary";
      if (item.kind === "payment" && item.status === "paid") return "border-success/25 bg-success/10 text-success";
      if (item.kind === "payment") return "border-attention/25 bg-attention/10 text-attention";
      if (item.kind === "approval") return "border-success/25 bg-success-soft text-foreground";
      return "border-info/25 bg-info-soft text-foreground";
    };
  
    const calendarItems = buildClientCalendarItems(state, events, portalView);
    const monthSource = selectedEvent?.eventDate ?? calendarItems.find((item) => item.kind === "event")?.date ?? calendarItems[0]?.date ?? toIsoDate(new Date());
    const monthDate = dateFromIso(monthSource);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const gridStart = new Date(monthStart);
    gridStart.setDate(monthStart.getDate() - monthStart.getDay());
    const monthLabel = monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    const todayIso = toIsoDate(new Date());
    const itemsByDate = calendarItems.reduce<Map<string, ClientCalendarItem[]>>((map, item) => {
      const group = map.get(item.date) ?? [];
      group.push(item);
      map.set(item.date, group);
      return map;
    }, new Map());
    const monthCells = Array.from({ length: 42 }, (_, index) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + index);
      const iso = toIsoDate(date);
      return {
        date,
        iso,
        isCurrentMonth: date.getMonth() === monthStart.getMonth(),
        isToday: iso === todayIso,
        items: itemsByDate.get(iso) ?? [],
      };
    });
    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const legend = (
      [
        { kind: "event", label: "Event", className: "bg-primary" },
        { kind: "payment", label: "Payment", className: "bg-attention" },
        { kind: "visit", label: "Site visit", className: "bg-info" },
        { kind: "approval", label: "Layout approved", className: "bg-success" },
      ] as const
    ).filter((entry) => calendarItems.some((item) => item.kind === entry.kind));
  
    return (
      <div className="space-y-5">
        <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
            <h1 className="text-2xl font-black text-foreground">{monthLabel}</h1>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {legend.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", item.className)} />
                  {item.label}
                </span>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {weekdayLabels.map((day) => (
                  <div key={day} className="border-r border-border px-3 py-2 text-xs font-bold text-muted-foreground last:border-r-0">
                    {day}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthCells.map((cell, index) => (
                  <div
                    key={cell.iso}
                    className={cn(
                      "min-h-[116px] border-b border-r border-border p-2",
                      (index + 1) % 7 === 0 && "border-r-0",
                      !cell.isCurrentMonth && "bg-muted/20 text-muted-foreground",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "grid size-7 place-items-center rounded-lg text-xs font-bold",
                          cell.isToday ? "bg-primary text-primary-foreground" : "text-foreground",
                          !cell.isCurrentMonth && !cell.isToday && "text-muted-foreground",
                        )}
                      >
                        {cell.date.getDate()}
                      </span>
                    </div>
                    <div className="mt-2 space-y-1">
                      {cell.items.slice(0, 3).map((item) => (
                        <div
                          key={item.id}
                          className={cn("truncate rounded-md border px-2 py-1 text-2xs font-semibold", calendarItemClass(item))}
                          title={`${item.title} - ${item.detail}`}
                        >
                          {item.title}
                        </div>
                      ))}
                      {cell.items.length > 3 ? (
                        <p className="px-2 text-2xs font-semibold text-muted-foreground">+{cell.items.length - 3} more</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
  
        <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-black text-foreground">{portalViewMeta?.title ?? "Schedule"}</h2>
            <span className="text-xs font-semibold text-muted-foreground">
              {calendarItems.length} item{calendarItems.length === 1 ? "" : "s"}
            </span>
          </div>
          {calendarItems.length ? (
            <div className="mt-4 divide-y divide-border">
              {calendarItems.map((item) => (
                <div key={item.id} className="grid gap-3 py-3 sm:grid-cols-[72px_minmax(0,1fr)_auto] sm:items-center">
                  <span className="text-sm font-bold text-foreground">{formatCalendarDate(item.date)}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-foreground">{item.title}</p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <StatusBadge status={item.status} label={formatStatusLabel(item.status)} />
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-border px-6 py-8">
              <EmptyState icon={CalendarDays} title="No calendar items yet" description="Event dates, payment due dates and site visits appear here once PMCM schedules them." />
            </div>
          )}
        </section>
      </div>
    );
}
