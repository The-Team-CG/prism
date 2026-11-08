import { prismEventDayStart } from '@prism/types';

/** New-SUP2: suppliers are asked to confirm readiness this many days before the event day. */
export const READINESS_REQUEST_DAYS_BEFORE_EVENT = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Philippine-midnight moment a readiness request becomes due for an event. */
export function readinessRequestDueAt(eventDate: Date): Date {
  return new Date(prismEventDayStart(eventDate).getTime() - READINESS_REQUEST_DAYS_BEFORE_EVENT * DAY_MS);
}

/**
 * Due from seven days before the event day begins (Philippine time) until it begins. A booking confirmed
 * later still gets its request at once; the outbox idempotency key keeps it to one per booking.
 */
export function isReadinessRequestDue(eventDate: Date, now: Date): boolean {
  const dueAt = readinessRequestDueAt(eventDate).getTime();
  return now.getTime() >= dueAt && now.getTime() < prismEventDayStart(eventDate).getTime();
}
