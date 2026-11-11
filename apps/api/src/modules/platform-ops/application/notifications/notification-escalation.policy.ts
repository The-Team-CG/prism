const HOUR_MS = 60 * 60_000;
const DEFAULT_SECOND_ESCALATION_HOURS = 24;
const MAX_SECOND_ESCALATION_HOURS = 24 * 30;

/**
 * How long after the first escalation a recipient who still has not acknowledged is chased once more, in milliseconds.
 * Whole hours, 1 to 720 (30 days); anything else falls back to 24 hours, so a typo can never switch the chase off or
 * make it fire on every sweep.
 */
export function secondEscalationWindowMs(raw: string | undefined): number {
  const hours = Number(raw?.trim());
  const valid = Number.isInteger(hours) && hours >= 1 && hours <= MAX_SECOND_ESCALATION_HOURS;
  return (valid ? hours : DEFAULT_SECOND_ESCALATION_HOURS) * HOUR_MS;
}
