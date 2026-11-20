import { PRISM_AUTO_FREEZE_DAYS_BEFORE_EVENT, isPrismEventDateConfirmed, prismAutomaticFreezeAt as automaticFreezeAt, prismEventDayStart } from '@prism/types';

export { automaticFreezeAt };

/** Catalog rule: event scope freezes automatically this many days before the event day. */
export const AUTO_FREEZE_DAYS_BEFORE_EVENT = PRISM_AUTO_FREEZE_DAYS_BEFORE_EVENT;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * An event freezes on its own once the freeze moment has passed, while it is still open, live and not over.
 * Manually frozen events are left alone, and an event that already ended or was archived never freezes retroactively.
 * A cancelled event, or one whose date is still to be confirmed, has no event day to freeze toward.
 */
export function isDueForAutomaticFreeze(
  event: { eventDate: Date; freezeStatus: string; archived: boolean; actualEndedAt: Date | null; status: string },
  now: Date,
): boolean {
  if (event.freezeStatus !== 'open' || event.archived || event.actualEndedAt) return false;
  if (event.status === 'cancelled' || !isPrismEventDateConfirmed(event)) return false;
  return now.getTime() >= automaticFreezeAt(event.eventDate).getTime() && now.getTime() < prismEventDayStart(event.eventDate).getTime() + DAY_MS;
}
