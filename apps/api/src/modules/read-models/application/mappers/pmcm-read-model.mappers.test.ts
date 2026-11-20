import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mapComplianceCheck, mapEvent } from './pmcm-read-model.mappers';
import { derivePrismLifecycleStage } from '@prism/types';
import { mapBillingEvent } from './billing-read-model.mappers';

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

  it.each([['approved', 'planning'], ['pending', 'briefing_proposal']])('keeps the portal lifecycle stage for a %s client proposal', (proposalClientStatus, stage) => {
    const input = { ...event, status: 'planning', proposalClientStatus, actualEndedAt: null } as never;
    for (const mapped of [mapEvent(input, dependencies), mapBillingEvent(input)]) {
      expect(derivePrismLifecycleStage(mapped)).toBe(stage);
    }
  });

  it('gives the client the change cutoff: the automatic freeze for an open event, the recorded deadline once frozen, none without a confirmed date', () => {
    const open = { ...event, status: 'planning', freezeStatus: 'open', freezeDeadlineAt: null } as never;
    // 8 Sep in Manila begins 7 Sep 16:00 UTC; scope freezes five days earlier.
    expect(mapBillingEvent(open).freezeDeadlineAt).toBe('2026-09-02T16:00:00.000Z');
    expect(mapBillingEvent({ ...event, freezeStatus: 'frozen', freezeDeadlineAt: new Date('2026-09-01T00:00:00.000Z') } as never).freezeDeadlineAt).toBe('2026-09-01T00:00:00.000Z');
    expect(mapBillingEvent({ ...event, status: 'date_to_be_confirmed', freezeStatus: 'open', freezeDeadlineAt: null } as never).freezeDeadlineAt).toBeNull();
    expect(mapBillingEvent({ ...event, status: 'cancelled', freezeStatus: 'open', freezeDeadlineAt: null } as never).freezeDeadlineAt).toBeNull();
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
