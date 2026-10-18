import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type {
  OpsCoordinatorAssignment,
  OpsEvent,
  OpsEventHandoff,
  OpsFloorPlanDraft,
  OpsSupplierQuoteRequest,
  OpsUrgentIssue,
} from '@prisma/client';
import type { PrismGuestCheckIn } from '@prism/types';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { FloorPlanWorkflowService } from '@prism/contexts/floorplan';
import { GUEST_READER, type GuestReader, STAFFING_READER, type StaffingReader } from '@prism/contexts/operations';
import type { FileRequirementReader } from '@prism/contexts/event-lifecycle';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import { LiveOpsReadModelsService } from './live-ops-read-models.service';
import { HandoffBriefReadModelsService } from './handoff-brief-read-models.service';

const EVENT_ID = 'evt_handoff';
const CREATED_AT = new Date('2026-08-01T09:00:00.000Z');
const ALLOWED_ROLES: string[] = [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator];

function eventFixture(): OpsEvent & { floorPlanDrafts: OpsFloorPlanDraft[] } {
  return {
    id: EVENT_ID,
    inquiryId: 'inq_1',
    clientName: 'Ana Reyes',
    eventName: 'Ayala Summit',
    eventDate: new Date('2026-08-20T00:00:00.000Z'),
    status: 'planning',
    clientPortalStatus: 'unlocked',
    readiness: 'ready',
    archived: false,
    walkInPolicy: 'closed',
    walkInThreshold: 200,
    actualEndedAt: null,
    actualEndedBy: null,
    floorPlanStatus: 'approved',
    floorPlanId: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    floorPlanDrafts: [],
  } as unknown as OpsEvent & { floorPlanDrafts: OpsFloorPlanDraft[] };
}

function issueFixture(id: string, status: string, ownerRole: string): OpsUrgentIssue {
  return {
    id,
    eventId: EVENT_ID,
    title: `${id} title`,
    description: 'Power interruption near the stage.',
    severity: 'high',
    status,
    affectedArea: 'Main Stage',
    ownerRole,
    ownerName: '',
    resolution: '',
    openedBy: 'Ms. Mys',
    slaDueAt: null,
    escalationLevel: 'none',
    escalatedAt: null,
    escalatedBy: null,
    escalationNotes: 'Escalated to PMCM only.',
    resolvedAt: null,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
  } as unknown as OpsUrgentIssue;
}

function supplierRequestFixture(id: string, category: string): OpsSupplierQuoteRequest {
  return {
    id,
    eventId: EVENT_ID,
    supplierId: `supplier_${id}`,
    categoryId: 'category_1',
    supplierName: `${category} Supplier`,
    category,
    message: 'Provide event-day support.',
    dueDate: null,
    accessToken: 'secret-quote-token',
    accessTokenExpiresAt: null,
    accessTokenRevokedAt: null,
    confidentialBid: true,
    status: 'open',
    assignmentStatus: 'confirmed',
    assignmentConfirmedAt: CREATED_AT,
    readinessStatus: 'ready',
    readinessConfirmedAt: CREATED_AT,
    readinessNotes: 'Private readiness note.',
    eventDayStatus: 'set_up_ready',
    eventDayStatusAt: CREATED_AT,
    eventDayNotes: 'Private setup note.',
    eventDayVerificationStatus: 'verified',
    eventDayVerifiedAt: CREATED_AT,
    eventDayVerifiedBy: 'Ms. Mys',
    eventDayVerificationNotes: 'Private verification note.',
    statusPhotoFileName: 'setup.jpg',
    contractDocumentId: 'doc_1',
    createdAt: CREATED_AT,
    roundId: null,
  } as unknown as OpsSupplierQuoteRequest;
}

function assignmentFixture(role: string, coordinatorName = 'Francis Coordinator'): OpsCoordinatorAssignment {
  return {
    id: `assignment_${role.replace(/\W+/g, '_')}`,
    eventId: EVENT_ID,
    coordinatorId: 'coordinator_1',
    coordinatorName,
    role,
    status: 'acknowledged',
    attendanceStatus: 'present',
    attendanceMarkedAt: CREATED_AT,
    attendanceNotes: 'Private attendance note.',
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
  } as unknown as OpsCoordinatorAssignment;
}

function handoffFixture(): OpsEventHandoff {
  return {
    id: 'handoff_1',
    eventId: EVENT_ID,
    dayId: 'day_1',
    role: 'Logistics Coordinator',
    fromAssignmentId: 'assignment_a',
    toAssignmentId: 'assignment_b',
    handedOffBy: 'Francis Coordinator',
    receivedBy: 'Taylor Lee',
    handedOffAt: CREATED_AT,
    outstandingItems: ['Confirm load-out', 42, 'Radio check'],
    createdAt: CREATED_AT,
  } as unknown as OpsEventHandoff;
}

function fileItemsFixture() {
  return [
    { key: 'official_floorplan', label: 'Official floorplan', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client', 'coordinator'], status: 'approved', dueDate: '2026-08-10', auditCategory: 'events', detail: 'Floorplan status is approved', generatedDocumentId: 'doc_plan' },
    { key: 'billing_statement', label: 'Billing and payment schedule', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin', 'client'], status: 'generated', auditCategory: 'finance', detail: 'Balance 5,000 outstanding', generatedDocumentId: 'doc_bill' },
    { key: 'supplier_reviews', label: 'Supplier review capture', ownerRole: 'pmcm-admin', visibleToRoles: ['pmcm-admin'], status: 'missing', auditCategory: 'suppliers', detail: 'No reviews yet' },
  ];
}

function actor(role: string): ResolvedEventOpsActor {
  return {
    id: 'user_1',
    role,
    email: 'francis@pmcm.test',
    name: role === OpsUserRole.Coordinator ? 'Francis Coordinator' : 'Ms. Mys',
    coordinatorId: role === OpsUserRole.Coordinator ? 'coordinator_1' : undefined,
    explicit: true,
  } as ResolvedEventOpsActor;
}

function createService(input: {
  issues?: OpsUrgentIssue[];
  suppliers?: OpsSupplierQuoteRequest[];
  assignments?: OpsCoordinatorAssignment[];
  assignment?: OpsCoordinatorAssignment | null;
  operatorDesignated?: boolean;
}) {
  const assignments = input.assignments ?? [];
  const queries = {
    liveOpsForEvent: vi.fn(async () => ({
      event: eventFixture(),
      tasks: [],
      urgentIssues: input.issues ?? [],
      supplierRequests: input.suppliers ?? [],
      eventDayLogs: [],
      briefing: {
        eventId: EVENT_ID,
        venue: 'Ayala Hall',
        guestCount: 180,
        budgetRange: 'PHP 900,000 - 1,200,000',
        serviceRequirements: [],
        notes: 'Client prefers the north gate.',
        submittedAt: CREATED_AT,
      },
    })),
    taskReassignmentRequests: vi.fn(async () => []),
    activeOperatorForCoordinator: vi.fn(async () => (input.operatorDesignated ? { id: 'designation_1' } : null)),
    handoffsForEvent: vi.fn(async () => [handoffFixture()]),
  } as unknown as EventReadModelQueries;

  const policy = {
    requireActorRole: vi.fn(async (current: ResolvedEventOpsActor) => {
      if (!ALLOWED_ROLES.includes(current.role)) throw new ForbiddenException('Role cannot read event-day operations');
    }),
    recordForbiddenAccess: vi.fn(async () => undefined),
    sameText: (left?: string | null, right?: string | null) =>
      Boolean(left && right && left.trim().toLowerCase() === right.trim().toLowerCase()),
  } as unknown as EventAccessPolicyService;
  const floorPlanWorkflowService = { mapFloorPlanDraft: vi.fn() } as unknown as FloorPlanWorkflowService;
  const guestReader = {
    listCheckInsForEvent: vi.fn(async (): Promise<PrismGuestCheckIn[]> => []),
    countCheckInsForEvent: vi.fn(async () => 0),
    guestAccessCode: vi.fn(() => 'EVENT-SECRET-CODE'),
  } as unknown as GuestReader;
  const staffingReader = {
    listAssignmentsForEvent: vi.fn(async () => assignments),
    findAssignmentForEventActor: vi.fn(async () => input.assignment ?? null),
    mapCoordinatorAssignment: vi.fn((assignment: OpsCoordinatorAssignment) => ({
      id: assignment.id,
      eventId: EVENT_ID,
      coordinatorId: assignment.coordinatorId,
      coordinatorName: assignment.coordinatorName,
      role: assignment.role,
      status: assignment.status,
      doubleBookingWarning: false,
    })),
  } as unknown as StaffingReader;
  const fileRequirements = {
    buildForEvent: vi.fn(async () => ({ eventId: EVENT_ID, items: fileItemsFixture() })),
    closeGates: vi.fn(async () => ({})),
  } as unknown as FileRequirementReader;

  const liveOps = new LiveOpsReadModelsService(queries, policy, floorPlanWorkflowService, guestReader, staffingReader);
  return new HandoffBriefReadModelsService(queries, liveOps, fileRequirements);
}

describe('HandoffBriefReadModelsService', () => {
  it('composes the full PMCM brief with open issues, handoff entries, and finance-free file status', async () => {
    const service = createService({
      issues: [issueFixture('issue_open', 'open', 'Audio Lead'), issueFixture('issue_done', 'resolved', 'Audio Lead')],
      suppliers: [supplierRequestFixture('quote_1', 'Technicals')],
      assignments: [assignmentFixture('Logistics Coordinator')],
    });

    const brief = await service.getHandoffBrief(EVENT_ID, actor(OpsUserRole.PmcmAdmin));

    expect(brief).toMatchObject({
      scope: 'pmcm',
      keyDetails: { eventName: 'Ayala Summit', venue: 'Ayala Hall', guestCount: 180, clientName: 'Ana Reyes' },
      supplierReadiness: { visible: true },
      openIssues: [expect.objectContaining({ id: 'issue_open', affectedArea: 'Main Stage' })],
      files: [
        expect.objectContaining({ key: 'official_floorplan', status: 'approved', dueDate: '2026-08-10' }),
        expect.objectContaining({ key: 'supplier_reviews', status: 'missing' }),
      ],
      handoffs: [expect.objectContaining({ id: 'handoff_1', outstandingItems: ['Confirm load-out', 'Radio check'] })],
    });
    expect(brief.supplierReadiness.items).toEqual([
      expect.objectContaining({ supplierName: 'Technicals Supplier', readinessStatus: 'ready', verificationStatus: 'verified' }),
    ]);
  });

  it('never returns private supplier notes, audit fields, finance items, or access codes to the PMCM brief', async () => {
    const service = createService({
      suppliers: [supplierRequestFixture('quote_1', 'Technicals')],
      assignments: [assignmentFixture('Logistics Coordinator')],
      issues: [issueFixture('issue_open', 'open', 'Audio Lead')],
    });

    const serialized = JSON.stringify(await service.getHandoffBrief(EVENT_ID, actor(OpsUserRole.PmcmAdmin)));

    for (const leaked of ['Private readiness note', 'Private setup note', 'Private verification note', 'Private attendance note', 'Escalated to PMCM only', 'budgetRange', 'PHP 900,000', 'billing_statement', 'auditCategory', 'secret-quote-token', 'EVENT-SECRET-CODE', 'Balance 5,000']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('gives an assigned coordinator the scoped subset without finance, private supplier, audit, client, or other-coordinator data', async () => {
    const own = assignmentFixture('Logistics Coordinator');
    const other = assignmentFixture('Registration Staff', 'Rhea Santos');
    const service = createService({
      assignment: own,
      assignments: [own, other],
      suppliers: [supplierRequestFixture('quote_1', 'Technicals')],
      issues: [issueFixture('issue_open', 'open', 'Logistics Coordinator')],
    });

    const brief = await service.getHandoffBrief(EVENT_ID, actor(OpsUserRole.Coordinator));
    const serialized = JSON.stringify(brief);

    expect(brief).toMatchObject({
      scope: 'coordinator',
      keyDetails: { eventName: 'Ayala Summit', venue: 'Ayala Hall', clientName: null },
      supplierReadiness: { visible: false, items: [] },
      staffing: [expect.objectContaining({ coordinatorName: 'Francis Coordinator', role: 'Logistics Coordinator' })],
      files: [expect.objectContaining({ key: 'official_floorplan' })],
    });
    expect(brief.staffing).toHaveLength(1);
    for (const leaked of ['Ana Reyes', 'budgetRange', 'PHP 900,000', 'billing_statement', 'auditCategory', 'supplier_reviews', 'Private', 'Ms. Mys', 'Rhea Santos', 'EVENT-SECRET-CODE', 'secret-quote-token', 'Escalated to PMCM only']) {
      expect(serialized).not.toContain(leaked);
    }
  });

  it('shows supplier readiness to ingress coordinators without private notes', async () => {
    const own = assignmentFixture('Ingress and Egress Assistant');
    const service = createService({
      assignment: own,
      assignments: [own],
      suppliers: [supplierRequestFixture('quote_1', 'Technicals')],
    });

    const brief = await service.getHandoffBrief(EVENT_ID, actor(OpsUserRole.Coordinator));

    expect(brief.supplierReadiness.visible).toBe(true);
    expect(brief.supplierReadiness.items).toEqual([expect.objectContaining({ supplierName: 'Technicals Supplier' })]);
    expect(JSON.stringify(brief.supplierReadiness)).not.toContain('Private');
  });

  it('forbids an unassigned coordinator from reading the brief', async () => {
    const service = createService({ assignment: null });

    await expect(service.getHandoffBrief(EVENT_ID, actor(OpsUserRole.Coordinator))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([OpsUserRole.Client, OpsUserRole.Supplier, OpsUserRole.Guest])('forbids %s actors from the PMCM handoff brief', async (role) => {
    const service = createService({ assignments: [assignmentFixture('Logistics Coordinator')] });

    await expect(service.getHandoffBrief(EVENT_ID, actor(role))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
