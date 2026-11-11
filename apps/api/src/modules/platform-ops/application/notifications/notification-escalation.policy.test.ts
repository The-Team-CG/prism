import { describe, expect, it } from 'vitest';
import { secondEscalationWindowMs } from './notification-escalation.policy';

const hours = (count: number) => count * 60 * 60_000;

describe('second escalation window', () => {
  it('uses a whole number of hours from 1 to 720', () => {
    expect(secondEscalationWindowMs('6')).toBe(hours(6));
    expect(secondEscalationWindowMs(' 48 ')).toBe(hours(48));
    expect(secondEscalationWindowMs('1')).toBe(hours(1));
    expect(secondEscalationWindowMs('720')).toBe(hours(720));
  });

  it('falls back to 24 hours for anything that could switch the chase off or fire it on every sweep', () => {
    for (const bad of [undefined, '', 'soon', '0', '-3', '1.5', '721', 'Infinity', 'NaN']) {
      expect(secondEscalationWindowMs(bad)).toBe(hours(24));
    }
  });
});
