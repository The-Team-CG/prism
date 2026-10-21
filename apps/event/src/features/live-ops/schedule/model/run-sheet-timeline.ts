import type { PrismRunSheetEntry, PrismRunSheetEntryKind } from "@prism/types";

export type RunSheetTimelineRow = PrismRunSheetEntry & {
  /** Planned item whose time has passed without it starting, or an open task past due. */
  overdue: boolean;
  past: boolean;
};

export type RunSheetTimeline = {
  rows: RunSheetTimelineRow[];
  /** Index of the first row after "now"; the now marker renders before it. Equals rows.length when every row is past. */
  nowIndex: number;
};

export const RUN_SHEET_KIND_LABELS: Record<PrismRunSheetEntryKind, string> = {
  segment: "Program",
  ingress: "Supplier ingress",
  egress: "Supplier egress",
  task_due: "Task due",
  issue: "Open issue",
};

const NOT_STARTED = new Set(["planned", "open", "assigned", "pending"]);

/** Annotates server-ordered entries against the current time. Does not reorder. */
export function buildRunSheetTimeline(entries: PrismRunSheetEntry[], now: Date): RunSheetTimeline {
  const nowMs = now.getTime();
  const rows = entries.map((entry) => {
    const startMs = Date.parse(entry.at);
    const past = startMs <= nowMs;
    const overdue = past && (
      entry.kind === "task_due"
      || ((entry.kind === "segment" || entry.kind === "ingress" || entry.kind === "egress") && NOT_STARTED.has(entry.status))
    );
    return { ...entry, past, overdue };
  });
  const firstUpcoming = rows.findIndex((row) => !row.past);
  return { rows, nowIndex: firstUpcoming === -1 ? rows.length : firstUpcoming };
}

export function formatRunSheetTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatRunSheetDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

/** PMCM print-friendly run sheet route for the selected event. */
export function eventRunSheetHref(eventId: string) {
  return `/dashboard/events/${encodeURIComponent(eventId)}/run-sheet`;
}
