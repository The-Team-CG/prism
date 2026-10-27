"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { useRouter } from "next/navigation";
import type { PrismEvent } from "@prism/types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@prism/ui/components/dropdown-menu";

type SwitcherEvent = Pick<PrismEvent, "id" | "eventName" | "eventDate" | "status" | "clientName">;

/** The open event, named in the sidebar, with a switch that keeps the section you are on. */
export function EventWorkspaceSwitcher({
  events,
  selected,
  view,
}: {
  events: SwitcherEvent[];
  selected: SwitcherEvent;
  view?: string;
}) {
  const router = useRouter();
  const ordered = [...events].sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const segment = view && view !== "overview" ? view : "overview";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="mt-1 flex w-full items-center gap-2 rounded-md border border-border bg-background px-2.5 py-2 text-left outline-none transition-colors hover:border-border-strong focus-visible:ring-2 focus-visible:ring-ring">
        <span className="grid min-w-0 flex-1">
          <span className="truncate text-sm font-semibold text-foreground">{selected.eventName}</span>
          <span className="truncate text-xs text-muted-foreground">
            {selected.eventDate} · {selected.clientName}
          </span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
        <span className="sr-only">Switch event</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Switch event</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {ordered.map((event) => (
          <DropdownMenuItem
            key={event.id}
            onSelect={() => router.push(`/dashboard/events/${encodeURIComponent(event.id)}/${segment}`)}
            className="items-start"
          >
            <span className="grid min-w-0 flex-1">
              <span className="truncate font-medium">{event.eventName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {event.eventDate} · {event.status}
              </span>
            </span>
            {event.id === selected.id ? <Check aria-hidden="true" className="mt-0.5 size-4" /> : null}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => router.push("/dashboard/events")}>All events</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
