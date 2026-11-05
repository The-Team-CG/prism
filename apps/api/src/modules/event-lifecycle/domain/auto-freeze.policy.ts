/** Catalog rule: event scope freezes automatically this many days before the event day. */
export const AUTO_FREEZE_DAYS_BEFORE_EVENT = 5;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The moment an open event is due to freeze: the start of its event day (UTC, as event dates are whole days) minus five days. */
export function automaticFreezeAt(eventDate: Date): Date {
  return new Date(eventDate.getTime() - AUTO_FREEZE_DAYS_BEFORE_EVENT * DAY_MS);
}

/**
 * An event freezes on its own once the freeze moment has passed, while it is still open, live and not over.
 * Manually frozen events are left alone, and an event that already ended or was archived never freezes retroactively.
 */
export function isDueForAutomaticFreeze(
  event: { eventDate: Date; freezeStatus: string; archived: boolean; actualEndedAt: Date | null },
  now: Date,
): boolean {
  if (event.freezeStatus !== 'open' || event.archived || event.actualEndedAt) return false;
  return now.getTime() >= automaticFreezeAt(event.eventDate).getTime() && now.getTime() < event.eventDate.getTime() + DAY_MS;
}
