import { PRISM_LIFECYCLE_STAGES, type PrismLifecycleStage } from "@prism/types";
import { daysUntil, manilaCalendarKey } from "../format-date";

export type CountdownTone = "today" | "soon" | "later" | "past";

/** How far away an event day is, as a short phrase for its card: "Today", "Tomorrow", "in 7 days", "3 days ago". */
export function eventCountdown(eventDate: string, todayKey: string): { label: string; tone: CountdownTone; days: number } | null {
  const days = daysUntil(manilaCalendarKey(eventDate), todayKey);
  if (days === null) return null;
  if (days === 0) return { label: "Today", tone: "today", days };
  if (days === 1) return { label: "Tomorrow", tone: "soon", days };
  if (days > 1) return { label: `in ${days} days`, tone: days <= 7 ? "soon" : "later", days };
  if (days === -1) return { label: "Yesterday", tone: "past", days };
  return { label: `${-days} days ago`, tone: "past", days };
}

/** The 1-based position of a lifecycle stage, for "Stage 3 of 6". */
export function stagePosition(stage: PrismLifecycleStage): number {
  return PRISM_LIFECYCLE_STAGES.indexOf(stage) + 1;
}

/** Month, day and weekday of an event date in Philippine time, for the date tile. */
export function dateTileParts(eventDate: string): { month: string; day: string; weekday: string } | null {
  const key = manilaCalendarKey(eventDate);
  const date = new Date(`${key}T00:00:00Z`);
  if (!Number.isFinite(date.getTime())) return null;
  const part = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-PH", { ...options, timeZone: "UTC" }).format(date);
  return { month: part({ month: "short" }).toUpperCase(), day: part({ day: "numeric" }), weekday: part({ weekday: "short" }).toUpperCase() };
}
