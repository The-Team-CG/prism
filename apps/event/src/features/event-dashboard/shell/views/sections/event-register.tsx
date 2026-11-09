"use client";

import { useState } from "react";
import { RouteLink, useListFilter } from "@/features/pmcm-kit";
import { eventWorkspaceHref } from "../../model/event-dashboard-routing";
import { usePathname } from "next/navigation";
import { CalendarDays, Search } from "lucide-react";
import { PRISM_LIFECYCLE_STAGE_LABELS, derivePrismLifecycleStage, type PrismEvent } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@prism/ui/components/empty";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@prism/ui/components/table";
import { WorkspaceRouteTabs } from "./workspace-sub-tabs";

const VIEWS = [
  { href: "/dashboard/events", label: "All events" },
  { href: "/dashboard/events/upcoming", label: "Upcoming" },
  { href: "/dashboard/events/ongoing", label: "In progress" },
  { href: "/dashboard/events/completed", label: "Completed" },
  { href: "/dashboard/events/cancelled", label: "Cancelled" },
] as const;

const PAGE_SIZE = 25;

/** "June 2027" — events are grouped under the month they happen in. */
export function eventMonthLabel(eventDate: string) {
  const day = /^\d{4}-\d{2}-\d{2}/.test(eventDate) ? `${eventDate.slice(0, 10)}T00:00:00Z` : eventDate;
  const date = new Date(day);
  if (!Number.isFinite(date.getTime())) return "Date not set";
  return new Intl.DateTimeFormat("en-PH", { month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function groupEventsByMonth(events: PrismEvent[]) {
  const groups: Array<{ month: string; events: PrismEvent[] }> = [];
  for (const event of events) {
    const month = eventMonthLabel(event.eventDate);
    const last = groups.at(-1);
    if (last?.month === month) last.events.push(event);
    else groups.push({ month, events: [event] });
  }
  return groups;
}

function matches(event: PrismEvent, query: string) {
  const text = `${event.eventName} ${event.clientName} ${event.venue ?? ""}`.toLowerCase();
  return text.includes(query.trim().toLowerCase());
}

/** Overdue payments, overdue files and unread messages for one event, in the warning colour. Nothing is shown before the summaries load. */
function AttentionLabels({ labels, className, quietWhenClear = false }: { labels: string[] | undefined; className?: string; quietWhenClear?: boolean }) {
  if (!labels) return null;
  if (labels.length === 0) return quietWhenClear ? <span className="text-xs text-muted-foreground">Nothing overdue</span> : null;
  return (
    <ul className={className ?? "grid gap-0.5"}>
      {labels.map((label) => <li key={label} className="text-xs font-medium text-destructive">{label}</li>)}
    </ul>
  );
}

/** Every confirmed event as one searchable register; opening a row enters that event's workspace. */
export function EventRegister({ events, attention, onOpenEvent }: { events: PrismEvent[]; attention?: Map<string, string[]>; onOpenEvent: (id: string) => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useListFilter("q");
  const [visible, setVisible] = useState(PAGE_SIZE);
  const rows = [...events].filter((event) => matches(event, query)).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const groups = groupEventsByMonth(rows.slice(0, visible));
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <WorkspaceRouteTabs
          label="Event views"
          tabs={VIEWS.map((view) => ({ id: view.href, label: view.label, href: view.href }))}
          activeId={pathname}
        />
        <label className="relative w-full max-w-72">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find an event, client or venue"
            aria-label="Find an event, client or venue"
            className="h-9 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
          />
        </label>
      </div>

      <p role="status" className="text-xs text-muted-foreground">{rows.length} event{rows.length === 1 ? "" : "s"} in this view{query ? ` matching “${query}”` : ""}</p>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {rows.length === 0 ? (
          <Empty>
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <CalendarDays />
              </EmptyMedia>
              <EmptyTitle>{query ? "No event matches" : "No events in this view"}</EmptyTitle>
              <EmptyDescription>{query ? "Try a client, venue or part of the event name." : "Accepted inquiries become events once the conforme is signed."}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <Table>
            <caption className="sr-only">Events by month, with their client, date and lifecycle stage</caption>
            <TableHeader>
              <TableRow>
                <TableHead scope="col">Event</TableHead>
                <TableHead scope="col" className="hidden sm:table-cell">Date</TableHead>
                <TableHead scope="col">Stage</TableHead>
                <TableHead scope="col" className="hidden md:table-cell">Needs attention</TableHead>
                <TableHead scope="col" className="w-28 text-right"><span className="sr-only">Open</span></TableHead>
              </TableRow>
            </TableHeader>
            {groups.map((group) => (
              <TableBody key={group.month} className="[&_tr:last-child]:border-b">
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead scope="rowgroup" colSpan={5} className="h-auto py-2 text-left text-xs font-semibold text-foreground">
                    {group.month} <span className="font-normal text-muted-foreground">· {group.events.length}</span>
                  </TableHead>
                </TableRow>
                {group.events.map((event) => (
                  <TableRow key={event.id}>
                    <TableCell className="min-w-0 whitespace-normal">
                      <p className="font-semibold text-foreground">{event.eventName}</p>
                      <p className="text-xs text-muted-foreground">
                        {event.clientName}
                        {event.venue ? <> · {event.venue}</> : null}
                        <span className="sm:hidden"> · {formatPortalDate(event.eventDate)}</span>
                      </p>
                      <AttentionLabels labels={attention?.get(event.id)} className="mt-1 md:hidden" />
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap tabular-nums sm:table-cell">{formatPortalDate(event.eventDate)}</TableCell>
                    <TableCell className="whitespace-nowrap">{PRISM_LIFECYCLE_STAGE_LABELS[derivePrismLifecycleStage(event)]}</TableCell>
                    <TableCell className="hidden whitespace-normal md:table-cell"><AttentionLabels labels={attention?.get(event.id)} quietWhenClear /></TableCell>
                    <TableCell className="text-right">
                      <RouteLink href={eventWorkspaceHref(event.id)} onNavigate={() => onOpenEvent(event.id)} className="inline-flex min-h-11 items-center rounded-md px-2 text-sm font-semibold text-primary hover:text-primary-strong focus-visible:ring-2 focus-visible:ring-primary">
                        Open event<span className="sr-only"> {event.eventName}</span>
                      </RouteLink>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            ))}
          </Table>
        )}
      </div>
      {rows.length > visible ? (
        <button
          type="button"
          onClick={() => setVisible((count) => count + PAGE_SIZE)}
          className="justify-self-center rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-raised"
        >
          Show {Math.min(PAGE_SIZE, rows.length - visible)} more of {rows.length - visible} remaining
        </button>
      ) : null}
    </div>
  );
}
