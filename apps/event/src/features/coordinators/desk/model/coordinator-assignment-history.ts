import type { PrismCoordinatorAssignment, PrismEvent } from "@prism/types";
import { isActiveCoordinatorAssignmentStatus } from "@prism/types";
import { formatPortalDate } from "@prism/ui/format-date";
import type { ShiftTone } from "./coordinator-shift";

export type AssignmentHistoryRow = {
  assignment: PrismCoordinatorAssignment;
  eventName: string;
  /** The event's calendar day (YYYY-MM-DD), or null when neither the assignment nor the event has one. */
  dateKey: string | null;
  outcome: string;
  tone: ShiftTone;
};

export type AssignmentHistory = {
  upcoming: AssignmentHistoryRow[];
  past: { year: string; rows: AssignmentHistoryRow[] }[];
  record: { worked: number; present: number; late: number; absent: number; upcoming: number };
};

const ENDED: Record<string, { outcome: string; tone: ShiftTone }> = {
  replaced: { outcome: "Replaced", tone: "neutral" },
  declined: { outcome: "Declined", tone: "neutral" },
  cancelled: { outcome: "Cancelled by PMCM", tone: "neutral" },
};

const ATTENDED: Record<string, { outcome: string; tone: ShiftTone }> = {
  present: { outcome: "Present", tone: "done" },
  late: { outcome: "Late arrival", tone: "attention" },
  absent: { outcome: "Absent", tone: "urgent" },
};

function pastOutcome(assignment: PrismCoordinatorAssignment): { outcome: string; tone: ShiftTone } {
  if (assignment.withdrawnAt) return { outcome: "Withdrew", tone: "neutral" };
  return ENDED[assignment.status] ?? ATTENDED[assignment.attendanceStatus ?? ""] ?? { outcome: "Attendance not recorded", tone: "neutral" };
}

function upcomingOutcome(assignment: PrismCoordinatorAssignment): { outcome: string; tone: ShiftTone } {
  return assignment.status === "acknowledged" ? { outcome: "Confirmed", tone: "done" } : { outcome: "Needs your confirmation", tone: "attention" };
}

function eventLabel(event: PrismEvent | undefined, dateKey: string | null): string {
  if (event?.eventName) return event.eventName;
  return dateKey ? `Event on ${formatPortalDate(dateKey)}` : "Event";
}

/**
 * A coordinator's assignments as they read them: what is coming up (soonest first, with whether they have confirmed),
 * then past events by year (newest first, with how attendance was recorded), and the record those add up to.
 */
export function coordinatorAssignmentHistory(assignments: PrismCoordinatorAssignment[], events: PrismEvent[], todayKey: string): AssignmentHistory {
  const eventsById = new Map(events.map((event) => [event.id, event]));
  const upcoming: AssignmentHistoryRow[] = [];
  const past: AssignmentHistoryRow[] = [];
  for (const assignment of assignments) {
    const event = eventsById.get(assignment.eventId);
    const dateKey = (assignment.eventDate ?? event?.eventDate)?.slice(0, 10) ?? null;
    const ahead = dateKey !== null && dateKey >= todayKey && isActiveCoordinatorAssignmentStatus(assignment.status) && !assignment.withdrawnAt;
    const row = { assignment, eventName: eventLabel(event, dateKey), dateKey, ...(ahead ? upcomingOutcome(assignment) : pastOutcome(assignment)) };
    (ahead ? upcoming : past).push(row);
  }
  upcoming.sort((left, right) => (left.dateKey ?? "").localeCompare(right.dateKey ?? ""));
  past.sort((left, right) => (right.dateKey ?? "").localeCompare(left.dateKey ?? ""));
  const years = new Map<string, AssignmentHistoryRow[]>();
  for (const row of past) {
    const year = row.dateKey?.slice(0, 4) ?? "Undated";
    years.set(year, [...(years.get(year) ?? []), row]);
  }
  const attended = (status: string) => past.filter((row) => row.assignment.attendanceStatus === status && !ENDED[row.assignment.status]).length;
  return {
    upcoming,
    past: [...years].map(([year, rows]) => ({ year, rows })),
    record: {
      worked: past.filter((row) => isActiveCoordinatorAssignmentStatus(row.assignment.status) && !row.assignment.withdrawnAt).length,
      present: attended("present"),
      late: attended("late"),
      absent: attended("absent"),
      upcoming: upcoming.length,
    },
  };
}
