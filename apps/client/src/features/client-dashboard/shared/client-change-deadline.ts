import { daysUntil, manilaCalendarKey } from "@prism/ui/format-date";
import type { PrismEvent } from "@prism/types";

/** Inside this many days the change cutoff is shown as a warning rather than a plain note. */
export const CHANGE_DEADLINE_WARNING_DAYS = 14;

export type ClientChangeDeadline =
  | { kind: "open"; deadlineAt: string; daysLeft: number; soon: boolean }
  | { kind: "closed" };

/**
 * Where the client stands on changing the event: before PMCM's cutoff they can request changes freely; once the
 * event is frozen, or the cutoff has passed, a change needs a PMCM exception. No cutoff and not frozen: nothing to say.
 */
export function clientChangeDeadline(
  event: Pick<PrismEvent, "freezeStatus" | "freezeDeadlineAt" | "archived">,
  todayKey: string,
): ClientChangeDeadline | null {
  if (event.archived) return null;
  if (event.freezeStatus === "frozen") return { kind: "closed" };
  if (!event.freezeDeadlineAt) return null;
  const daysLeft = daysUntil(manilaCalendarKey(event.freezeDeadlineAt), todayKey);
  if (daysLeft === null) return null;
  if (daysLeft < 0) return { kind: "closed" };
  return { kind: "open", deadlineAt: event.freezeDeadlineAt, daysLeft, soon: daysLeft <= CHANGE_DEADLINE_WARNING_DAYS };
}
