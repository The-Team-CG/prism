import { describe, expect, it } from 'vitest';
import { isReadinessRequestDue, readinessRequestDueAt } from './supplier-readiness-request-policy';

// Event dates are stored as the Philippine day at UTC midnight: 20 Nov 2026 begins at 19 Nov 16:00 UTC.
const eventDate = new Date('2026-11-20T00:00:00.000Z');

describe('supplier readiness request window', () => {
  it('becomes due at the Philippine midnight seven days before the event day', () => {
    expect(readinessRequestDueAt(eventDate).toISOString()).toBe('2026-11-12T16:00:00.000Z');
    expect(isReadinessRequestDue(eventDate, new Date('2026-11-12T15:59:59.999Z'))).toBe(false);
    expect(isReadinessRequestDue(eventDate, new Date('2026-11-12T16:00:00.000Z'))).toBe(true);
  });

  it('stops being due once the event day has begun in Philippine time', () => {
    expect(isReadinessRequestDue(eventDate, new Date('2026-11-19T15:59:59.999Z'))).toBe(true);
    expect(isReadinessRequestDue(eventDate, new Date('2026-11-19T16:00:00.000Z'))).toBe(false);
  });
});
