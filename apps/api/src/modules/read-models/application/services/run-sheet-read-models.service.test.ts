import 'reflect-metadata';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type {
  OpsCoordinatorAssignment,
  OpsEvent,
  OpsEventDayTask,
  OpsEventScheduleDay,
  OpsEventScheduleSegment,
  OpsFloorPlanDraft,
  OpsSupplierQuoteRequest,
  OpsUrgentIssue,
} from '@prisma/client';
import type { PrismEventRunSheet, PrismEventRunSheetResult, PrismGuestCheckIn } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { EventAccessPolicyService, ResolvedEventOpsActor } from '@prism/kernel/access-control';
import type { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import type { GuestReader, StaffingReader } from '@prism/contexts/operations';
import type { EventReadModelQueries } from '../queries/event-read-models.queries';
import { LiveOpsReadModelsService } from './live-ops-read-models.service';
import { RunSheetReadModelsService } from './run-sheet-read-models.service';

const EVENT_ID = 'evt_run_sheet';
const CREATED_AT = new Date('2026-08-01T09:00:00.000Z');
const ALLOWED_ROLES: string[] = [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator];
const at = (iso: string) => new Date(iso);

function eventFixture() {
  return {
    id: EVENT_ID, inquiryId: 'inq_1', clientName: 'Ana Reyes', eventName: 'Ayala Summit',
    eventDate: at('2026-08-20T00:00:00.000Z'), status: 'live', clientPortalStatus: 'unlocked', readiness: 'ready',
    archived: false, walkInPolicy: 'closed', walkInThreshold: 200, actualEndedAt: null, actualEndedBy: null,
    floorPlanStatus: 'approved', floorPlanId: null, createdAt: CREATED_AT, updatedAt: CREATED_AT, floorPlanDrafts: [],
  } as unknown as OpsEvent & { floorPlanDrafts: OpsFloorPlanDraft[] };
}

function segment(id: string, dayId: string, sequence: number, start: string, end: string, ownerRole = 'Floor Director'): OpsEventScheduleSegment {
  return {
    id, dayId, sequence, title: `${id} title`, plannedStartAt: at(start), plannedEndAt: at(end), ownerRole,
    location: 'Main Hall', status: 'planned', actualStartedAt: null, actualEndedAt: null, createdAt: CREATED_AT, updatedAt: CREATED_AT,
  } as unknown as OpsEventScheduleSegment;
}

function scheduleFixture(): Array<OpsEventScheduleDay & { segments: OpsEventScheduleSegment[] }> {
  const day = (id: string, dayDate: string, segments: OpsEventScheduleSegment[]) => ({
    id, eventId: EVENT_ID, dayDate: at(`${dayDate}T00:00:00.000Z`), label: id === 'day_1' ? 'Main day' : 'Load-out',
    status: 'planned', createdAt: CREATED_AT, updatedAt: CREATED_AT, segments,
  }) as unknown as OpsEventScheduleDay & { segments: OpsEventScheduleSegment[] };
  return [
    // Sequence order intentionally disagrees with time order.
    day('day_1', '2026-08-20', [
      segment('seg_program', 'day_1', 0, '2026-08-20T10:00:00.000Z', '2026-08-20T11:00:00.000Z'),
      segment('seg_doors', 'day_1', 1, '2026-08-20T09:00:00.000Z', '2026-08-20T10:00:00.000Z', 'Registration Staff'),
    ]),
    day('day_2', '2026-08-21', [segment('seg_loadout', 'day_2', 0, '2026-08-21T08:00:00.000Z', '2026-08-21T09:00:00.000Z')]),
  ];
}

function task(id: string, dueAt: string | null, assignedRole: string, status = 'open'): OpsEventDayTask {
  return {
    id, eventId: EVENT_ID, title: `${id} title`, assignedRole, ownerName: '', priority: 'high', status,
    notes: 'Bring radios.', dueAt: dueAt ? at(dueAt) : null, slaDueAt: null, escalationLevel: 'pmcm',
    escalatedAt: null, escalatedBy: null, escalationNotes: 'Escalated to PMCM only.', completedAt: null,
    createdAt: CREATED_AT, updatedAt: CREATED_AT,
  } as unknown as OpsEventDayTask;
}

function issue(id: string, createdAt: string, ownerRole: string, status = 'open'): OpsUrgentIssue {
  return {
    id, eventId: EVENT_ID, title: `${id} title`, description: 'Power interruption near the stage.', severity: 'critical',
    status, affectedArea: 'Main Stage', ownerRole, ownerName: '', resolution: '', openedBy: 'Ms. Mys', slaDueAt: null,
    escalationLevel: 'none', escalatedAt: null, escalatedBy: null, escalationNotes: 'Escalated to PMCM only.',
    resolvedAt: null, createdAt: at(createdAt), updatedAt: at(createdAt),
  } as unknown as OpsUrgentIssue;
}

function supplierRequest(id: string): OpsSupplierQuoteRequest {
  return {
    id, eventId: EVENT_ID, supplierId: `supplier_${id}`, categoryId: 'category_1', supplierName: 'Lights Co', category: 'Technicals',
    message: 'Provide event-day support.', dueDate: null, accessToken: 'secret-quote-token', accessTokenExpiresAt: null,
    accessTokenRevokedAt: null, confidentialBid: true, status: 'selected', assignmentStatus: 'confirmed',
    assignmentConfirmedAt: CREATED_AT, readinessStatus: 'ready', readinessConfirmedAt: CREATED_AT,
    readinessNotes: 'Private readiness note.', eventDayStatus: 'set_up_ready', eventDayStatusAt: CREATED_AT,
    eventDayNotes: 'Private setup note.', eventDayVerificationStatus: 'verified', eventDayVerifiedAt: CREATED_AT,
    eventDayVerifiedBy: 'Ms. Mys', eventDayVerificationNotes: 'Private verification note.', statusPhotoFileName: null,
    contractDocumentId: null, createdAt: CREATED_AT, roundId: null,
  } as unknown as OpsSupplierQuoteRequest;
}

function assignment(role: string, coordinatorName = 'Francis Coordinator'): OpsCoordinatorAssignment {
  return {
    id: `assignment_${role.replace(/\W+/g, '_')}`, eventId: EVENT_ID, coordinatorId: 'coordinator_1', coordinatorName, role,
    status: 'acknowledged', attendanceStatus: 'present', attendanceMarkedAt: CREATED_AT, attendanceNotes: 'Private attendance note.',
    replacedByAssignmentId: null, replacementReason: '', replacedAt: null, replacedBy: null, doubleBookingWarning: false,
    eventDate: at('2026-08-20T00:00:00.000Z'), conflictEventId: null, conflictEventName: null, acknowledgedAt: CREATED_AT,
    acknowledgedBy: 'user_1', acknowledgementReason: null, withdrawalReason: null, withdrawnAt: null, withdrawnBy: null, createdAt: CREATED_AT,
  } as unknown as OpsCoordinatorAssignment;
}

function actor(role: string): ResolvedEventOpsActor {
  return {
    id: 'user_1', role, email: 'francis@pmcm.test',
    name: role === OpsUserRole.Coordinator ? 'Francis Coordinator' : 'Ms. Mys',
    coordinatorId: role === OpsUserRole.Coordinator ? 'coordinator_1' : undefined, explicit: true,
  } as ResolvedEventOpsActor;
}

function createService(input: { assignment?: OpsCoordinatorAssignment | null; operatorDesignated?: boolean; scheduled?: boolean } = {}) {
  const queries = {
    liveOpsForEvent: vi.fn(async () => ({
      event: eventFixture(),
      tasks: [
        task('task_b', '2026-08-20T12:00:00.000Z', 'Logistics Coordinator'),
        task('task_a', '2026-08-20T12:00:00.000Z', 'Logistics Coordinator'),
        task('task_done', '2026-08-20T12:00:00.000Z', 'Logistics Coordinator', 'done'),
        task('task_tomorrow', '2026-08-21T08:30:00.000Z', 'Logistics Coordinator'),
        task('task_undated', null, 'Logistics Coordinator'),
        task('task_audio', '2026-08-20T13:00:00.000Z', 'Audio Lead'),
      ],
      urgentIssues: [
        issue('issue_carried', '2026-08-19T20:00:00.000Z', 'Logistics Coordinator'),
        issue('issue_resolved', '2026-08-20T09:30:00.000Z', 'Logistics Coordinator', 'resolved'),
        issue('issue_audio', '2026-08-20T09:45:00.000Z', 'Audio Lead'),
      ],
      supplierRequests: [supplierRequest('quote_lights')],
      eventDayLogs: [],
      briefing: null,
    })),
    scheduleForEvent: vi.fn(async () => (input.scheduled === false ? [] : scheduleFixture())),
    taskReassignmentRequests: vi.fn(async () => []),
    activeOperatorForCoordinator: vi.fn(async () => (input.operatorDesignated ? { id: 'designation_1' } : null)),
    supplierSchedulesForEvent: vi.fn(async () => [
      { id: 'sched_lights', requestId: 'quote_lights', ingressAt: at('2026-08-20T09:00:00.000Z'), egressAt: at('2026-08-20T18:00:00.000Z'), location: 'Dock B', status: 'planned' },
      { id: 'sched_unknown', requestId: 'quote_not_visible', ingressAt: at('2026-08-20T07:00:00.000Z'), egressAt: at('2026-08-20T19:00:00.000Z'), location: 'Dock A', status: 'planned' },
    ]),
  };
  const policy = {
    requireActorRole: vi.fn(async (current: ResolvedEventOpsActor) => {
      if (!ALLOWED_ROLES.includes(current.role)) throw new ForbiddenException('Role cannot read event-day operations');
    }),
    recordForbiddenAccess: vi.fn(async () => undefined),
    sameText: (left?: string | null, right?: string | null) => Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase()),
  } as unknown as EventAccessPolicyService;
  const guestReader = {
    listCheckInsForEvent: vi.fn(async (): Promise<PrismGuestCheckIn[]> => []),
    countCheckInsForEvent: vi.fn(async () => 0),
    guestAccessCode: vi.fn(() => 'EVENT-SECRET-CODE'),
  } as unknown as GuestReader;
  const own = input.assignment ?? null;
  const staffingReader = {
    listAssignmentsForEvent: vi.fn(async () => (own ? [own, assignment('Registration Staff', 'Rhea Santos')] : [assignment('Logistics Coordinator')])),
    findAssignmentForEventActor: vi.fn(async () => own),
    mapCoordinatorAssignment: vi.fn((row: OpsCoordinatorAssignment) => ({
      id: row.id, eventId: EVENT_ID, coordinatorId: row.coordinatorId, coordinatorName: row.coordinatorName, role: row.role, status: row.status, doubleBookingWarning: false,
    })),
  } as unknown as StaffingReader;
  const typedQueries = queries as unknown as EventReadModelQueries;
  const liveOps = new LiveOpsReadModelsService(typedQueries, policy, { mapFloorPlanDraft: vi.fn() } as unknown as FloorPlanWorkflowService, guestReader, staffingReader);
  return { service: new RunSheetReadModelsService(typedQueries, liveOps), queries };
}

function sheet(result: PrismEventRunSheetResult): PrismEventRunSheet {
  if (!('entries' in result)) throw new Error('Expected an authored run sheet');
  return result;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-08-20T08:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('RunSheetReadModelsService', () => {
  it('merges segments, supplier windows, open task deadlines and open issues into one time-ordered PMCM sheet', async () => {
    const { service } = createService();

    const result = sheet(await service.getRunSheet(EVENT_ID, undefined, actor(OpsUserRole.PmcmAdmin)));

    expect(result).toMatchObject({ scope: 'pmcm', supplierWindowsVisible: true, day: { id: 'day_1' } });
    expect(result.days.map((day) => day.id)).toEqual(['day_1', 'day_2']);
    // Ties: same-time segment before ingress; equal task deadlines by reference id.
    expect(result.entries.map((entry) => entry.id)).toEqual([
      'issue:issue_carried',
      'segment:seg_doors',
      'ingress:sched_lights',
      'issue:issue_audio',
      'segment:seg_program',
      'task_due:task_a',
      'task_due:task_b',
      'task_due:task_audio',
      'egress:sched_lights',
    ]);
    expect(result.entries[0]).toMatchObject({ carriedOver: true, severity: 'critical', location: 'Main Stage' });
    expect(result.entries[2]).toMatchObject({ title: 'Lights Co ingress', ownerLabel: 'Technicals', location: 'Dock B', carriedOver: false });
    expect(result.supplierCommitments).toEqual([expect.objectContaining({ id: 'quote_lights', notes: 'Private setup note.' })]);
  });

  it('filters entries to the selected schedule day and defaults to the day matching today', async () => {
    const { service } = createService();

    const dayTwo = sheet(await service.getRunSheet(EVENT_ID, 'day_2', actor(OpsUserRole.PmcmAdmin)));
    expect(dayTwo.day.id).toBe('day_2');
    expect(dayTwo.entries.map((entry) => entry.id)).toEqual([
      'issue:issue_carried',
      'issue:issue_audio',
      'task_due:task_a',
      'task_due:task_b',
      'task_due:task_audio',
      'segment:seg_loadout',
      'task_due:task_tomorrow',
    ]);
    expect(dayTwo.entries.filter((entry) => entry.carriedOver).map((entry) => entry.id)).toEqual([
      'issue:issue_carried', 'issue:issue_audio', 'task_due:task_a', 'task_due:task_b', 'task_due:task_audio',
    ]);
    expect(dayTwo.entries.some((entry) => entry.kind === 'ingress' || entry.kind === 'egress')).toBe(false);

    vi.setSystemTime(new Date('2026-08-21T07:00:00.000Z'));
    expect(sheet(await service.getRunSheet(EVENT_ID, undefined, actor(OpsUserRole.PmcmAdmin))).day.id).toBe('day_2');
    await expect(service.getRunSheet(EVENT_ID, 'day_missing', actor(OpsUserRole.PmcmAdmin))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('reports an unauthored schedule instead of an empty sheet', async () => {
    const { service } = createService({ scheduled: false });

    await expect(service.getRunSheet(EVENT_ID, undefined, actor(OpsUserRole.PmcmAdmin))).resolves.toEqual({ eventId: EVENT_ID, authored: false, reason: 'no_schedule' });
  });

  it('gives an assigned coordinator only role-visible work, no supplier windows, and no private notes', async () => {
    const { service, queries } = createService({ assignment: assignment('Logistics Coordinator') });

    const result = sheet(await service.getRunSheet(EVENT_ID, 'day_1', actor(OpsUserRole.Coordinator)));
    const serialized = JSON.stringify(result);

    expect(result).toMatchObject({ scope: 'coordinator', supplierWindowsVisible: false, supplierCommitments: [] });
    expect(result.entries.map((entry) => entry.id)).toEqual([
      'issue:issue_carried', 'segment:seg_doors', 'segment:seg_program', 'task_due:task_a', 'task_due:task_b',
    ]);
    expect(result.coordinators.map((row) => row.coordinatorName)).toEqual(['Francis Coordinator']);
    expect(queries.supplierSchedulesForEvent).not.toHaveBeenCalled();
    for (const leaked of ['Private', 'Escalated to PMCM only', 'Lights Co', 'Dock B', 'secret-quote-token', 'Rhea Santos', 'task_audio', 'issue_audio']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it.each([
    ['an ingress/egress coordinator', { assignment: assignment('Ingress and Egress Assistant') }],
    ['the designated Event Day System Operator', { assignment: assignment('Logistics Coordinator'), operatorDesignated: true }],
  ])('shows supplier windows to %s without supplier notes', async (_label, input) => {
    const { service } = createService(input);

    const result = sheet(await service.getRunSheet(EVENT_ID, 'day_1', actor(OpsUserRole.Coordinator)));

    expect(result.supplierWindowsVisible).toBe(true);
    expect(result.entries.filter((entry) => entry.kind === 'ingress' || entry.kind === 'egress').map((entry) => entry.id)).toEqual(['ingress:sched_lights', 'egress:sched_lights']);
    expect(result.supplierCommitments).toEqual([expect.objectContaining({ id: 'quote_lights', notes: '' })]);
    expect(JSON.stringify(result)).not.toContain('Private');
  });

  it('forbids an unassigned coordinator', async () => {
    const { service, queries } = createService({ assignment: null });

    await expect(service.getRunSheet(EVENT_ID, undefined, actor(OpsUserRole.Coordinator))).rejects.toBeInstanceOf(ForbiddenException);
    expect(queries.supplierSchedulesForEvent).not.toHaveBeenCalled();
  });

  it.each([OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Guest])('forbids %s actors from the run sheet', async (role) => {
    const { service, queries } = createService();

    await expect(service.getRunSheet(EVENT_ID, undefined, actor(role))).rejects.toBeInstanceOf(ForbiddenException);
    expect(queries.supplierSchedulesForEvent).not.toHaveBeenCalled();
  });
});
