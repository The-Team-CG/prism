import { describe, expect, it } from 'vitest';
import {
  buildPmcmSupplierReadinessItem,
  buildSupplierReadinessItem,
  type SupplierReadinessRequestSource,
  type SupplierReadinessScheduleSource,
} from './event-read-models.supplier-readiness';

const now = new Date('2026-10-02T08:00:00.000Z');
const clock = { now, ingressLateGraceMinutes: 15 };
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000);

function schedule(overrides: Partial<SupplierReadinessScheduleSource> = {}): SupplierReadinessScheduleSource {
  return {
    ingressAt: new Date('2026-10-02T12:00:00.000Z'),
    egressAt: new Date('2026-10-02T23:00:00.000Z'),
    location: 'Loading bay B',
    status: 'planned',
    revision: 2,
    acknowledgedRevision: 2,
    acknowledgedAt: new Date('2026-09-30T00:00:00.000Z'),
    changeRequestNote: null,
    changeRequestedAt: null,
    ...overrides,
  };
}

function request(overrides: Partial<SupplierReadinessRequestSource> = {}): SupplierReadinessRequestSource {
  return {
    id: 'qr_sonic',
    eventId: 'evt_1',
    supplierId: 'sup_sonic',
    supplierName: 'Sonic Line',
    category: 'Technicals',
    status: 'selected',
    dueDate: null,
    assignmentStatus: 'confirmed',
    readinessStatus: 'confirmed',
    readinessNotes: 'Crew of six',
    eventDayStatus: 'not_started',
    eventDayStatusAt: null,
    eventDayNotes: '',
    eventDayVerificationStatus: 'self_reported',
    eventDayVerifiedAt: null,
    eventDayVerifiedBy: null,
    eventDayVerificationNotes: '',
    contractVersions: [{ reviewStatus: 'accepted', reviewReason: null, reviewedAt: null }],
    schedule: schedule(),
    ...overrides,
  };
}

const event = { eventName: 'Ayala Summit', clientName: 'Ana Reyes' };

describe('supplier readiness item builder', () => {
  it('reports schedule window and acknowledgment for a fully ready assignment', () => {
    const item = buildSupplierReadinessItem(request(), event, clock);

    expect(item).toMatchObject({
      supplierName: 'Sonic Line',
      eventName: 'Ayala Summit',
      priority: 'info',
      ingressLate: false,
      setupStatus: 'not_started',
      concerns: [],
      schedule: {
        ingressAt: '2026-10-02T12:00:00.000Z',
        egressAt: '2026-10-02T23:00:00.000Z',
        location: 'Loading bay B',
        revision: 2,
        acknowledged: true,
      },
    });
  });

  it.each([
    ['ingress inside the grace window', request({ schedule: schedule({ ingressAt: minutesAgo(10) }) }), false],
    ['ingress past the grace window', request({ schedule: schedule({ ingressAt: minutesAgo(16) }) }), true],
    ['sweep already marked late', request({ eventDayStatus: 'late', schedule: schedule({ ingressAt: minutesAgo(60) }) }), true],
    ['supplier already arrived', request({ eventDayStatus: 'arrived', schedule: schedule({ ingressAt: minutesAgo(60) }) }), false],
    ['assignment not confirmed', request({ assignmentStatus: 'pending_confirmation', schedule: schedule({ ingressAt: minutesAgo(60) }) }), false],
    ['schedule no longer planned', request({ schedule: schedule({ status: 'cancelled', ingressAt: minutesAgo(60) }) }), false],
    ['no schedule', request({ schedule: null }), false],
  ])('applies the late-ingress sweep rule: %s', (_label, source, late) => {
    const item = buildSupplierReadinessItem(source, event, clock);
    expect(item.ingressLate).toBe(late);
    if (late) expect(item).toMatchObject({ priority: 'critical', setupStatus: 'late' });
  });

  it.each([
    ['arrived', 'arrived'],
    ['set_up_ready', 'ready'],
    ['done_leaving', 'complete'],
  ])('derives setup status from event-day status %s', (eventDayStatus, setupStatus) => {
    expect(buildSupplierReadinessItem(request({ eventDayStatus }), event, clock).setupStatus).toBe(setupStatus);
  });

  it('lists open schedule change requests, contract corrections, and supplier event-day notes as concerns', () => {
    const item = buildSupplierReadinessItem(
      request({
        eventDayNotes: 'Generator arriving 20 minutes late',
        eventDayStatusAt: new Date('2026-10-02T07:00:00.000Z'),
        contractVersions: [{ reviewStatus: 'changes_requested', reviewReason: 'Missing insurance page', reviewedAt: new Date('2026-09-29T00:00:00.000Z') }],
        schedule: schedule({
          acknowledgedRevision: null,
          changeRequestNote: 'Need ingress at 10:00',
          changeRequestedAt: new Date('2026-09-30T05:00:00.000Z'),
        }),
      }),
      event,
      clock,
    );

    expect(item.schedule).toMatchObject({ acknowledged: false, changeRequestNote: 'Need ingress at 10:00' });
    expect(item.contractStatus).toBe('changes_requested');
    expect(item.priority).toBe('warning');
    expect(item.concerns).toEqual([
      { kind: 'schedule_change_request', message: 'Need ingress at 10:00', at: '2026-09-30T05:00:00.000Z' },
      { kind: 'contract_correction', message: 'Missing insurance page', at: '2026-09-29T00:00:00.000Z' },
      { kind: 'event_day_note', message: 'Generator arriving 20 minutes late', at: '2026-10-02T07:00:00.000Z' },
    ]);
  });

  it('raises attention when an otherwise ready supplier has not acknowledged the current schedule revision', () => {
    const item = buildSupplierReadinessItem(request({ schedule: schedule({ acknowledgedRevision: 1 }) }), event, clock);
    expect(item).toMatchObject({ priority: 'attention', concerns: [] });
  });

  it('keeps PMCM verification notes and reviewer identity out of the supplier projection only', () => {
    const source = request({
      eventDayVerificationStatus: 'rejected',
      eventDayVerificationNotes: 'PMCM-SENTINEL-verification',
      eventDayVerifiedBy: 'PMCM-SENTINEL-verifier',
      eventDayVerifiedAt: new Date('2026-10-02T07:30:00.000Z'),
    });

    const supplierItem = buildSupplierReadinessItem(source, event, clock);
    const pmcmItem = buildPmcmSupplierReadinessItem(source, event, clock);

    expect(JSON.stringify(supplierItem)).not.toContain('PMCM-SENTINEL');
    expect(supplierItem).not.toHaveProperty('pmcmReview');
    expect(supplierItem).toMatchObject({ verificationStatus: 'rejected', priority: 'attention' });
    expect(pmcmItem).toMatchObject({
      ...supplierItem,
      quoteLocked: true,
      pmcmReview: {
        verificationNotes: 'PMCM-SENTINEL-verification',
        verifiedBy: 'PMCM-SENTINEL-verifier',
        verifiedAt: '2026-10-02T07:30:00.000Z',
        readinessNotes: 'Crew of six',
      },
    });
  });
});
