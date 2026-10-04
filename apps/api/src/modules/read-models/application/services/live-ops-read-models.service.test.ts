import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import type {
  OpsCoordinatorAssignment,
  OpsEvent,
  OpsEventDayLog,
  OpsEventDayTask,
  OpsFloorPlanDraft,
  OpsSupplierQuoteRequest,
  OpsUrgentIssue,
} from '@prisma/client';
import type {
  PrismCoordinatorAssignment,
  PrismGuestCheckIn,
} from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import { GUEST_READER, type GuestReader, STAFFING_READER, type StaffingReader } from '@prism/contexts/operations';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import { LiveOpsReadModelsService } from './live-ops-read-models.service';

const EVENT_ID = 'evt_live_ops';
const CREATED_AT = new Date('2026-08-01T09:00:00.000Z');

function eventFixture(): OpsEvent & { floorPlanDrafts: OpsFloorPlanDraft[] } {
  return {
    id: EVENT_ID,
    inquiryId: 'inq_1',
    clientName: 'Ana Reyes',
    eventName: 'Ayala Summit',
    eventDate: new Date('2026-08-20T00:00:00.000Z'),
    status: 'planning',
    clientPortalStatus: 'unlocked',
    clientEventDayViewEnabled: false,
    readiness: 'ready',
    archived: false,
    walkInPolicy: 'closed',
    walkInThreshold: 200,
    actualEndedAt: null,
    actualEndedBy: null,
    archivedAt: null,
    archiveOverrideReason: null,
    archiveOverrideBy: null,
    archiveChecklist: {},
    floorPlanStatus: 'approved',
    floorPlanId: null,
    floorPlanSubmittedAt: null,
    floorPlanReviewedAt: null,
    proposalClientStatus: 'pending',
    proposalRevisionCount: 0,
    proposalReviewedAt: null,
    proposalReviewedBy: null,
    freezeStatus: 'open',
    freezeAt: null,
    freezeDeadlineAt: null,
    freezeReason: '',
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    floorPlanDrafts: [],
    floorPlanProjectionVersion: 0,
  } as OpsEvent & { floorPlanDrafts: OpsFloorPlanDraft[] };
}

function taskFixture(id: string, assignedRole: string): OpsEventDayTask {
  return {
    id,
    eventId: EVENT_ID,
    title: `${assignedRole} task`,
    assignedRole,
    ownerName: '',
    priority: 'normal',
    status: 'open',
    notes: '',
    dueAt: null,
    slaDueAt: null,
    slaStatus: 'on_track',
    escalationLevel: 'none',
    escalatedAt: null,
    escalatedBy: null,
    escalationNotes: '',
    completedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function issueFixture(id: string, ownerRole: string, ownerName = ''): OpsUrgentIssue {
  return {
    id,
    eventId: EVENT_ID,
    title: `${id} issue`,
    description: 'Power interruption near the stage.',
    severity: 'high',
    status: 'open',
    affectedArea: 'Main Stage',
    ownerRole,
    ownerName,
    resolution: '',
    openedBy: 'Francis Coordinator',
    slaDueAt: null,
    slaStatus: 'on_track',
    escalationLevel: 'none',
    escalatedAt: null,
    escalatedBy: null,
    escalationNotes: '',
    resolvedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };
}

function supplierRequestFixture(): OpsSupplierQuoteRequest {
  return {
    id: 'quote_request_1',
    eventId: EVENT_ID,
    supplierId: 'supplier_1',
    categoryId: 'category_1',
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
    message: 'Provide event-day support.',
    dueDate: null,
    accessToken: 'secret-quote-token',
    confidentialBid: true,
    status: 'open',
    assignmentStatus: 'confirmed',
    assignmentConfirmedAt: CREATED_AT,
    readinessStatus: 'ready',
    readinessConfirmedAt: CREATED_AT,
    readinessNotes: 'Ready to load in.',
    eventDayStatus: 'set_up_ready',
    eventDayStatusAt: CREATED_AT,
    eventDayNotes: 'Setup complete.',
    eventDayVerificationStatus: 'verified',
    eventDayVerifiedAt: CREATED_AT,
    eventDayVerifiedBy: 'Ms. Mys',
    eventDayVerificationNotes: 'Verified at gate.',
    statusPhotoFileName: 'setup.jpg',
    contractDocumentId: 'doc_1',
    createdAt: CREATED_AT,
    roundId: null,
  };
}

function logFixture(): OpsEventDayLog {
  return {
    id: 'event_day_log_1',
    eventId: EVENT_ID,
    actionType: 'supplier_verified',
    actor: 'Ms. Mys',
    actorRole: 'pmcm-admin',
    message: 'Supplier status verified.',
    relatedType: 'quote_request',
    relatedId: 'quote_request_1',
    metadata: { verificationStatus: 'verified' },
    createdAt: CREATED_AT,
  };
}

function assignmentFixture(role: string): OpsCoordinatorAssignment {
  return {
    id: 'assignment_1',
    eventId: EVENT_ID,
    coordinatorId: 'coordinator_1',
    coordinatorName: 'Francis Coordinator',
    role,
    status: 'acknowledged',
    attendanceStatus: 'present',
    attendanceMarkedAt: CREATED_AT,
    attendanceNotes: 'On site.',
    replacedByAssignmentId: null,
    replacementReason: '',
    replacedAt: null,
    replacedBy: null,
    doubleBookingWarning: false,
    eventDate: new Date('2026-08-20T00:00:00.000Z'),
    conflictEventId: null,
    conflictEventName: null,
    acknowledgedAt: CREATED_AT,
    acknowledgedBy: 'user_1',
    acknowledgementReason: null,
    withdrawalReason: null,
    withdrawnAt: null,
    withdrawnBy: null,
    createdAt: CREATED_AT,
  };
}

function guestFixture(): PrismGuestCheckIn {
  return {
    id: 'check_in_1',
    eventId: EVENT_ID,
    guestName: 'Guest One',
    checkInMode: 'name_search',
    status: 'checked_in',
    walkIn: false,
    verificationStatus: 'verified',
    checkedInAt: CREATED_AT.toISOString(),
    rosterEntryId: null,
  };
}

function actor(role: ResolvedEventOpsActor['role']): ResolvedEventOpsActor {
  return {
    id: 'user_1',
    role,
    email: 'francis@pmcm.test',
    name: role === OpsUserRole.Coordinator ? 'Francis Coordinator' : 'Ms. Mys',
    coordinatorId: role === OpsUserRole.Coordinator ? 'coordinator_1' : undefined,
    explicit: true,
  };
}

function createService(input: {
  tasks?: OpsEventDayTask[];
  urgentIssues?: OpsUrgentIssue[];
  supplierRequests?: OpsSupplierQuoteRequest[];
  eventDayLogs?: OpsEventDayLog[];
  assignment?: OpsCoordinatorAssignment;
  guestCheckIns?: PrismGuestCheckIn[];
}) {
  const assignment = input.assignment;
  const guestCheckIns = input.guestCheckIns ?? [];
  const mappedAssignment: PrismCoordinatorAssignment = {
    id: assignment?.id ?? 'assignment_1',
    eventId: EVENT_ID,
    coordinatorId: assignment?.coordinatorId ?? 'coordinator_1',
    coordinatorName: assignment?.coordinatorName ?? 'Francis Coordinator',
    role: assignment?.role ?? 'Logistics Coordinator',
    status: assignment?.status ?? 'acknowledged',
    doubleBookingWarning: false,
  };
  const queries = {
    liveOpsForEvent: vi.fn(async () => ({
      event: eventFixture(),
      tasks: input.tasks ?? [],
      urgentIssues: input.urgentIssues ?? [],
      supplierRequests: input.supplierRequests ?? [],
      eventDayLogs: input.eventDayLogs ?? [],
    })),
    taskReassignmentRequests: vi.fn(async () => [{
      id: 'reassignment_1',
      eventId: EVENT_ID,
      taskId: 'task_1',
      requestedBy: 'Francis Coordinator',
      requestedByRole: 'coordinator',
      fromOwnerRole: 'Logistics Coordinator',
      fromOwnerName: 'Francis Coordinator',
      toOwnerRole: 'Floor Director',
      toOwnerName: '',
      reason: 'Coverage changed',
      status: 'pending',
      requestedAt: CREATED_AT,
      autoApproveAt: CREATED_AT,
      decidedAt: null,
      decidedBy: null,
      decisionReason: null,
    }]),
  } as unknown as EventReadModelQueries;
  const policy = {
    requireActorRole: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
    sameText: (left?: string | null, right?: string | null) =>
      Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase()),
  } as unknown as EventAccessPolicyService;
  const floorPlanWorkflowService = {
    mapFloorPlanDraft: vi.fn(),
  } as unknown as FloorPlanWorkflowService;
  const guestReader = {
    listCheckInsForEvent: vi.fn(async () => guestCheckIns),
    countCheckInsForEvent: vi.fn(async () => guestCheckIns.length),
    guestAccessCode: vi.fn(() => 'EVENT-CODE'),
  } as unknown as GuestReader;
  const staffingReader = {
    listAssignmentsForEvent: vi.fn(async () => (assignment ? [assignment] : [])),
    findAssignmentForEventActor: vi.fn(async () => assignment ?? null),
    mapCoordinatorAssignment: vi.fn(() => mappedAssignment),
  } as unknown as StaffingReader;

  const service = new LiveOpsReadModelsService(
    queries,
    policy,
    floorPlanWorkflowService,
    guestReader,
    staffingReader,
  );
  return { service, guestReader, staffingReader, queries };
}

describe('LiveOpsReadModelsService', () => {
  it('composes the PMCM live-ops read model with affected areas and event-day logs', async () => {
    const { service } = createService({
      tasks: [taskFixture('task_1', 'General Coordinator')],
      urgentIssues: [issueFixture('issue_1', 'Audio Lead')],
      supplierRequests: [supplierRequestFixture()],
      eventDayLogs: [logFixture()],
    });

    const result = await service.getEventLiveOps(EVENT_ID, actor(OpsUserRole.PmcmAdmin));

    expect(result.urgentIssues[0]).toMatchObject({
      id: 'issue_1',
      affectedArea: 'Main Stage',
      openedBy: 'Francis Coordinator',
    });
    expect(result.supplierStatuses[0]).toMatchObject({
      supplierName: 'Sonic Line Events',
      eventDayVerificationStatus: 'verified',
      verifiedBy: 'Ms. Mys',
    });
    expect(result.eventDayLogs).toEqual([
      expect.objectContaining({ actionType: 'supplier_verified', relatedId: 'quote_request_1' }),
    ]);
    expect(result.taskReassignmentRequests).toHaveLength(1);
  });

  it('scopes coordinator data and hides supplier and unassigned issue details outside their role', async () => {
    const assignment = assignmentFixture('Logistics Coordinator');
    const { service } = createService({
      tasks: [taskFixture('task_visible', 'Logistics Coordinator'), taskFixture('task_hidden', 'Registration Staff')],
      urgentIssues: [issueFixture('issue_visible', 'Logistics Coordinator'), issueFixture('issue_unassigned', '')],
      supplierRequests: [supplierRequestFixture()],
      assignment,
      guestCheckIns: [guestFixture()],
    });

    const result = await service.getEventLiveOps(EVENT_ID, actor(OpsUserRole.Coordinator));

    expect(result.role).toBe('Logistics Coordinator');
    expect(result.tasks.map((task) => task.id)).toEqual(['task_visible']);
    expect(result.urgentIssues.map((issue) => issue.id)).toEqual(['issue_visible']);
    expect(result.guestAttendanceCount).toBe(1);
    expect(result.guestCheckIns).toEqual([]);
    expect(result.supplierStatuses).toEqual([]);
    expect(result.taskReassignmentRequests).toEqual([]);
  });

  it('exposes supplier setup statuses to ingress coordinators while stripping private supplier details', async () => {
    const { service } = createService({
      assignment: assignmentFixture('Ingress and Egress Assistant'),
      supplierRequests: [supplierRequestFixture()],
    });

    const result = await service.getEventLiveOps(EVENT_ID, actor(OpsUserRole.Coordinator));

    expect(result.supplierStatuses).toMatchObject([{
      id: 'quote_request_1',
      supplierName: 'Sonic Line Events',
      eventDayStatus: 'set_up_ready',
      verificationStatus: 'verified',
    }]);
    expect(result.supplierStatuses[0]).not.toHaveProperty('accessToken');
    expect(result.supplierStatuses[0]).not.toHaveProperty('confidentialBid');
    expect(result.supplierStatuses[0]).not.toHaveProperty('eventDayVerificationNotes');
  });

  it('does not query live-ops data before confirming coordinator assignment', async () => {
    const { service, queries } = createService({});

    await expect(service.getEventLiveOps(EVENT_ID, actor(OpsUserRole.Coordinator))).rejects.toThrow(
      'Coordinator is not assigned to this event',
    );
    expect(queries.liveOpsForEvent).not.toHaveBeenCalled();
  });

  it('omits event-day logs from the coordinator role view', async () => {
    const { service } = createService({
      assignment: assignmentFixture('Logistics Coordinator'),
      eventDayLogs: [logFixture()],
    });

    const result = await service.getCoordinatorRoleView(EVENT_ID, actor(OpsUserRole.Coordinator));

    expect(result).not.toHaveProperty('eventDayLogs');
  });
});
