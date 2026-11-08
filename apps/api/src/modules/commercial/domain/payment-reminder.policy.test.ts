import { describe, expect, it } from 'vitest';
import { parsePaymentReminderDays, reachedReminderThreshold } from './payment-reminder.policy';

const NOW = new Date('2026-11-10T00:00:00.000Z');
const due = (days: number) => new Date(NOW.getTime() + days * 86_400_000);

describe('FR-92 payment reminder intervals', () => {
  it('parses operator intervals, defaults to 7, 3 and 1 days, and refuses nonsense', () => {
    expect(parsePaymentReminderDays(undefined)).toEqual([7, 3, 1]);
    expect(parsePaymentReminderDays('3, 14,3')).toEqual([14, 3]);
    expect(() => parsePaymentReminderDays('7,0')).toThrow('PAYMENT_REMINDER_DAYS_BEFORE');
  });

  it('reports the nearest threshold reached and nothing before the first or after the due date', () => {
    expect(reachedReminderThreshold(due(10), NOW, [7, 3, 1])).toBeNull();
    expect(reachedReminderThreshold(due(7), NOW, [7, 3, 1])).toBe(7);
    expect(reachedReminderThreshold(due(2), NOW, [7, 3, 1])).toBe(3);
    expect(reachedReminderThreshold(due(0.5), NOW, [7, 3, 1])).toBe(1);
    expect(reachedReminderThreshold(due(-1), NOW, [7, 3, 1])).toBeNull();
  });
});
