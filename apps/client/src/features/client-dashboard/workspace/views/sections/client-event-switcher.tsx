"use client";

import Link from "next/link";
import { ArrowLeft, Check, ChevronsUpDown } from "lucide-react";
import type { PrismEvent } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@prism/ui/components/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@prism/ui/components/tooltip";
import { formatStatusLabel } from "../../shared";

type SwitcherEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status">;

/**
 * The way back to all events, then the open event; switching keeps the section the client is on.
 * The back row sits where Home sits in the portal sidebar.
 */
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
    <div className="mt-1 grid gap-2">
    <Link href="/dashboard/events" className="flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground outline-none transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
      <ArrowLeft aria-hidden="true" className="size-4" />
      All events
    </Link>
    <DropdownMenu>
      <DropdownMenuTrigger className="flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid min-w-0 flex-1">
          <Tooltip><TooltipTrigger asChild><span className="truncate text-sm font-semibold text-foreground">{selected.eventName}</span></TooltipTrigger><TooltipContent side="right">{selected.eventName}</TooltipContent></Tooltip>
          <span className="truncate text-xs text-muted-foreground">
            {formatPortalDate(selected.eventDate)} · {formatStatusLabel(selected.status)}
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
              <Tooltip><TooltipTrigger asChild><span className="truncate font-medium">{event.eventName}</span></TooltipTrigger><TooltipContent side="right">{event.eventName}</TooltipContent></Tooltip>
              <span className="truncate text-xs text-muted-foreground">
                {formatPortalDate(event.eventDate)} · {formatStatusLabel(event.status)}
              </span>
            </span>
            {event.id === selected.id ? <Check aria-hidden="true" className="mt-0.5 size-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onAllEvents}>All events</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    </div>
  );
}
