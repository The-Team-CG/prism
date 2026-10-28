import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapEvent } from './pmcm-read-model.mappers';

const dependencies = {
  guestReader: { guestAccessCode: () => 'GUEST-1' },
  floorplanReader: { mapFloorPlanDraft: (draft: unknown) => draft },
} as never;

const event = {
  id: 'evt_1',
  inquiryId: 'inq_1',
  clientName: 'Client',
  eventName: 'Gala',
  eventDate: new Date('2026-09-08T00:00:00.000Z'),
  status: 'event_day',
  clientPortalStatus: 'unlocked',
  readiness: 'ready',
  archived: false,
  floorPlanStatus: 'approved',
  floorPlanId: null,
  floorPlanDrafts: [],
};

describe('PMCM mapEvent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-09T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('exposes the recorded actual end so PMCM closure can correct it, without the recording staff id', () => {
    const mapped = mapEvent({ ...event, actualEndedAt: new Date('2026-09-08T22:00:00.000Z'), actualEndedBy: 'usr_pmcm' } as never, dependencies);
    expect(mapped).toMatchObject({ actualEndedAt: '2026-09-08T22:00:00.000Z' });
    // This mapper serves every actor, including clients; the PMCM user id stays internal.
    expect(mapped).not.toHaveProperty('actualEndedBy');
    expect(mapEvent({ ...event, actualEndedAt: null, actualEndedBy: null } as never, dependencies)).toMatchObject({ actualEndedAt: null });
  });
});
