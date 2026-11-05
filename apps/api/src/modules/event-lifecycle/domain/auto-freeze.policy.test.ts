import { describe, expect, it } from 'vitest';
import { automaticFreezeAt, isDueForAutomaticFreeze } from './auto-freeze.policy';

const eventDate = new Date('2026-10-10T00:00:00.000Z');
const base = { eventDate, freezeStatus: 'open', archived: false, actualEndedAt: null as Date | null };

describe('automatic scope freeze', () => {
  it('is due exactly five days before the event day starts and stays due through the event day', () => {
    expect(automaticFreezeAt(eventDate).toISOString()).toBe('2026-10-05T00:00:00.000Z');
    const due = (iso: string) => isDueForAutomaticFreeze(base, new Date(iso));
    expect(due('2026-10-04T23:59:59.000Z')).toBe(false);
    expect(due('2026-10-05T00:00:00.000Z')).toBe(true);
    expect(due('2026-10-10T12:00:00.000Z')).toBe(true);
  });

  it('never freezes an event that is already frozen, archived, ended or past its event day', () => {
    const now = new Date('2026-10-08T00:00:00.000Z');
    expect(isDueForAutomaticFreeze({ ...base, freezeStatus: 'frozen' }, now)).toBe(false);
    expect(isDueForAutomaticFreeze({ ...base, archived: true }, now)).toBe(false);
    expect(isDueForAutomaticFreeze({ ...base, actualEndedAt: new Date('2026-10-07T00:00:00.000Z') }, now)).toBe(false);
    expect(isDueForAutomaticFreeze(base, new Date('2026-10-11T00:00:00.000Z'))).toBe(false);
  });
});
