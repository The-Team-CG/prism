import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { EventAccessPolicyService } from '@prism/modules/access-control';
import { EventReadModelQueries } from '../queries/event-read-models.queries';
import { EventReadModelsService } from './event-read-models.service';

function createGuestReader() {
  return {
    listCheckInsForEvent: vi.fn(async () => []),
    listFeedbackForEvent: vi.fn(async () => []),
    mapGuestCheckIn: vi.fn((checkIn) => checkIn),
    mapGuestFeedback: vi.fn((feedback) => feedback),
  };
}

function createStaffingReader() {
  return {
    listAssignmentsForEvent: vi.fn(async () => []),
    listCoordinators: vi.fn(async () => []),
  };
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
      contractDocumentId: null,
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
      createdAt: new Date('2026-05-01T00:00:00.000Z'),
    },
  ];
  const quotes = [
    { id: 'quote_visible', eventId: 'evt_visible', supplierId: 'sup_sonicline' },
    { id: 'quote_archived', eventId: 'evt_archived', supplierId: 'sup_sonicline' },
  ];
  const prisma = {
    opsSupplierQuoteRequest: {
      findMany: vi.fn(async () => requests),
    },
    opsSupplierQuote: {
      findMany: vi.fn(async () => quotes),
    },
    opsEvent: {
      findMany: vi.fn(async () => [
        { id: 'evt_visible', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked', archived: false },
      ]),
    },
  };
  const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
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
  (prisma as any).opsSupplier = { findMany: vi.fn(async () => supplierRows) };
  const guestReader = createGuestReader();
  const staffingReader = createStaffingReader();
  const service = new EventReadModelsService(
    new EventReadModelQueries(prisma as any),
    policy,
    guestReader as any,
    staffingReader as any,
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
      findMany: vi.fn(async () => [event]),
      findUnique: vi.fn(async () => event),
    },
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
    opsBillingSource: { findMany: vi.fn(async () => []) },
    opsBillingStatement: { findMany: vi.fn(async () => []) },
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
  };
  const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
  const guestReader = createGuestReader();
  const staffingReader = createStaffingReader();
  const service = new EventReadModelsService(
    new EventReadModelQueries(prisma as any),
    policy,
    guestReader as any,
    staffingReader as any,
  );
  return { service, prisma, policy, guestReader };
}

describe('EventReadModelsService', () => {
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
    });
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

  it('builds a PMCM-only defense readiness checklist through reader ports', async () => {
    const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
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
      ]),
    };
    const guestReader = {
      ...createGuestReader(),
      listCheckInsForEvent: vi.fn(async () => [{ id: 'checkin_1' }]),
      listFeedbackForEvent: vi.fn(async () => [{ id: 'feedback_1', moderationStatus: 'pending_review' }]),
    };
    const staffingReader = {
      ...createStaffingReader(),
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
        quoteRequests: 1,
        selectedSuppliers: 1,
        pendingCoordinatorAcknowledgments: 1,
        guestAttendanceCount: 1,
        pendingFeedbackModeration: 1,
        closureReady: false,
      }),
    });
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
    const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
    const queries = { defenseReadiness: vi.fn() };
    const service = new EventReadModelsService(
      queries as any,
      policy,
      createGuestReader() as any,
      createStaffingReader() as any,
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
    });

    expect(workspace.event).toEqual({ id: 'evt_visible', eventName: 'Ayala Summit' });
    expect(workspace.documents).toEqual([{ id: 'doc_1', eventId: 'evt_visible' }]);
    expect((workspace as any).guestAttendanceCount).toBe(0);
    expect(guestReader.listCheckInsForEvent).toHaveBeenCalledWith('evt_visible');
    expect(guestReader.listFeedbackForEvent).toHaveBeenCalledWith('evt_visible');
    expect(prisma.opsDocument.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_visible' },
      orderBy: { uploadedAt: 'desc' },
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
    expect(prisma.opsUser.findMany).toHaveBeenCalledWith({ take: 500, orderBy: { createdAt: 'asc' } });
    expect(prisma.opsSupplierCategory.findMany).toHaveBeenCalledWith({ where: { active: true }, orderBy: { sortOrder: 'asc' } });
  });

  it('uses one bounded query-builder pass for high-volume PMCM dashboard records', async () => {
    const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
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
      opsEvent: {
        findMany: vi.fn(async () => [eventVisible, eventOtherClient]),
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
          },
          {
            id: 'pay_hidden',
            eventId: 'evt_other_client',
            label: 'Hidden balance',
            amount: 25000,
            status: 'pending',
            dueDate: new Date('2026-01-01T00:00:00.000Z'),
          },
        ]),
      },
      opsPaymentRecord: { findMany: vi.fn(async () => []) },
      opsPostEventDocument: { findMany: vi.fn(async () => []) },
    };
    const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
    const guestReader = createGuestReader();
    const staffingReader = createStaffingReader();
    const service = new EventReadModelsService(new EventReadModelQueries(prisma as any), policy, guestReader as any, staffingReader as any);
    const actor = policy.resolveActor({ actorRole: OpsUserRole.Client, clientName: 'Ana Reyes' });

    const actionCenter = await service.clientActionCenter(actor);

    expect(actionCenter.items.map((item) => item.eventId)).toContain('evt_visible');
    expect(actionCenter.items.map((item) => item.eventId)).not.toContain('evt_other_client');
    expect(prisma.opsPaymentMilestone.findMany).toHaveBeenCalledWith({
      where: { eventId: { in: ['evt_visible'] } },
      orderBy: { createdAt: 'asc' },
    });
  });
});
