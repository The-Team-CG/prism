import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { automaticFreezeAt, isDueForAutomaticFreeze } from './auto-freeze.policy';

describe('automatic scope freeze', () => {
  const eventDate = new Date('2026-10-10T00:00:00.000Z');
  const base = { eventDate, freezeStatus: 'open', archived: false, actualEndedAt: null as Date | null };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('is due at midnight Manila five days before the event day and stays due through that Manila day', () => {
    // 10 Oct is stored as 10 Oct 00:00 UTC; Manila midnight on 5 Oct is 4 Oct 16:00 UTC.
    expect(automaticFreezeAt(eventDate).toISOString()).toBe('2026-10-04T16:00:00.000Z');
    const due = (iso: string) => isDueForAutomaticFreeze(base, new Date(iso));
    expect(due('2026-10-04T15:59:59.000Z')).toBe(false);
    expect(due('2026-10-04T16:00:00.000Z')).toBe(true);
    expect(due('2026-10-10T12:00:00.000Z')).toBe(true);
    // The Manila event day runs until 10 Oct 16:00 UTC.
    expect(due('2026-10-10T15:59:59.000Z')).toBe(true);
    expect(due('2026-10-10T16:00:00.000Z')).toBe(false);
  });

  it('never freezes an event that is already frozen, archived, ended or past its event day', () => {
    const now = new Date('2026-10-08T00:00:00.000Z');
    expect(isDueForAutomaticFreeze({ ...base, freezeStatus: 'frozen' }, now)).toBe(false);
    expect(isDueForAutomaticFreeze({ ...base, archived: true }, now)).toBe(false);
    expect(isDueForAutomaticFreeze({ ...base, actualEndedAt: new Date('2026-10-07T00:00:00.000Z') }, now)).toBe(false);
    expect(isDueForAutomaticFreeze(base, new Date('2026-10-11T00:00:00.000Z'))).toBe(false);
  });
});
