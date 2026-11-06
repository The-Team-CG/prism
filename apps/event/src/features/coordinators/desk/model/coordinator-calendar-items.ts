import { eventDateKey } from "@prism/ui/calendar-grid";
import { manilaCalendarKey, manilaClockKey } from "@prism/ui/format-date";
import type { PrismEvent, PrismEventDayTask, PrismEventScheduleDay } from "@prism/types";
import type { CoordinatorViewId } from "./coordinator-portal-routes";

export type CoordinatorCalendarKind = "event" | "task" | "schedule_day";

export type CoordinatorCalendarItem = {
  id: string;
  /** Philippine calendar date, YYYY-MM-DD. */
  date: string;
  /** Philippine wall-clock time, HH:mm; absent for all-day items. */
  startTime?: string;
  title: string;
  detail: string;
  kind: CoordinatorCalendarKind;
  eventId: string;
  /** The coordinator view where this item is handled. */
  view: CoordinatorViewId;
};

const CLOSED_TASK_STATUSES = ["done", "cancelled", "closed"];

/** What the coordinator has loaded for the event they have open; the other assigned events only have a date. */
export type CoordinatorCalendarFocus = { eventId: string; tasks: PrismEventDayTask[]; days: PrismEventScheduleDay[] };

/** The open event's open task deadlines and its schedule days other than the event day itself. */
function focusedEventItems(
  event: Pick<PrismEvent, "id" | "eventName">,
  focus: CoordinatorCalendarFocus,
  eventDate: string | undefined,
): CoordinatorCalendarItem[] {
  const tasks = focus.tasks.flatMap((task): CoordinatorCalendarItem[] =>
    task.dueAt && !CLOSED_TASK_STATUSES.includes(task.status)
      ? [{ id: `task:${task.id}`, date: manilaCalendarKey(task.dueAt), startTime: manilaClockKey(task.dueAt), title: task.title, detail: `${event.eventName} · task due`, kind: "task", eventId: event.id, view: "tasks" }]
      : [],
  );
  const days = focus.days
    .filter((day) => day.dayDate !== eventDate)
    .map((day): CoordinatorCalendarItem => ({ id: `day:${day.id}`, date: day.dayDate, title: day.label || "Event-day schedule", detail: event.eventName, kind: "schedule_day", eventId: event.id, view: "run-sheet" }));
  return [...tasks, ...days];
}

/**
 * Every dated entry on the coordinator's calendar: the day of each event they are assigned to, plus the open
 * event's task deadlines and its other schedule days (load-in, load-out). The event day itself is not repeated
 * as a schedule day.
 */
export function buildCoordinatorCalendarItems(
  events: Array<Pick<PrismEvent, "id" | "eventName" | "eventDate">>,
  focus: CoordinatorCalendarFocus | null,
): CoordinatorCalendarItem[] {
  const eventDates = new Map<string, string>();
  const items: CoordinatorCalendarItem[] = [];
  for (const event of events) {
    const date = eventDateKey(event.eventDate);
    if (!date) continue;
    eventDates.set(event.id, date);
    items.push({ id: `event:${event.id}`, date, title: event.eventName, detail: "Event day", kind: "event", eventId: event.id, view: "shift" });
  }

  const focused = focus ? events.find((event) => event.id === focus.eventId) : undefined;
  if (focus && focused) items.push(...focusedEventItems(focused, focus, eventDates.get(focused.id)));

  return items.sort((a, b) => a.date.localeCompare(b.date) || (a.startTime ?? "").localeCompare(b.startTime ?? "") || a.id.localeCompare(b.id));
}
