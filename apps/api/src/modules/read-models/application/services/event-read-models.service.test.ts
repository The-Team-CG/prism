import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import { EventReadModelsService } from './event-read-models.service';

function createGuestReader() {
  return {
    countCheckInsForEvent: vi.fn(async () => 0),
    listCheckInsForEvent: vi.fn(async () => []),
    listFeedbackForEvent: vi.fn(async () => []),
    countPendingFeedbackForEvent: vi.fn(async () => 0),
  };
}

function createStaffingReader() {
  return {
    listAssignmentsForEvent: vi.fn(async () => []),
    countAssignmentsForEvent: vi.fn(async () => 0),
    countPendingAssignmentsForEvent: vi.fn(async () => 0),
    listCoordinators: vi.fn(async () => []),
  };
}

function createFloorplanReader(): ConstructorParameters<typeof EventReadModelsService>[4] {
  return { listClientSnapshotEntries: vi.fn(async () => []) } as never;
}

function createEventClientFloorplanAccessReader(): ConstructorParameters<typeof EventReadModelsService>[5] {
  return { listActiveSharedEvents: vi.fn(async () => []) } as never;
}

function createSupplierWorkspaceService() {
  const requests = [
    {
      id: 'qr_visible',
      eventId: 'evt_visible',
      supplierId: 'sup_sonicline',
      supplierName: 'Sonic Line Events',
      category: 'Lights and sounds',
      dueDate: null,
      status: 'open',
      assignmentStatus: 'pending',
      readinessStatus: 'not_confirmed',
      eventDayStatus: null,
      eventDayVerificationStatus: null,
      verificationStatus: null,
      contractDocumentId: null as string | null,
      contractVersions: [] as Array<{ reviewStatus: string }>,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    {
      id: 'qr_archived',
      eventId: 'evt_archived',
      supplierId: 'sup_sonicline',
      supplierName: 'Sonic Line Events',
      category: 'Lights and sounds',
      dueDate: null,
      status: 'open',
      assignmentStatus: 'pending',
      readinessStatus: 'not_confirmed',
      eventDayStatus: null,
      eventDayVerificationStatus: null,
      verificationStatus: null,
      contractDocumentId: null,
      contractVersions: [] as Array<{ reviewStatus: string }>,
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ];
  const quotes = [
    { id: 'quote_visible', eventId: 'evt_visible', supplierId: 'sup_sonicline',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    },
    { id: 'quote_archived', eventId: 'evt_archived', supplierId: 'sup_sonicline',
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ];
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    opsSupplierQuoteRequest: {
      findMany: vi.fn(async () => requests),
    },
    opsSupplierQuote: {
      findMany: vi.fn(async () => quotes),
    },
    opsEvent: {
      findMany: vi.fn(async () => [
        { id: 'evt_visible', eventName: 'Gala', eventDate: new Date('2026-08-01T00:00:00.000Z'), clientName: 'Ana Reyes', clientPortalStatus: 'unlocked', archived: false },
      ]),
    },
  };
  const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
  const supplierRows = [
    {
      id: 'sup_sonicline',
      categoryId: 'supcat_technicals',
      name: 'Sonic Line Events',
      contactName: 'Dane Villanueva',
      email: 'supplier@example.com',
      phone: '+63 917 555 0103',
      tier: 'tier_1',
      bniMember: false,
      serviceInclusions: 'Audio, lights, LED wall',
      performanceNotes: '',
      applicationDate: new Date('2026-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      category: {
        id: 'supcat_technicals',
        slug: 'technicals',
        name: 'Technicals',
        sortOrder: 1,
        active: true,
        acceptableMin: 120000,
        acceptableMax: 180000,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      reviews: [],
      reliabilityNotes: [],
      certifications: [],
    },
  ];
  (prisma as any).opsSupplier = { findMany: vi.fn(async () => supplierRows),
    findFirst: vi.fn(async () => supplierRows[0]),
  };
  (prisma as any).opsSupplierReview = { groupBy: vi.fn(async () => []) };
  const guestReader = createGuestReader();
  const staffingReader = createStaffingReader();
  const service = new EventReadModelsService(
    new EventReadModelQueries(prisma as any),
    policy,
    guestReader as any,
    staffingReader as any,
    createFloorplanReader(),
    createEventClientFloorplanAccessReader(),
  );
  return { service, prisma, policy, guestReader, staffingReader };
}

function createPassthroughPmcmMappers() {
  return {
    coordinatorRoleRequirements: [],
    mapUser: (user: any) => user,
    mapInquiry: (inquiry: any) => inquiry,
    mapEvent: (event: any) => event,
    mapDocument: (document: any) => document,
    mapBriefing: (briefing: any) => briefing,
    mapSupplierQuoteRequest: (request: any) => request,
    mapSupplierQuote: (quote: any) => quote,
    mapCoordinator: (coordinator: any) => coordinator,
    mapCoordinatorAssignment: (assignment: any) => assignment,
    mapComplianceRule: (rule: any) => rule,
    mapComplianceCheck: (check: any) => check,
    mapBillingSource: (source: any) => source,
    mapBillingStatement: (statement: any) => statement,
    mapPaymentMilestone: (payment: any) => payment,
    mapPaymentRecord: (record: any) => record,
    mapPostEventDocument: (document: any) => document,
    mapEventInsight: (insight: any) => insight,
    mapFloorPlanDraft: (draft: any) => draft,
    mapAuditLog: (log: any) => log,
    mapNotificationLog: (log: any) => log,
    mapRegistrationPlatform: (platform: any) => platform,
  };
}
function createPmcmReadModelService() {
  const event = {
    id: 'evt_visible',
    eventName: 'Ayala Summit',
    clientName: 'Ana Reyes',
    eventDate: new Date('2026-06-18T00:00:00.000Z'),
    status: 'planning',
    floorPlanStatus: 'not_started',
    clientPortalStatus: 'unlocked',
    archived: false,
    floorPlanDrafts: [],
  };
  const prisma = {
    $queryRaw: vi.fn(async () => []),
    opsUser: {
      findMany: vi.fn(async () => [
        {
          id: 'usr_pmcm',
          name: 'Ms. Mys',
          email: 'pmcm@example.com',
          role: OpsUserRole.PmcmAdmin,
          organization: 'PMCM',
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    },
    opsInquiry: {
      count: vi.fn(async () => 3),
      findMany: vi.fn(async () => [
        {
          id: 'inq_new',
          status: 'new',
          clientName: 'Ana Reyes',
          eventName: 'Ayala Summit',
          createdAt: new Date('2026-05-01T00:00:00.000Z'),
          acceptedAt: null,
          conformeSignedAt: null,
          portalInvitationExpiresAt: null,
        },
      ]),
    },
    opsEvent: {
      count: vi.fn(async () => 11),
      findMany: vi.fn(async () => [event]),
      findUnique: vi.fn(async () => event),
    },
    opsOcularVisitRequest: { findUnique: vi.fn(async (): Promise<Record<string, unknown> | null> => null) },
    opsPaymentMilestone: {
      findMany: vi.fn(async () => [
        {
          id: 'pay_overdue',
          eventId: 'evt_visible',
          label: 'Final balance',
          status: 'pending',
          dueDate: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    },
    opsSupplierQuoteRequest: { findMany: vi.fn(async () => []) },
    opsCoordinatorAssignment: { findMany: vi.fn(async () => []) },
    opsFloorPlanDraft: { findMany: vi.fn(async () => []) },
    opsPostEventDocument: { findMany: vi.fn(async () => []) },
    opsEventDayTask: { findMany: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []) },
    opsUrgentIssue: { findMany: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []) },
    opsClientCloseoutResponse: { findMany: vi.fn(async (): Promise<Array<{ id: string; eventId: string }>> => []) },
    opsEventFreezeException: { findMany: vi.fn(async (): Promise<Array<Record<string, unknown>>> => []) },
    opsApprovalRequest: { count: vi.fn(async () => 2) },
    opsDocument: { findMany: vi.fn(async () => [{ id: 'doc_1', eventId: 'evt_visible' }]) },
    opsBriefing: { findMany: vi.fn(async () => []) },
    opsSupplierQuote: { findMany: vi.fn(async () => []) },
    opsCoordinator: {
      findMany: vi.fn(async () => [
        {
          id: 'coord_lead',
          name: 'Lead Coordinator',
          role: 'Event Lead',
          email: 'lead@example.com',
          phone: '+63 917 555 0188',
          active: true,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    },
    opsComplianceRule: { findMany: vi.fn(async () => []) },
    opsComplianceCheck: { findMany: vi.fn(async () => []) },
    opsBillingSource: { findMany: vi.fn(async () => [] as Array<{ id: string; eventId: string }>) },
    opsBillingStatement: { findMany: vi.fn(async () => [] as Array<{ id: string; eventId: string }>) },
    opsBillingCorrection: { findMany: vi.fn(async () => [] as Array<{ id: string; eventId: string }>) },
    opsBillingDispute: { findMany: vi.fn(async () => [] as Array<{ id: string; eventId: string }>) },
    opsAdditionalBilling: { findMany: vi.fn(async () => [] as Array<{ id: string; eventId: string }>) },
    opsPaymentRecord: { findMany: vi.fn(async () => []) },
    opsEventInsight: { findMany: vi.fn(async () => []) },
    opsAuditLog: { findMany: vi.fn(async () => []) },
    opsNotificationLog: { findMany: vi.fn(async () => []) },
    opsSupplierCategory: {
      findMany: vi.fn(async () => [
        {
          id: 'supcat_technicals',
          slug: 'technicals',
          name: 'Technicals',
          sortOrder: 1,
          active: true,
          acceptableMin: 120000,
          acceptableMax: 180000,
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
        },
      ]),
    },
    opsSupplier: {
      findMany: vi.fn(async () => [
        {
          id: 'sup_sonicline',
          categoryId: 'supcat_technicals',
          name: 'Sonic Line Events',
          contactName: 'Dane Villanueva',
          email: 'supplier@example.com',
          phone: '+63 917 555 0103',
          tier: 'tier_1',
          bniMember: false,
          serviceInclusions: 'Audio, lights, LED wall',
          performanceNotes: '',
          applicationDate: new Date('2026-01-01T00:00:00.000Z'),
          createdAt: new Date('2026-01-01T00:00:00.000Z'),
          updatedAt: new Date('2026-01-01T00:00:00.000Z'),
          category: {
            id: 'supcat_technicals',
            slug: 'technicals',
            name: 'Technicals',
            sortOrder: 1,
            active: true,
            acceptableMin: 120000,
            acceptableMax: 180000,
            createdAt: new Date('2026-01-01T00:00:00.000Z'),
          },
          reviews: [],
          reliabilityNotes: [],
          certifications: [],
        },
      ]),
    },
    opsSupplierReview: {
      groupBy: vi.fn(async () => []),
    },
  };
  const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
  const guestReader = createGuestReader();
  const staffingReader = createStaffingReader();
  const service = new EventReadModelsService(
    new EventReadModelQueries(prisma as any),
    policy,
    guestReader as any,
    staffingReader as any,
    createFloorplanReader(),
    createEventClientFloorplanAccessReader(),
  );
  return { service, prisma, policy, guestReader };
}

describe('EventReadModelsService', () => {
  it('returns coordinator reliability history only after the PMCM role check and maps event context', async () => {
    const note = {
      id: 'note_1',
      eventId: 'evt_1',
      assignmentId: 'assignment_1',
      assignment: { role: 'Registration Staff' },
      note: 'Coordinator withdrew: Family emergency',
      severity: 'warning',
      createdAt: new Date('2026-10-01T12:00:00.000Z'),
    };
    const notes = { findMany: vi.fn(async () => [note]) };
    const policy = { requireActorRole: vi.fn(async () => undefined) };
    const service = new EventReadModelsService(
      new EventReadModelQueries({
        opsCoordinatorReliabilityNote: notes,
        opsEvent: { findMany: vi.fn(async () => [{ id: 'evt_1', eventName: 'Autumn Forum', eventDate: new Date('2026-10-04T00:00:00.000Z') }]) },
      } as any),
      policy as any,
      {} as any,
      {} as any,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );

    await expect(service.coordinatorReliabilityHistory({ role: OpsUserRole.PmcmAdmin, name: 'PMCM' } as any, 'coord_1')).resolves.toEqual([{
      id: 'note_1',
      eventId: 'evt_1',
      eventName: 'Autumn Forum',
      eventDate: '2026-10-04',
      assignmentId: 'assignment_1',
      assignmentRole: 'Registration Staff',
      note: 'Coordinator withdrew: Family emergency',
      severity: 'warning',
      createdAt: '2026-10-01T12:00:00.000Z',
    }]);
    expect(policy.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.PmcmAdmin, name: 'PMCM' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'coordinator reliability history',
    );
  });

  it.each([false, true])('scopes client workspace by email and redacts ocular waiver fields, archived=%s', async (archived) => {
    const event = {
      id: 'evt_ocular',
      clientName: 'Client event contact display name',
      clientPortalStatus: 'unlocked',
      eventDate: new Date('2026-10-20T00:00:00.000Z'),
      status: 'planning',
      archived,
      proposalClientStatus: 'pending',
      proposalReviewedAt: null,
      inquiry: { email: 'ana@example.test' },
      floorPlanDrafts: [],
      paymentMilestones: [],
    };
    const queries = {
      visibleEvents: vi.fn(async () => ({
        items: [event],
        pagination: { nextCursor: null, hasMore: false, totalCount: 1 },
      })),
      clientWorkspaceForEvents: vi.fn(async () => [
        [], [], [], [], [], [], [],
        [{
          eventId: event.id,
          status: 'waived',
          clientNote: null,
          requestedAt: null,
          scheduledAt: null,
          waiverReason: 'Internal decision',
          waivedAt: new Date('2026-10-01T00:00:00.000Z'),
          waivedBy: 'Maxine',
        }],
        [],
      ]),
      clientEventTimelineForEvents: vi.fn(async () => []),
      archivedClientEvents: vi.fn(async () => [{ ...event, id: 'evt_archived_history', archived: true }]),
    };
    const policy = new EventAccessPolicyService({ write: vi.fn() } as never);
    const service = new EventReadModelsService(
      queries as never,
      policy,
      createGuestReader() as never,
      createStaffingReader() as never,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes', actorEmail: 'ana@example.test' });
    const mappers = {
      mapEvent: (value: typeof event) => value,
      mapDocument: (value: unknown) => value,
      mapBriefing: (value: unknown) => value,
      mapBillingStatement: (value: unknown) => value,
      mapClientBillingDispute: (value: unknown) => value,
      mapPaymentMilestone: (value: unknown) => value,
      mapFloorPlanDraft: (value: unknown) => value,
      mapAuditLog: (value: unknown) => value,
    };

    const workspace = await service.clientWorkspace(actor, mappers as never);

    expect(workspace.events).toEqual([event]);
    expect(queries.visibleEvents).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Client, email: 'ana@example.test' }),
      undefined,
    );
    expect(workspace.archivedEvents).toEqual([expect.objectContaining({ id: 'evt_archived_history', archived: true })]);
    expect(queries.clientWorkspaceForEvents).toHaveBeenCalledWith([event.id]);

    expect(workspace.ocularVisits).toEqual([{
      eventId: event.id,
      status: 'waived',
      clientNote: null,
      requestedAt: null,
      scheduledAt: null,
    }]);
  });

  it('pmcmEventWorkspaceIncludesOcularTask', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const request = {
      id: 'ovr_1',
      eventId: 'evt_visible',
      status: 'scheduled',
      clientNote: 'Venue entrance is narrow',
      requestedAt: new Date('2026-10-01T08:00:00.000Z'),
      scheduledAt: new Date('2026-10-05T01:00:00.000Z'),
      completedAt: null,
      waiverReason: null,
      waivedAt: null,
      waivedBy: null,
    };
    prisma.opsOcularVisitRequest.findUnique.mockResolvedValue(request);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const workspace = await service.pmcmEventWorkspace(actor, 'evt_visible', createPassthroughPmcmMappers() as never);

    expect(workspace.ocularVisit).toEqual({
      eventId: request.eventId,
      status: request.status,
      clientNote: request.clientNote,
      requestedAt: request.requestedAt.toISOString(),
      scheduledAt: request.scheduledAt.toISOString(),
      completedAt: null,
      waiverReason: null,
      waivedAt: null,
      waivedBy: null,
    });
    expect(prisma.opsOcularVisitRequest.findUnique).toHaveBeenCalledWith({ where: { eventId: 'evt_visible' } });
  });
  it('filters supplier workspace records through event visibility policy', async () => {
    const { service, policy, prisma } = createSupplierWorkspaceService();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorEmail: 'supplier@example.com',
    });

    const workspace = await service.supplierWorkspace(actor, {
      mapSupplierQuoteRequest: (request) => ({ id: request.id, eventId: request.eventId }),
      mapSupplierQuoteForSupplier: (quote) => ({ id: quote.id, eventId: quote.eventId }),
    });

    expect((workspace as any).quoteRequests).toEqual([{ id: 'qr_visible', eventId: 'evt_visible' }]);
    expect((workspace as any).supplierQuotes).toEqual([{ id: 'quote_visible', eventId: 'evt_visible' }]);
    expect(prisma.opsEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_visible', 'evt_archived'] }, archived: false },
      orderBy: { id: 'asc' },
      take: 500,
    });
  });

  it('keeps PMCM-only supplier assessment data out of the supplier workspace response', async () => {
    const { service, policy, prisma } = createSupplierWorkspaceService();
    const createdAt = new Date('2026-09-01T00:00:00.000Z');
    const supplierFixture = (prisma as any).opsSupplier;
    const supplierRow = await supplierFixture.findFirst();
    supplierFixture.findFirst.mockResolvedValue({
      ...supplierRow,
      performanceNotes: 'PMCM-SENTINEL-performance-note',
      reviews: [{
        id: 'review_1', supplierId: 'sup_sonicline', eventId: 'evt_visible', rating: 2,
        notes: 'PMCM-SENTINEL-review-notes', reviewedBy: 'PMCM-SENTINEL-reviewer', idempotencyKey: null, createdAt,
        dimensionRatings: [{ dimensionId: 'dim_punctuality', rating: 1, dimension: { id: 'dim_punctuality', name: 'PMCM-SENTINEL-dimension' } }],
      }],
      reliabilityNotes: [{ id: 'rel_1', supplierId: 'sup_sonicline', eventId: 'evt_visible', note: 'PMCM-SENTINEL-reliability', createdBy: 'pmcm', createdAt, event: { id: 'evt_visible', eventName: 'Gala' } }],
    });
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorEmail: 'supplier@example.com',
    });

    const workspace = await service.supplierWorkspace(actor, {
      mapSupplierQuoteRequest: (request) => ({ id: request.id, eventId: request.eventId }),
      mapSupplierQuoteForSupplier: (quote) => ({ id: quote.id, eventId: quote.eventId }),
    });

    expect((workspace as any).supplier).toMatchObject({ id: 'sup_sonicline', name: 'Sonic Line Events' });
    const serialized = JSON.stringify(workspace);
    for (const sentinel of ['PMCM-SENTINEL-performance-note', 'PMCM-SENTINEL-review-notes', 'PMCM-SENTINEL-reviewer', 'PMCM-SENTINEL-dimension', 'PMCM-SENTINEL-reliability']) {
      expect(serialized).not.toContain(sentinel);
    }
    for (const key of ['reviews', 'reliabilityNotes', 'performanceNotes', 'aggregateRating', 'pastEvents']) {
      expect((workspace as any).supplier).not.toHaveProperty(key);
    }
  });

  it('builds a supplier readiness board from visible supplier assignments', async () => {
    const { service, policy } = createSupplierWorkspaceService();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorEmail: 'supplier@example.com',
    });

    const board = await service.supplierReadinessBoard(actor);

    expect(board.items).toEqual([
      expect.objectContaining({
        requestId: 'qr_visible',
        eventId: 'evt_visible',
        priority: 'warning',
        contractStatus: 'missing',
        readinessStatus: 'not_confirmed',
      }),
    ]);
    expect(board.counts.warning).toBe(1);
  });

  it.each(['missing', 'submitted', 'changes_requested', 'accepted'])(
    'uses latest real contract review evidence for supplier readiness: %s', async (status) => {
      const { service, policy, prisma } = createSupplierWorkspaceService();
      const request = (await prisma.opsSupplierQuoteRequest.findMany())[0];
      request.contractDocumentId = 'legacy-metadata';
      request.readinessStatus = 'confirmed';
      request.contractVersions = status === 'missing' ? [] : [{ reviewStatus: status }];
      const actor = policy.resolveActor({ actorRole: OpsUserRole.Supplier, supplierId: 'sup_sonicline', actorEmail: 'supplier@example.com' });
      const board = await service.supplierReadinessBoard(actor);
      expect(board.items[0]).toMatchObject({ contractStatus: status, priority: status === 'accepted' ? 'info' : 'warning' });
    },
  );

  it('redacts PMCM verification notes from the supplier readiness board while keeping schedule and concerns', async () => {
    const { service, policy, prisma } = createSupplierWorkspaceService();
    const request = (await prisma.opsSupplierQuoteRequest.findMany())[0] as any;
    Object.assign(request, {
      status: 'selected',
      eventDayVerificationStatus: 'rejected',
      eventDayVerificationNotes: 'PMCM-SENTINEL-verification',
      eventDayVerifiedBy: 'PMCM-SENTINEL-verifier',
      eventDayNotes: 'Truck delayed at gate',
      schedule: {
        ingressAt: new Date('2099-01-01T08:00:00.000Z'), egressAt: new Date('2099-01-01T20:00:00.000Z'),
        location: 'Bay 2', status: 'planned', revision: 1, acknowledgedRevision: 1,
        acknowledgedAt: null, changeRequestNote: null, changeRequestedAt: null,
      },
    });
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Supplier, supplierId: 'sup_sonicline', actorEmail: 'supplier@example.com' });

    const board = await service.supplierReadinessBoard(actor);

    expect(board.items[0]).toMatchObject({
      verificationStatus: 'rejected',
      schedule: { location: 'Bay 2', acknowledged: true },
      concerns: [expect.objectContaining({ kind: 'event_day_note', message: 'Truck delayed at gate' })],
    });
    expect(JSON.stringify(board)).not.toContain('PMCM-SENTINEL');
    expect(board.items[0]).not.toHaveProperty('pmcmReview');
  });

  it('serves PMCM the same per-request readiness item for one event plus private review notes', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    prisma.opsSupplierQuoteRequest.findMany.mockResolvedValue([
      {
        id: 'qr_open', eventId: 'evt_visible', supplierId: 'sup_open', supplierName: 'Open Bid Catering', category: 'Catering',
        status: 'open', dueDate: null, assignmentStatus: 'pending_confirmation', readinessStatus: 'not_requested',
        readinessNotes: '', eventDayStatus: 'not_started', eventDayNotes: '', eventDayVerificationStatus: 'self_reported',
        eventDayVerificationNotes: '', eventDayVerifiedBy: null, eventDayVerifiedAt: null, contractVersions: [], schedule: null,
      },
      {
        id: 'qr_sonic', eventId: 'evt_visible', supplierId: 'sup_sonic', supplierName: 'Sonic Line', category: 'Technicals',
        status: 'selected', dueDate: null, assignmentStatus: 'confirmed', readinessStatus: 'confirmed',
        readinessNotes: 'Crew of six', eventDayStatus: 'set_up_ready', eventDayNotes: '', eventDayVerificationStatus: 'verified',
        eventDayVerificationNotes: 'Rigging checked by PMCM', eventDayVerifiedBy: 'Francis', eventDayVerifiedAt: new Date('2026-06-18T06:00:00.000Z'),
        contractVersions: [{ reviewStatus: 'accepted', reviewReason: null, reviewedAt: null }], schedule: null,
      },
    ] as never);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const board = await service.pmcmSupplierReadinessBoard(actor, 'evt_visible');

    expect(prisma.opsSupplierQuoteRequest.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'evt_visible' } }));
    expect(board.eventId).toBe('evt_visible');
    expect(board.counts).toEqual({ critical: 0, warning: 1, attention: 0, info: 1 });
    expect(board.items.map((item) => [item.requestId, item.quoteLocked])).toEqual([['qr_open', false], ['qr_sonic', true]]);
    expect(board.items[1]).toMatchObject({
      eventName: 'Ayala Summit',
      supplierName: 'Sonic Line',
      setupStatus: 'ready',
      pmcmReview: { verificationNotes: 'Rigging checked by PMCM', verifiedBy: 'Francis', readinessNotes: 'Crew of six' },
    });
  });

  it.each([
    [{ actorRole: OpsUserRole.Supplier, supplierId: 'sup_sonicline', actorEmail: 'supplier@example.com' }, 'supplier'],
    [{ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' }, 'client'],
    [{ actorRole: OpsUserRole.Coordinator, actorName: 'Rhea Santos' }, 'coordinator'],
  ])('denies %o from the PMCM supplier readiness board before reading requests', async (input, role) => {
    const { service, policy, prisma } = createPmcmReadModelService();

    await expect(service.pmcmSupplierReadinessBoard(policy.resolveActor(input as never), 'evt_visible')).rejects.toThrow(
      `${role} cannot access PMCM supplier readiness board`,
    );
    expect(prisma.opsSupplierQuoteRequest.findMany).not.toHaveBeenCalled();
  });

  it('builds a PMCM-only defense readiness checklist through reader ports', async () => {
    const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
    const event = {
      id: 'evt_sample',
      eventName: 'Ayala Summit',
      archived: false,
      floorPlanDrafts: [{ id: 'fpd_approved', status: 'approved' }],
    };
    const queries = {
      defenseReadiness: vi.fn(async () => [
        event,
        [{ id: 'briefing_1' }],
        [{ id: 'qr_1' }],
        [{ id: 'quote_1', status: 'selected' }],
        [],
        [],
         [],
         [{ id: 'pay_1', status: 'pending', remainingBalance: 5000 }],
         {
           briefings: 501,
           floorPlanDrafts: 501,
           approvedFloorplan: 1,
           quoteRequests: 501,
           selectedSupplierQuotes: 500,
           eventDayTasks: 501,
           urgentIssues: 501,
           billingStatements: 501,
           paymentMilestones: 501,
           unpaidPaymentMilestones: 500,
         },
      ]),
    };
    const guestReader = {
      ...createGuestReader(),
      countCheckInsForEvent: vi.fn(async () => 1),
      listCheckInsForEvent: vi.fn(async () => [{ id: 'checkin_1' }]),
      countPendingFeedbackForEvent: vi.fn(async () => 1),
      listFeedbackForEvent: vi.fn(async () => [{ id: 'feedback_1', moderationStatus: 'pending_review' }]),
    };
    const staffingReader = {
      ...createStaffingReader(),
      countAssignmentsForEvent: vi.fn(async () => 1),
      countPendingAssignmentsForEvent: vi.fn(async () => 1),
      listAssignmentsForEvent: vi.fn(async () => [{ id: 'asg_1', status: 'pending_acknowledgement' }]),
    };
    const closureReadinessReader = {
      closeGates: vi.fn(async () => ({ ready: false, missingKeys: ['post_event_report'] })),
    };
    const service = new EventReadModelsService(
      queries as any,
      policy,
      guestReader as any,
      staffingReader as any,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
      closureReadinessReader as any,
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine' });

    const readiness = await service.defenseReadiness(actor, 'evt_sample');

    expect(readiness).toMatchObject({
      eventId: 'evt_sample',
      eventName: 'Ayala Summit',
      overallStatus: 'attention',
      lifecycleStage: 'supplier-coordinator-setup',
      liveAiBlocked: true,
      summary: expect.objectContaining({
        briefingSubmitted: true,
        officialFloorplanApproved: true,
         quoteRequests: 501,
         selectedSuppliers: 500,
        pendingCoordinatorAcknowledgments: 1,
        guestAttendanceCount: 1,
        pendingFeedbackModeration: 1,
        closureReady: false,
      }),
    });
    expect(readiness.liveAiBlocked).toBe(true);
    expect(readiness.deferredScope).toEqual(
      expect.arrayContaining([
        'Live AI calls',
        'QR scanning',
        'Production notification adapters',
        'External auth',
      ]),
    );
    expect(readiness.nextActions.map((action: any) => action.key)).toEqual([
      'briefing',
      'floorplan',
      'suppliers',
      'coordinators',
      'billing',
      'live-ops',
      'closure',
    ]);
    expect(queries.defenseReadiness).toHaveBeenCalledWith('evt_sample');
    expect(staffingReader.listAssignmentsForEvent).toHaveBeenCalledWith('evt_sample');
    expect(guestReader.listCheckInsForEvent).toHaveBeenCalledWith('evt_sample');
    expect(guestReader.listFeedbackForEvent).toHaveBeenCalledWith('evt_sample');
    expect(closureReadinessReader.closeGates).toHaveBeenCalledWith('evt_sample');
  });

  it('denies non-PMCM actors from defense readiness before querying', async () => {
    const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
    const queries = { defenseReadiness: vi.fn() };
    const service = new EventReadModelsService(
      queries as any,
      policy,
      createGuestReader() as any,
      createStaffingReader() as any,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
      { closeGates: vi.fn() } as any,
    );

    await expect(
      service.defenseReadiness(policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' }), 'evt_sample'),
    ).rejects.toThrow('client cannot access defense readiness');
    await expect(
      service.defenseReadiness(policy.resolveActor({ actorRole: OpsUserRole.Guest, actorName: 'Guest User' }), 'evt_sample'),
    ).rejects.toThrow('guest cannot access defense readiness');
    expect(queries.defenseReadiness).not.toHaveBeenCalled();
  });
  it('builds a PMCM command inbox ordered by operational severity', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const inbox = await service.pmcmCommandInbox(actor);

    expect(inbox.counts.critical).toBe(1);
    expect(inbox.summary).toEqual({ activeEvents: 11, pendingInquiries: 3, pendingApprovals: 2 });
    expect(inbox.page).toEqual({ index: 0, size: 10, hasMore: false });
    expect(inbox.items[0]).toMatchObject({
      id: 'billing:pay_overdue',
      kind: 'billing',
      severity: 'critical',
      eventId: 'evt_visible',
    });
    expect(inbox.items.some((item) => item.id === 'inquiry:inq_new')).toBe(true);
  });

  it('builds a client action center from client-visible event work', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const actionCenter = await service.clientActionCenter(actor);

    expect(actionCenter.counts.critical).toBe(1);
    expect(actionCenter.items[0]).toMatchObject({
      id: 'billing:pay_overdue',
      kind: 'billing',
      priority: 'critical',
      eventId: 'evt_visible',
    });
    expect(actionCenter.items.some((item) => item.id === 'briefing:evt_visible')).toBe(true);
    const floorplanItems = actionCenter.items.filter((item) => item.kind === 'floorplan');
    expect(floorplanItems.length).toBeGreaterThan(0);
    expect(floorplanItems.every((item) => item.href?.includes('/floor-plan'))).toBe(true);
  });

  it('surfaces overdue or blocked event-day tasks and open urgent issues as live-ops inbox work', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const inTwoHours = new Date(Date.now() + 2 * 60 * 60 * 1000);
    prisma.opsEventDayTask.findMany.mockImplementation(async () => [
      { id: 'edt_overdue', eventId: 'evt_visible', title: 'Confirm stage power', status: 'open', assignedRole: 'Technical Lead', ownerName: 'Dane', dueAt: null, slaDueAt: hourAgo, slaStatus: 'on_track' },
      { id: 'edt_blocked', eventId: 'evt_visible', title: 'Release VIP gate', status: 'blocked', assignedRole: 'Access Lead', ownerName: '', dueAt: inTwoHours, slaDueAt: inTwoHours, slaStatus: 'on_track' },
      { id: 'edt_on_track', eventId: 'evt_visible', title: 'Brief ushers', status: 'in_progress', assignedRole: 'Usher Lead', ownerName: '', dueAt: inTwoHours, slaDueAt: inTwoHours, slaStatus: 'on_track' },
    ]);
    prisma.opsUrgentIssue.findMany.mockImplementation(async () => [
      { id: 'iss_high', eventId: 'evt_visible', title: 'Projector failure', severity: 'high', status: 'open', slaDueAt: inTwoHours, slaStatus: 'on_track', createdAt: hourAgo },
      { id: 'iss_low', eventId: 'evt_visible', title: 'Signage typo', severity: 'low', status: 'assigned', slaDueAt: null, slaStatus: 'on_track', createdAt: hourAgo },
      { id: 'iss_hidden', eventId: 'evt_archived_or_missing', title: 'Unscoped', severity: 'critical', status: 'open', slaDueAt: null, slaStatus: 'on_track', createdAt: hourAgo },
    ]);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const inbox = await service.pmcmCommandInbox(actor);

    const liveOps = inbox.items.filter((item) => item.kind === 'live_ops');
    expect(liveOps.map((item) => [item.id, item.severity, item.status])).toEqual([
      ['live-ops:task:edt_overdue', 'critical', 'overdue'],
      // Same severity and due time: ties break on the stable item id.
      ['live-ops:issue:iss_high', 'warning', 'open'],
      ['live-ops:task:edt_blocked', 'warning', 'blocked'],
      ['live-ops:issue:iss_low', 'attention', 'assigned'],
    ]);
    expect(liveOps.every((item) => item.href === '/dashboard/events/evt_visible/live-ops')).toBe(true);
    const severities = inbox.items.map((item) => item.severity);
    expect(severities).toEqual([...severities].sort((left, right) =>
      ['critical', 'warning', 'attention', 'info'].indexOf(left) - ['critical', 'warning', 'attention', 'info'].indexOf(right)));
    expect(inbox.counts.critical).toBe(2);
    expect(prisma.opsEventDayTask.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 0, take: 11 }));
  });

  it('asks clients for feedback only inside the post-event window and only until they respond', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const ended = { id: 'evt_ended', eventName: 'Ended Gala', clientName: 'Ana Reyes', eventDate: new Date('2026-05-01T00:00:00.000Z'), status: 'completed', floorPlanStatus: 'approved', clientPortalStatus: 'unlocked', archived: false, actualEndedAt: new Date('2026-05-01T22:00:00.000Z'), floorPlanDrafts: [] };
    const responded = { ...ended, id: 'evt_responded', eventName: 'Responded Gala' };
    const upcoming = { ...ended, id: 'evt_upcoming', eventName: 'Upcoming Gala', status: 'planning', actualEndedAt: null };
    prisma.opsEvent.findMany.mockImplementation(async () => [ended, responded, upcoming] as never);
    prisma.opsClientCloseoutResponse.findMany.mockImplementation(async () => [{ id: 'resp_1', eventId: 'evt_responded' }]);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const actionCenter = await service.clientActionCenter(actor);

    const feedback = actionCenter.items.filter((item) => item.kind === 'feedback');
    expect(feedback).toEqual([expect.objectContaining({
      id: 'feedback:evt_ended',
      eventId: 'evt_ended',
      priority: 'attention',
      href: '/dashboard/events/evt_ended/summary',
    })]);
  });

  it('shows client-visible change request status without PMCM-only reasons, notes, or actors', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const recent = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    const internal = { reason: 'Internal margin concern', decisionNote: 'PMCM-only decision note', requestedBy: 'Ms. Mys', decidedBy: 'Francis', consumedAt: null };
    // The mock returns internal columns too, proving the projection strips them even if a query ever over-selects.
    prisma.opsEventFreezeException.findMany.mockImplementation(async () => [
      { id: 'fx_pending', eventId: 'evt_visible', requestedChange: 'Add 20 guests', status: 'pending', requestedAt: recent, decidedAt: null, ...internal },
      { id: 'fx_rejected', eventId: 'evt_visible', requestedChange: 'Move to ballroom B', status: 'rejected', requestedAt: recent, decidedAt: recent, ...internal },
      { id: 'fx_other', eventId: 'evt_other_client', requestedChange: 'Hidden', status: 'pending', requestedAt: recent, decidedAt: null, ...internal },
    ]);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const actionCenter = await service.clientActionCenter(actor);

    const changes = actionCenter.items.filter((item) => item.kind === 'change_request');
    expect(changes.map((item) => [item.id, item.status, item.priority])).toEqual([
      ['change-request:fx_rejected', 'not_approved', 'attention'],
      ['change-request:fx_pending', 'under_review', 'info'],
    ]);
    const allowedKeys = ['id', 'kind', 'priority', 'label', 'description', 'status', 'eventId', 'eventName', 'dueAt', 'href'];
    for (const item of actionCenter.items) {
      expect(Object.keys(item).every((key) => allowedKeys.includes(key))).toBe(true);
    }
    const serialized = JSON.stringify(actionCenter.items);
    for (const secret of ['Internal margin concern', 'PMCM-only decision note', 'Ms. Mys', 'Francis', 'clientName']) {
      expect(serialized).not.toContain(secret);
    }
    const query = (prisma.opsEventFreezeException.findMany.mock.calls as unknown as Array<[{ select: Record<string, boolean> }]>)[0][0];
    expect(Object.keys(query.select).sort()).toEqual(['decidedAt', 'eventId', 'id', 'requestedAt', 'requestedChange', 'status']);
  });

  it('omits internal billing sources for client actors while still serving statements and milestones', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    prisma.opsBillingSource.findMany.mockImplementation(async () => [{ id: 'ce_hidden', eventId: 'evt_visible' }]);
    prisma.opsBillingStatement.findMany.mockImplementation(async () => [{ id: 'bill_visible', eventId: 'evt_visible', generatedAt: new Date(), storageKey: 'internal-key' }]);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const billing = await service.billing(actor, {
      mapEvent: (event) => event,
      mapBillingSource: (source) => source,
      mapBillingStatement: (statement) => statement,
      mapBillingCorrection: (correction) => correction,
      mapBillingDispute: (dispute) => dispute,
      mapAdditionalBilling: (billing) => billing,
      mapPaymentMilestone: (payment) => payment,
      mapPaymentRecord: (record) => record,
    });

    expect(billing.billingSources).toEqual([]);
    expect(billing.billingStatements).toEqual([expect.objectContaining({ id: 'bill_visible', eventId: 'evt_visible' })]);
    expect(JSON.stringify(billing.billingStatements)).not.toContain('internal-key');
    expect(prisma.opsBillingSource.findMany).not.toHaveBeenCalled();
    expect(prisma.opsBillingStatement.findMany).toHaveBeenCalled();
  });

  it('serves PMCM-only billing adjustments and withholds them from client billing reads', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const adjustmentRows = {
      billingDisputes: [{ id: 'dispute_1', eventId: 'evt_visible', reason: 'Internal reason', resolutionNotes: null }],
      additionalBillings: [{ id: 'addbill_1', eventId: 'evt_visible', waivedBy: 'Francis' }],
      billingCorrections: [{ id: 'corr_1', eventId: 'evt_visible', reason: 'Tax line' }],
    };
    prisma.opsBillingCorrection.findMany.mockImplementation(async () => adjustmentRows.billingCorrections);
    prisma.opsBillingDispute.findMany.mockImplementation(async () => adjustmentRows.billingDisputes);
    prisma.opsAdditionalBilling.findMany.mockImplementation(async () => adjustmentRows.additionalBillings);
    const mappers = {
      mapEvent: (event: unknown) => event,
      mapBillingSource: (source: unknown) => source,
      mapBillingStatement: (statement: unknown) => statement,
      mapBillingCorrection: (correction: unknown) => correction,
      mapBillingDispute: (dispute: unknown) => dispute,
      mapAdditionalBilling: (billing: unknown) => billing,
      mapPaymentMilestone: (payment: unknown) => payment,
      mapPaymentRecord: (record: unknown) => record,
    };

    const pmcmBilling = await service.billing(policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Francis' }), mappers as never);
    expect(pmcmBilling.billingDisputes).toEqual(adjustmentRows.billingDisputes);
    expect(pmcmBilling.additionalBillings).toEqual(adjustmentRows.additionalBillings);
    expect(pmcmBilling.billingCorrections).toEqual(adjustmentRows.billingCorrections);

    prisma.opsBillingDispute.findMany.mockClear();
    prisma.opsAdditionalBilling.findMany.mockClear();
    const clientBilling = await service.billing(policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' }), mappers as never);
    expect(clientBilling.billingDisputes).toEqual([]);
    expect(clientBilling.additionalBillings).toEqual([]);
    expect(clientBilling.billingCorrections).toEqual([]);
    expect(prisma.opsBillingDispute.findMany).not.toHaveBeenCalled();
    expect(prisma.opsAdditionalBilling.findMany).not.toHaveBeenCalled();
  });

  it('builds a selected PMCM event workspace from event-scoped records', async () => {
    const { service, policy, prisma, guestReader } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const workspace = await service.pmcmEventWorkspace(actor, 'evt_visible', {
      coordinatorRoleRequirements: [],
      mapUser: (user) => user,
      mapInquiry: (inquiry) => inquiry,
      mapEvent: (event) => ({ id: event.id, eventName: event.eventName }),
      mapDocument: (document) => document,
      mapBriefing: (briefing) => briefing,
      mapSupplierQuoteRequest: (request) => request,
      mapSupplierQuote: (quote) => quote,
      mapCoordinator: (coordinator) => coordinator,
      mapCoordinatorAssignment: (assignment) => assignment,
      mapComplianceRule: (rule) => rule,
      mapComplianceCheck: (check) => check,
      mapBillingSource: (source) => source,
      mapBillingStatement: (statement) => statement,
      mapPaymentMilestone: (payment) => payment,
      mapPaymentRecord: (record) => record,
      mapPostEventDocument: (document) => document,
      mapEventInsight: (insight) => insight,
      mapFloorPlanDraft: (draft) => draft,
      mapAuditLog: (log) => log,
      mapNotificationLog: (log) => log,
      mapRegistrationPlatform: (platform) => platform,
    });

    expect(workspace.event).toEqual({ id: 'evt_visible', eventName: 'Ayala Summit' });
    expect(workspace.documents).toEqual([{ id: 'doc_1', eventId: 'evt_visible' }]);
    expect((workspace as any).guestAttendanceCount).toBe(0);
    expect(guestReader.listCheckInsForEvent).toHaveBeenCalledWith('evt_visible');
    expect(guestReader.listFeedbackForEvent).toHaveBeenCalledWith('evt_visible');
    expect(prisma.opsDocument.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_visible' },
      orderBy: [{ uploadedAt: 'desc' }, { id: 'desc' }],
      take: 500,
    });
  });
  it('denies non-PMCM actors from the PMCM command inbox', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    await expect(service.pmcmCommandInbox(actor)).rejects.toThrow('client cannot access PMCM command inbox');
  });

  it('denies PMCM actors from the client action center contract', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    await expect(service.clientActionCenter(actor)).rejects.toThrow('pmcm-admin cannot access client action center');
  });

  it('denies clients from supplier readiness board records', async () => {
    const { service, policy } = createSupplierWorkspaceService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    await expect(service.supplierReadinessBoard(actor)).rejects.toThrow('client cannot access supplier readiness board');
  });

  it('denies suppliers from client workspace records', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorEmail: 'supplier@example.com',
    });

    await expect(
      service.clientWorkspace(actor, {
        mapEvent: (event) => event,
        mapDocument: (document) => document,
        mapBriefing: (briefing) => briefing,
        mapBillingStatement: (statement) => statement,
        mapClientBillingDispute: (dispute) => dispute,
        mapPaymentMilestone: (payment) => payment,
        mapFloorPlanDraft: (draft) => draft,
        mapAuditLog: (log) => log,
      }),
    ).rejects.toThrow('supplier cannot access client workspace');
  });

  it('denies clients from PMCM selected event workspace records', async () => {
    const { service, policy } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    await expect(service.pmcmEventWorkspace(actor, 'evt_visible', createPassthroughPmcmMappers())).rejects.toThrow(
      'client cannot access PMCM event workspace',
    );
  });

  it('builds PMCM dashboard payloads with operational fields from bounded read models', async () => {
    const { service, policy, prisma } = createPmcmReadModelService();
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    const dashboard = await service.pmcmDashboard(actor, createPassthroughPmcmMappers());

    expect((dashboard as any).users).toEqual([expect.objectContaining({ id: 'usr_pmcm', role: OpsUserRole.PmcmAdmin })]);
    expect((dashboard as any).events).toEqual([expect.objectContaining({ id: 'evt_visible', eventName: 'Ayala Summit' })]);
    expect((dashboard as any).documents).toEqual([{ id: 'doc_1', eventId: 'evt_visible' }]);
    expect((dashboard as any).paymentMilestones).toEqual([expect.objectContaining({ id: 'pay_overdue' })]);
    expect((dashboard as any).coordinators).toEqual([expect.objectContaining({ id: 'coord_lead' })]);
    expect((dashboard as any).coordinatorAssignments).toEqual([]);
    expect((dashboard as any).supplierCategories).toEqual([
      expect.objectContaining({ id: 'supcat_technicals', acceptableMin: 120000, acceptableMax: 180000 }),
    ]);
    expect((dashboard as any).suppliers).toEqual([expect.objectContaining({ id: 'sup_sonicline', categoryName: 'Technicals' })]);
    expect(prisma.opsUser.findMany).toHaveBeenCalledWith({ take: 500, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    expect(prisma.opsSupplierCategory.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }], take: 500 });
  });

  it('uses one bounded query-builder pass for high-volume PMCM dashboard records', async () => {
    const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
    const queries = {
      pmcmDashboard: vi.fn(async () => [
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
        [],
      ]),
      activeCoordinators: vi.fn(async () => []),
      boundedCoordinatorAssignments: vi.fn(async () => []),
    };
    const service = new EventReadModelsService(
      queries as any,
      policy,
      createGuestReader() as any,
      createStaffingReader() as any,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.PmcmAdmin, actorName: 'Ms. Mys' });

    await service.pmcmDashboard(actor, createPassthroughPmcmMappers());

    expect(queries.pmcmDashboard).toHaveBeenCalledTimes(1);
    expect(queries.activeCoordinators).toHaveBeenCalledTimes(1);
    expect(queries.boundedCoordinatorAssignments).toHaveBeenCalledTimes(1);
  });
  it('keeps client action-center work scoped to the client visible event set', async () => {
    const eventVisible = {
      id: 'evt_visible',
      eventName: 'Ayala Summit',
      clientName: 'Ana Reyes',
      eventDate: new Date('2026-06-18T00:00:00.000Z'),
      status: 'planning',
      floorPlanStatus: 'not_started',
      clientPortalStatus: 'unlocked',
      archived: false,
      floorPlanDrafts: [],
    };
    const eventOtherClient = {
      ...eventVisible,
      id: 'evt_other_client',
      eventName: 'Other Summit',
      clientName: 'Ramon Cruz',
    };
    const prisma = {
      $queryRaw: vi.fn(async () => []),
      opsEvent: {
        findMany: vi.fn(async () => [eventVisible, eventOtherClient]),
        count: vi.fn(async () => 2),
      },
      opsBriefing: { findMany: vi.fn(async () => []) },
      opsDocument: { findMany: vi.fn(async () => []) },
      opsFloorPlanDraft: { findMany: vi.fn(async () => []) },
      opsBillingStatement: { findMany: vi.fn(async () => []) },
      opsPaymentMilestone: {
        findMany: vi.fn(async () => [
          {
            id: 'pay_visible',
            eventId: 'evt_visible',
            label: 'Visible balance',
            amount: 25000,
            status: 'pending',
            dueDate: new Date('2026-01-01T00:00:00.000Z'),
            createdAt: new Date('2025-12-01T00:00:00.000Z'),
          },
          {
            id: 'pay_hidden',
            eventId: 'evt_other_client',
            label: 'Hidden balance',
            amount: 25000,
            status: 'pending',
            dueDate: new Date('2026-01-01T00:00:00.000Z'),
            createdAt: new Date('2025-12-01T00:00:00.000Z'),
          },
        ]),
      },
      opsPaymentRecord: { findMany: vi.fn(async () => []) },
      opsPostEventDocument: { findMany: vi.fn(async () => []) },
      opsClientCloseoutResponse: { findMany: vi.fn(async () => []) },
      opsEventFreezeException: { findMany: vi.fn(async () => []) },
    };
    const policy = new EventAccessPolicyService({ write: vi.fn() } as any);
    const guestReader = createGuestReader();
    const staffingReader = createStaffingReader();
    const service = new EventReadModelsService(
      new EventReadModelQueries(prisma as any),
      policy,
      guestReader as any,
      staffingReader as any,
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const actionCenter = await service.clientActionCenter(actor);

    expect(actionCenter.items.map((item) => item.eventId)).toContain('evt_visible');
    expect(actionCenter.items.map((item) => item.eventId)).not.toContain('evt_other_client');
    expect(prisma.opsPaymentMilestone.findMany).toHaveBeenCalledWith({
      where: { eventId: { in: ['evt_visible'] } },
      orderBy: { id: 'asc' },
      take: 500,
    });
  });

  it('composes source-backed milestones only for visible client events', async () => {
    const readyEvent = {
      id: 'evt_ready',
      eventName: 'Ready Summit',
      clientName: 'Ana Reyes',
      eventDate: new Date('2026-03-01T00:00:00.000Z'),
      status: 'planning',
      clientPortalStatus: 'unlocked',
      clientEventDayViewEnabled: false,
      archived: false,
      floorPlanDrafts: [],
    };
    const pendingEvent = {
      ...readyEvent,
      id: 'evt_pending',
      eventName: 'Pending Summit',
      eventDate: new Date('2026-06-01T00:00:00.000Z'),
      clientEventDayViewEnabled: true,
    };
    const completedEvent = {
      ...readyEvent,
      id: 'evt_completed',
      eventName: 'Completed Summit',
      eventDate: new Date('2026-04-01T00:00:00.000Z'),
      status: 'completed',
    };
    const hiddenEvent = { ...readyEvent, id: 'evt_hidden', clientName: 'Ramon Cruz' };
    const milestoneRows = [
      {
        id: 'evt_ready',
        eventDate: readyEvent.eventDate,
        status: 'planning',
        archived: false,
        proposalClientStatus: 'approved',
        proposalReviewedAt: new Date('2026-02-01T00:00:00.000Z'),
        inquiry: { conformeSignedAt: new Date('2026-01-01T00:00:00.000Z') },
        floorPlanDrafts: [
          { isActive: true, approvedAt: new Date('2026-02-10T00:00:00.000Z') },
        ],
        paymentMilestones: [
          {
            dueDate: new Date('2026-02-20T00:00:00.000Z'),
            status: 'pending',
            remainingBalance: 500,
          },
        ],
      },
      {
        id: 'evt_pending',
        eventDate: pendingEvent.eventDate,
        status: 'planning',
        archived: false,
        proposalClientStatus: 'revision_requested',
        proposalReviewedAt: new Date('2025-12-01T00:00:00.000Z'),
        inquiry: { conformeSignedAt: null },
        floorPlanDrafts: [],
        paymentMilestones: [],
      },
      {
        id: 'evt_completed',
        eventDate: completedEvent.eventDate,
        status: 'completed',
        archived: false,
        proposalClientStatus: 'revision_requested',
        proposalReviewedAt: null,
        inquiry: { conformeSignedAt: null },
        floorPlanDrafts: [],
        paymentMilestones: [
          {
            dueDate: new Date('2026-03-20T00:00:00.000Z'),
            status: 'pending',
            remainingBalance: 0,
          },
        ],
      },
      {
        id: 'evt_hidden',
        eventDate: hiddenEvent.eventDate,
        status: 'completed',
        archived: false,
        proposalClientStatus: 'approved',
        proposalReviewedAt: new Date('2025-01-01T00:00:00.000Z'),
        inquiry: { conformeSignedAt: new Date('2025-01-01T00:00:00.000Z') },
        floorPlanDrafts: [],
        paymentMilestones: [],
      },
    ];
    const paymentMilestones = [
      {
        id: 'pay_later',
        eventId: 'evt_ready',
        label: 'Balance payment',
        dueDate: new Date('2026-02-21T00:00:00.000Z'),
        status: 'paid',
        remainingBalance: 0,
      },
      {
        id: 'pay_first',
        eventId: 'evt_ready',
        label: 'Final BALANCE',
        dueDate: new Date('2026-02-20T00:00:00.000Z'),
        status: 'pending',
        remainingBalance: 500,
      },
    ];
    const queries = {
      visibleEvents: vi.fn(async () => ({
        items: [readyEvent, pendingEvent, completedEvent, hiddenEvent],
        pagination: { nextCursor: null, hasMore: false, totalCount: 4 },
      })),
      clientWorkspaceForEvents: vi.fn(async () => [
        [],
        [],
        [],
        [],
        paymentMilestones,
        [],
        [],
        [],
        [],
      ]),
      clientEventTimelineForEvents: vi.fn(async (eventIds: string[]) => {
        expect(eventIds).toEqual(['evt_ready', 'evt_pending', 'evt_completed']);
        return milestoneRows;
      }),
      archivedClientEvents: vi.fn(async () => []),
    };
    const policy = new EventAccessPolicyService(
      { write: vi.fn() } as unknown as ConstructorParameters<typeof EventAccessPolicyService>[0],
    );
    const service = new EventReadModelsService(
      queries as unknown as ConstructorParameters<typeof EventReadModelsService>[0],
      policy,
      createGuestReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[2],
      createStaffingReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[3],
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });
    const mappers = {
      mapEvent: (event: typeof readyEvent) => event,
      mapDocument: (document: unknown) => document,
      mapBriefing: (briefing: unknown) => briefing,
      mapBillingStatement: (statement: unknown) => statement,
      mapClientBillingDispute: (dispute: unknown) => dispute,
      mapPaymentMilestone: (payment: unknown) => payment,
      mapFloorPlanDraft: (draft: unknown) => draft,
      mapAuditLog: (log: unknown) => log,
    };

    const workspace = await service.clientWorkspace(
      actor,
      mappers as unknown as Parameters<EventReadModelsService['clientWorkspace']>[1],
    );

    expect(queries.clientEventTimelineForEvents).toHaveBeenCalledWith(['evt_ready', 'evt_pending', 'evt_completed']);
    expect(workspace.events).toContainEqual(expect.objectContaining({
      id: 'evt_ready',
      clientEventDayViewEnabled: false,
    }));
    expect(workspace.clientEventTimelines).toEqual([
      {
        eventId: 'evt_ready',
        milestones: [
          { key: 'conforme_signed', date: '2026-01-01', status: 'completed' },
          { key: 'proposal_accepted', date: '2026-02-01', status: 'completed' },
          { key: 'floor_plan_approved', date: '2026-02-10', status: 'completed' },
          { key: 'balance_payment_due', date: '2026-02-20', status: 'current' },
          { key: 'event_date', date: '2026-03-01', status: 'pending' },
        ],
      },
      {
        eventId: 'evt_pending',
        milestones: [
          { key: 'conforme_signed', date: null, status: 'current' },
          { key: 'proposal_accepted', date: null, status: 'pending' },
          { key: 'floor_plan_approved', date: null, status: 'pending' },
          { key: 'balance_payment_due', date: null, status: 'pending' },
          { key: 'event_date', date: '2026-06-01', status: 'pending' },
        ],
      },
      {
        eventId: 'evt_completed',
        milestones: [
          { key: 'conforme_signed', date: null, status: 'pending' },
          { key: 'proposal_accepted', date: null, status: 'pending' },
          { key: 'floor_plan_approved', date: null, status: 'pending' },
          { key: 'balance_payment_due', date: '2026-03-20', status: 'completed' },
          { key: 'event_date', date: '2026-04-01', status: 'completed' },
        ],
      },
    ]);
    expect(workspace.clientEventTimelines).not.toContainEqual(
      expect.objectContaining({ eventId: 'evt_hidden' }),
    );
  });

  it('returns an empty client timeline collection when no events are visible', async () => {
    const queries = { visibleEvents: vi.fn(async () => ({
        items: [],
        pagination: { nextCursor: null, hasMore: false, totalCount: 0 },
      })),
      archivedClientEvents: vi.fn(async () => []),
    };
    const policy = new EventAccessPolicyService(
      { write: vi.fn() } as unknown as ConstructorParameters<typeof EventAccessPolicyService>[0],
    );
    const service = new EventReadModelsService(
      queries as unknown as ConstructorParameters<typeof EventReadModelsService>[0],
      policy,
      createGuestReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[2],
      createStaffingReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[3],
      createFloorplanReader(),
      createEventClientFloorplanAccessReader(),
    );
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const workspace = await service.clientWorkspace(
      actor,
      {} as unknown as Parameters<EventReadModelsService['clientWorkspace']>[1],
    );

    expect(workspace.clientEventTimelines).toEqual([]);
  });

  it('composes only minimal snapshots for currently shared event grants', async () => {
    const eventClientFloorplanAccessReader = {
      listActiveSharedEvents: vi.fn(async () => [{
        eventId: 'evt_shared',
        eventName: 'Shared Gala',
        eventDate: '2026-11-12T00:00:00.000Z',
      }]),
    };
    const floorplanReader = {
      listClientSnapshotEntries: vi.fn(async () => [
        {
          eventId: 'evt_shared',
          draftId: 'fpd_approved',
          draftName: 'Official Layout',
          draftStatus: 'approved',
          availableSnapshots: ['submitted', 'approved'],
        },
        {
          eventId: 'evt_ungranted',
          draftId: 'fpd_ungranted',
          draftName: 'Should be filtered',
          draftStatus: 'approved',
          availableSnapshots: ['approved'],
        },
      ]),
    };
    const policy = new EventAccessPolicyService(
      { write: vi.fn() } as unknown as ConstructorParameters<typeof EventAccessPolicyService>[0],
    );
    const service = new EventReadModelsService(
      {} as unknown as ConstructorParameters<typeof EventReadModelsService>[0],
      policy,
      createGuestReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[2],
      createStaffingReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[3],
      floorplanReader as never,
      eventClientFloorplanAccessReader as never,
    );
    const actor = {
      ...policy.resolveActor({
        actorId: 'client_secondary',
        actorRole: OpsUserRole.Client,
        actorEmail: 'secondary@example.test',
      }),
      verified: true,
    };

    await expect(service.clientSharedFloorplans(actor)).resolves.toEqual([{
      eventId: 'evt_shared',
      eventName: 'Shared Gala',
      eventDate: '2026-11-12T00:00:00.000Z',
      draftId: 'fpd_approved',
      draftName: 'Official Layout',
      draftStatus: 'approved',
      availableSnapshots: ['submitted', 'approved'],
    }]);
    expect(eventClientFloorplanAccessReader.listActiveSharedEvents).toHaveBeenCalledWith('client_secondary');
    expect(floorplanReader.listClientSnapshotEntries).toHaveBeenCalledWith(['evt_shared']);
  });

  it('does not query snapshots when there are no active shared events', async () => {
    const eventClientFloorplanAccessReader = { listActiveSharedEvents: vi.fn(async () => []) };
    const floorplanReader = { listClientSnapshotEntries: vi.fn(async () => []) };
    const policy = new EventAccessPolicyService(
      { write: vi.fn() } as unknown as ConstructorParameters<typeof EventAccessPolicyService>[0],
    );
    const service = new EventReadModelsService(
      {} as unknown as ConstructorParameters<typeof EventReadModelsService>[0],
      policy,
      createGuestReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[2],
      createStaffingReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[3],
      floorplanReader as never,
      eventClientFloorplanAccessReader as never,
    );

    const actor = {
      ...policy.resolveActor({ actorId: 'client_1', actorRole: OpsUserRole.Client }),
      verified: true,
    };
    await expect(service.clientSharedFloorplans(actor)).resolves.toEqual([]);
    expect(floorplanReader.listClientSnapshotEntries).not.toHaveBeenCalled();
  });

  it('rejects non-Client actors before querying shared floorplan readers', async () => {
    const eventClientFloorplanAccessReader = { listActiveSharedEvents: vi.fn(async () => []) };
    const floorplanReader = { listClientSnapshotEntries: vi.fn(async () => []) };
    const policy = new EventAccessPolicyService(
      { write: vi.fn() } as unknown as ConstructorParameters<typeof EventAccessPolicyService>[0],
    );
    const service = new EventReadModelsService(
      {} as unknown as ConstructorParameters<typeof EventReadModelsService>[0],
      policy,
      createGuestReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[2],
      createStaffingReader() as unknown as ConstructorParameters<typeof EventReadModelsService>[3],
      floorplanReader as never,
      eventClientFloorplanAccessReader as never,
    );

    await expect(service.clientSharedFloorplans(policy.resolveActor({ actorId: 'admin_1', actorRole: OpsUserRole.PmcmAdmin }))).rejects.toThrow(
      'pmcm-admin cannot access client shared floorplans',
    );
    expect(eventClientFloorplanAccessReader.listActiveSharedEvents).not.toHaveBeenCalled();
    expect(floorplanReader.listClientSnapshotEntries).not.toHaveBeenCalled();
  });
});
