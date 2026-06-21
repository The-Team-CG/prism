import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '../ops.constants';
import { EventAccessPolicyService } from './event-access-policy.service';
import { EventReadModelsService } from './event-read-models.service';

function createGuestReader() {
  return {
    listCheckInsForEvent: vi.fn(async () => []),
    listFeedbackForEvent: vi.fn(async () => []),
    mapGuestCheckIn: vi.fn((checkIn) => checkIn),
    mapGuestFeedback: vi.fn((feedback) => feedback),
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
  const suppliersService = {
    listSuppliers: vi.fn(async () => [
      {
        id: 'sup_sonicline',
        name: 'Sonic Line Events',
        email: 'supplier@example.com',
        reviews: [],
        reliabilityNotes: [],
        performanceNotes: '',
        aggregateRating: null,
        lastEventDate: null,
        pastEvents: [],
      },
    ]),
  };
  const guestReader = createGuestReader();
  const service = new EventReadModelsService(prisma as any, policy, suppliersService as any, guestReader as any);
  return { service, prisma, policy, guestReader };
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
    opsComplianceCheck: { findMany: vi.fn(async () => []) },
    opsBillingSource: { findMany: vi.fn(async () => []) },
    opsBillingStatement: { findMany: vi.fn(async () => []) },
    opsPaymentRecord: { findMany: vi.fn(async () => []) },
    opsEventInsight: { findMany: vi.fn(async () => []) },
    opsAuditLog: { findMany: vi.fn(async () => []) },
    opsNotificationLog: { findMany: vi.fn(async () => []) },
  };
  const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
  const guestReader = createGuestReader();
  const service = new EventReadModelsService(prisma as any, policy, {} as any, guestReader as any);
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
    const service = new EventReadModelsService(prisma as any, policy, {} as any, guestReader as any);
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
