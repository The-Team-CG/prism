"use client";

import { useEffect, useState } from "react";
import { CALENDAR_VIEWS, type CalendarViewId } from "./calendar-views";

/**
 * Where a calendar is: its category, view, date and whether done entries are hidden. Kept in the address
 * (`?kind=payment&period=week&date=2026-11-22&open=1`) so a link, a refresh or a shared URL opens the same place.
 */
export type CalendarPlace = { kind: string | null; view: CalendarViewId; date: string; openOnly: boolean };

const PARAM = { kind: "kind", view: "period", date: "date", openOnly: "open" } as const;
const ALL_KINDS = "all";

function isDateKey(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const parsed = new Date(`${value}T00:00:00Z`);
  return year >= 1000 && year <= 9998 && !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value);
}

function readKind(value: string | null, kinds: Record<string, unknown>, fallback: string | null): string | null {
  if (value === ALL_KINDS) return null;
  return value && value in kinds ? value : fallback;
}

/** The place an address asks for; anything missing or unknown keeps the calendar's own default. */
export function readCalendarPlace(search: string, defaults: CalendarPlace, kinds: Record<string, unknown>): CalendarPlace {
  const params = new URLSearchParams(search);
  const view = params.get(PARAM.view);
  const date = params.get(PARAM.date);
  const openOnly = params.get(PARAM.openOnly);
  return {
    kind: readKind(params.get(PARAM.kind), kinds, defaults.kind),
    view: CALENDAR_VIEWS.some((entry) => entry.id === view) ? (view as CalendarViewId) : defaults.view,
    date: date && isDateKey(date) ? date : defaults.date,
    openOnly: openOnly === "1" ? true : openOnly === "0" ? false : defaults.openOnly,
  };
}

/** The address for a place: only what differs from where the calendar opens by default, other parameters kept. */
export function calendarPlaceSearch(search: string, place: CalendarPlace, defaults: CalendarPlace): string {
  const params = new URLSearchParams(search);
  const put = (key: string, value: string | null) => (value === null ? params.delete(key) : params.set(key, value));
  put(PARAM.kind, place.kind === defaults.kind ? null : place.kind ?? ALL_KINDS);
  put(PARAM.view, place.view === defaults.view ? null : place.view);
  put(PARAM.date, place.date === defaults.date ? null : place.date);
  put(PARAM.openOnly, place.openOnly === defaults.openOnly ? null : place.openOnly ? "1" : "0");
  const text = params.toString();
  return text ? `?${text}` : "";
}

/**
 * Opens the calendar where the address says, then keeps the address in step. Changes replace the current history
 * entry, so Back leaves the calendar instead of stepping through every click.
 */
export function useCalendarPlace({ enabled, defaults, kinds, place, apply }: {
  enabled: boolean;
  defaults: CalendarPlace;
  kinds: Record<string, unknown>;
  place: CalendarPlace;
  apply: (place: CalendarPlace) => void;
}) {
  const [ready, setReady] = useState(!enabled);
  useEffect(() => {
    if (!enabled) return;
    apply(readCalendarPlace(window.location.search, defaults, kinds));
    setReady(true);
  }, [enabled]); // eslint-disable-line react-hooks/exhaustive-deps -- read once, when the calendar opens

  useEffect(() => {
    if (!enabled || !ready) return;
    const next = calendarPlaceSearch(window.location.search, place, defaults);
    if (next === window.location.search) return;
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${next}${window.location.hash}`);
  }, [enabled, ready, place.kind, place.view, place.date, place.openOnly]); // eslint-disable-line react-hooks/exhaustive-deps
}
