import { WRAP_UP_WINDOW_HOURS } from "@prism/types";

export type DeadlineTone = "open" | "soon" | "overdue";

export interface DeadlineCountdown {
  label: string;
  tone: DeadlineTone;
}

const MINUTE_MS = 60 * 1000;
const SOON_HOURS = 6;

function span(ms: number): string {
  const totalMinutes = Math.max(0, Math.floor(ms / MINUTE_MS));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

/** The wrap-up window closes this long after the recorded actual end of the event. */
export function wrapUpDeadline(actualEndedAt: string | Date | null | undefined): Date | null {
  if (!actualEndedAt) return null;
  const ended = new Date(actualEndedAt).getTime();
  return Number.isNaN(ended) ? null : new Date(ended + WRAP_UP_WINDOW_HOURS * 60 * MINUTE_MS);
}

/** What the post-event documents are racing against: time left, or how late they are. Null before the event has ended. */
export function wrapUpDeadlineCountdown(actualEndedAt: string | Date | null | undefined, now: Date): DeadlineCountdown | null {
  const deadline = wrapUpDeadline(actualEndedAt);
  if (!deadline) return null;
  const remaining = deadline.getTime() - now.getTime();
  if (remaining < 0) return { label: `Overdue by ${span(-remaining)}`, tone: "overdue" };
  return { label: `Due in ${span(remaining)}`, tone: remaining < SOON_HOURS * 60 * MINUTE_MS ? "soon" : "open" };
}
