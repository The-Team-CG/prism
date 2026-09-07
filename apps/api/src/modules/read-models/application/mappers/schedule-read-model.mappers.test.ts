import { describe, expect, it } from 'vitest';
import type { PrismEventSchedule } from '@prism/types';
import { deriveLiveOpsTimer } from './schedule-read-model.mappers';

const schedule: PrismEventSchedule = { eventId: 'evt_1', authored: true, serverTime: '2026-09-08T00:00:00.000Z', days: [{ id: 'day_1', eventId: 'evt_1', dayDate: '2026-09-08', label: 'Day 1', status: 'planned', segments: [{ id: 'seg_1', dayId: 'day_1', sequence: 0, title: 'Ingress', plannedStartAt: '2026-09-08T09:00:00.000Z', plannedEndAt: '2026-09-08T10:00:00.000Z', ownerRole: 'Production', location: 'Venue', status: 'planned', actualStartedAt: null, actualEndedAt: null, startVarianceMinutes: null, endVarianceMinutes: null }] }] };

describe('deriveLiveOpsTimer', () => {
  it('returns an explicit no-schedule state', () => expect(deriveLiveOpsTimer({ ...schedule, authored: false, days: [] }, new Date('2026-09-08T08:00:00.000Z'))).toMatchObject({ status: 'no_schedule', label: 'No schedule authored' }));
  it('computes a deterministic countdown before the first segment', () => expect(deriveLiveOpsTimer(schedule, new Date('2026-09-08T08:30:00.000Z'))).toMatchObject({ status: 'before_start', secondsRemaining: 1800, segmentId: 'seg_1' }));
  it('uses actual start and end when present', () => expect(deriveLiveOpsTimer({ ...schedule, days: [{ ...schedule.days[0], segments: [{ ...schedule.days[0].segments[0], status: 'active', actualStartedAt: '2026-09-08T09:10:00.000Z', actualEndedAt: null }] }] }, new Date('2026-09-08T09:15:00.000Z'))).toMatchObject({ status: 'active', secondsElapsed: 300, secondsRemaining: 2700 }));
});
