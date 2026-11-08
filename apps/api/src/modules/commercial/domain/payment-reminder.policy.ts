/** FR-92: advance payment reminders, in days before the due date. Operators set PAYMENT_REMINDER_DAYS_BEFORE, e.g. "7,3,1". */
export const DEFAULT_PAYMENT_REMINDER_DAYS_BEFORE = [7, 3, 1] as const;
const DAY_MS = 86_400_000;

export function parsePaymentReminderDays(raw: string | undefined): number[] {
  if (!raw?.trim()) return [...DEFAULT_PAYMENT_REMINDER_DAYS_BEFORE];
  const days = raw.split(',').map((value) => Number(value.trim()));
  if (days.length === 0 || days.some((day) => !Number.isInteger(day) || day < 1 || day > 60)) {
    throw new Error(`PAYMENT_REMINDER_DAYS_BEFORE must list whole days from 1 to 60, for example "7,3,1"; got "${raw}"`);
  }
  return [...new Set(days)].sort((a, b) => b - a);
}

/**
 * The reminder threshold a milestone has reached: the smallest configured day count that is at least the
 * days left. A sweep that missed earlier thresholds sends only the nearest one. Past-due milestones get none
 * here; the overdue reminder covers them.
 */
export function reachedReminderThreshold(dueDate: Date, now: Date, daysBefore: readonly number[]): number | null {
  const msLeft = dueDate.getTime() - now.getTime();
  if (msLeft < 0) return null;
  const daysLeft = Math.ceil(msLeft / DAY_MS);
  const reached = daysBefore.filter((day) => daysLeft <= day);
  return reached.length ? Math.min(...reached) : null;
}
