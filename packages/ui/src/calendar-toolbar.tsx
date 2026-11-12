"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronLeft, ChevronRight, Search, SlidersHorizontal } from "lucide-react";
import { CALENDAR_VIEWS, type CalendarViewId } from "./calendar-views";
import { cn } from "./utils";
import type { PortalCalendarItem, PortalCalendarKind, PortalCalendarProps } from "./portal-calendar";
import { Button } from "./components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuShortcut, DropdownMenuTrigger } from "./components/ui/dropdown-menu";

export type CalendarTiming = "all" | "timed" | "all-day";
export type CalendarDayLayout = "agenda" | "time-grid";
const TIMING_FILTERS = [{ id: "all", label: "All entries" }, { id: "timed", label: "Timed entries" }, { id: "all-day", label: "All-day entries" }] satisfies Array<{ id: CalendarTiming; label: string }>;

export function CalendarToolbar({ headingId, rangeLabel, anchor, view, dayLayout, onDateChange, onMove, onToday, onViewChange, onDayLayoutChange, children }: {
  headingId: string;
  rangeLabel: string;
  anchor: string;
  view: CalendarViewId;
  dayLayout: CalendarDayLayout;
  onDateChange: (date: string) => void;
  onMove: (direction: 1 | -1) => void;
  onToday: () => void;
  onViewChange: (view: CalendarViewId) => void;
  onDayLayoutChange: (layout: CalendarDayLayout) => void;
  children: ReactNode;
}) {
  return (
    <header className="space-y-3 border-b border-border/60 px-4 py-4 sm:px-5 sm:py-5">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
        <Popover>
          <PopoverTrigger asChild><Button type="button" variant="ghost" aria-label="Choose calendar date" className="h-auto max-w-full justify-start gap-2 px-0 py-1 text-base font-semibold shadow-none hover:bg-transparent has-[>svg]:px-0"><span className="truncate">{rangeLabel}</span><ChevronDown aria-hidden className="size-4 shrink-0 text-muted-foreground" /></Button></PopoverTrigger>
          <PopoverContent align="start" className="w-64 space-y-2"><label htmlFor={`${headingId}-date`} className="text-sm font-medium">Jump to date</label><input id={`${headingId}-date`} type="date" min="1000-01-01" max="9998-12-31" value={anchor} onChange={(event) => { if (event.target.value && event.target.validity.valid) onDateChange(event.target.value); }} className="h-10 w-full rounded-md border border-input bg-card px-3 text-sm" /></PopoverContent>
        </Popover>
        <div className="flex items-center gap-2">
          <div className="flex items-center" role="group" aria-label="Change period">
            <Button type="button" variant="ghost" size="icon-sm" aria-label={view === "day" ? "Previous day" : "Previous period"} onClick={() => onMove(-1)}><ChevronLeft className="size-4" aria-hidden /></Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label={view === "day" ? "Next day" : "Next period"} onClick={() => onMove(1)}><ChevronRight className="size-4" aria-hidden /></Button>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onToday}>Today</Button>
          <ViewSwitcher view={view} onChange={onViewChange} />
        </div>
      </div>
      {children}
      {view === "day" ? <div role="group" aria-label="Day layout" className="inline-flex gap-1 rounded-lg bg-muted/60 p-1">
        <Button type="button" variant={dayLayout === "agenda" ? "secondary" : "ghost"} size="sm" aria-pressed={dayLayout === "agenda"} onClick={() => onDayLayoutChange("agenda")}>Agenda</Button>
        <Button type="button" variant={dayLayout === "time-grid" ? "secondary" : "ghost"} size="sm" aria-pressed={dayLayout === "time-grid"} onClick={() => onDayLayoutChange("time-grid")}>Time grid</Button>
      </div> : null}
      <h2 id={headingId} aria-live="polite" className="sr-only">{rangeLabel}</h2>
    </header>
  );
}

export function CalendarFilters({ query, onQueryChange, activeKind, onKindChange, timing, onTimingChange, kinds, periodItems, categoryControls, categoryLabel, filterCount }: {
  query: string;
  onQueryChange: (query: string) => void;
  activeKind: string | null;
  onKindChange: (kind: string | null) => void;
  timing: CalendarTiming;
  onTimingChange: (timing: CalendarTiming) => void;
  kinds: Record<string, PortalCalendarKind>;
  periodItems: PortalCalendarItem[];
  categoryControls: PortalCalendarProps<PortalCalendarItem>["categoryControls"];
  categoryLabel: string | null;
  filterCount: number;
}) {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const availableKinds = Object.keys(kinds).filter((kind) => kind === activeKind || periodItems.some((item) => item.kind === kind));
  return (
    <div className="flex min-w-0 items-center gap-2">
      <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-md border border-input bg-card px-3 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/20 sm:max-w-xs">
        <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        <input type="search" aria-label="Search schedule" placeholder="Search schedule..." value={query} onChange={(event) => onQueryChange(event.target.value)} className="min-w-0 w-full bg-transparent text-sm outline-none" />
      </label>
      <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
        <PopoverTrigger asChild><Button type="button" variant="outline" size="sm" aria-label="Filter schedule" className="shadow-none"><SlidersHorizontal aria-hidden className="size-4" />Filters{filterCount ? <span className="text-primary">{filterCount}</span> : null}</Button></PopoverTrigger>
        <PopoverContent align="start" collisionPadding={16} className="w-80 max-w-[calc(100vw-2rem)] space-y-4">
          <div role="group" aria-label="Schedule categories" className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Categories</p>
            {categoryControls ? <div onClick={(event) => { if (event.target instanceof Element && event.target.closest("a")) setFiltersOpen(false); }}>{categoryControls.content}</div> : <div className="flex flex-col gap-1">{[{ id: null, label: "All scheduled" }, ...availableKinds.map((id) => ({ id, label: kinds[id].label }))].map((kind) => <button key={kind.id ?? "all"} type="button" aria-pressed={activeKind === kind.id} onClick={() => onKindChange(kind.id)} className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted aria-pressed:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{kind.id ? <span aria-hidden className={cn("size-1.5 rounded-full", kinds[kind.id].dot)} /> : null}{kind.label}<span className="ml-auto tabular-nums text-muted-foreground">{periodItems.filter((item) => kind.id === null || item.kind === kind.id).length}</span>{activeKind === kind.id ? <Check aria-hidden className="size-3.5" /> : <span className="size-3.5" />}</button>)}</div>}
          </div>
          <div role="group" aria-label="Schedule timing" className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-medium text-muted-foreground">Timing</p>
            {TIMING_FILTERS.map((option) => <button key={option.id} type="button" aria-pressed={timing === option.id} onClick={() => onTimingChange(option.id)} className="flex min-h-9 w-full items-center justify-between rounded-md px-2 text-sm hover:bg-muted aria-pressed:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{option.label}{timing === option.id ? <Check aria-hidden className="size-3.5" /> : null}</button>)}
          </div>
          {filterCount ? <Button asChild={Boolean(categoryControls?.selection)} variant="ghost" size="sm" onClick={() => { onKindChange(null); onTimingChange("all"); if (categoryControls?.selection) setFiltersOpen(false); }}>{categoryControls?.selection?.reset ?? "Clear filters"}</Button> : null}
        </PopoverContent>
      </Popover>
      {categoryLabel || timing !== "all" ? <span className="hidden truncate text-xs text-muted-foreground sm:block">{[categoryLabel, timing === "timed" ? "Timed entries" : timing === "all-day" ? "All-day entries" : null].filter(Boolean).join(" · ")}</span> : null}
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: CalendarViewId; onChange: (view: CalendarViewId) => void }) {
  const current = CALENDAR_VIEWS.find((entry) => entry.id === view) ?? CALENDAR_VIEWS[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className="shadow-none" aria-label={`Calendar view: ${current.label}`}>{current.label}<ChevronDown className="size-4 text-muted-foreground" aria-hidden /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-40">
        {CALENDAR_VIEWS.map((entry) => (
          <DropdownMenuItem key={entry.id} onSelect={() => onChange(entry.id)}>
            {entry.label}
            {entry.id === view ? <Check className="ml-1 size-3.5" aria-hidden /> : null}
            <DropdownMenuShortcut>{entry.shortcut}</DropdownMenuShortcut>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
