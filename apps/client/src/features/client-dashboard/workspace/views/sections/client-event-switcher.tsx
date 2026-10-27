"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@prism/ui/components/dropdown-menu";
import { formatStatusLabel } from "../../shared";

type SwitcherEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">;

/** Names the open event in the sidebar; switching keeps the section the client is on. */
export function ClientEventSwitcher({
  events,
  selected,
  onSwitch,
  onAllEvents,
}: {
  events: SwitcherEvent[];
  selected: SwitcherEvent;
  onSwitch: (eventId: string) => void;
  onAllEvents: () => void;
}) {
  const ordered = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="mt-1 flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-foreground">{selected.eventName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {selected.eventDate} · {formatStatusLabel(selected.status)}
          </span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Switch event</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch event</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((event) => (
          <DropdownMenuItem key={event.id} onSelect={() => onSwitch(event.id)} className="items-start">
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{event.eventName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {event.eventDate} · {formatStatusLabel(event.status)}
              </span>
            </span>
            {event.id === selected.id ? <Check aria-hidden="true" className="mt-0.5 size-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onAllEvents}>My Events</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
