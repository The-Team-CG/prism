import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapComplianceCheck, mapEvent } from './pmcm-read-model.mappers';

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

  it('returns the full compliance contract so closure can show evidence, with safe defaults for older runs', () => {
    const base = { id: 'chk_1', eventId: 'evt_1', layer: 'Must-Fix', title: 'Venue permit', status: 'open', note: 'Upload the permit' };
    expect(mapComplianceCheck({ ...base, evaluationStatus: 'satisfied', evidence: ['permit.pdf', ' ', 7], definitionStatus: 'DERIVED', remediation: 'Done', runId: 'run_1' } as never))
      .toMatchObject({ evaluationStatus: 'satisfied', evidence: ['permit.pdf'], definitionStatus: 'DERIVED', remediation: 'Done', runId: 'run_1' });
    expect(mapComplianceCheck(base as never))
      .toMatchObject({ evaluationStatus: 'not_satisfied', evidence: [], definitionStatus: 'PROVISIONAL', remediation: 'Upload the permit', runId: null });
  });
});
