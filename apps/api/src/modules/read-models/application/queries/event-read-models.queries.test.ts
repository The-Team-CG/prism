import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import {
  EventReadModelQueries,
  EVENT_READ_PAGE_SIZE,
  MAX_PMCM_COMMAND_INBOX_PAGE_SIZE,
  MAX_PMCM_DASHBOARD_ROWS,
  MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
  MAX_CLIENT_WORKSPACE_ROWS,
  MAX_CLIENT_ARCHIVED_EVENTS,
  MAX_CLIENT_ACTION_CENTER_ROWS,
  MAX_SUPPLIER_WORKSPACE_ROWS,
  MAX_VISIBLE_EVENTS,
  DECISION_LOG_SOURCE_PAGE_SIZE,
  DECISION_LOG_AUDIT_PAGE_SIZE,
} from './event-read-models.queries';

function model<T = never>() {
  return {
    findMany: vi.fn(async (): Promise<T[]> => []),
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    count: vi.fn(async () => 0),
    groupBy: vi.fn(async () => []),
  };
}

function decisionLogSourceRows(pageSize: number) {
  const rows = Array.from({ length: pageSize + 1 }, (_, index) => ({ id: `row_${String(index).padStart(4, '0')}` }));
  const findMany = vi.fn(async ({ where, take }: { where: Record<string, unknown>; take: number }) => {
    const idFilter = where.id;
    const afterId = idFilter && typeof idFilter === 'object' && 'gt' in idFilter
      ? (idFilter as { gt?: unknown }).gt
      : undefined;
    return rows.filter((row) => typeof afterId !== 'string' || row.id > afterId).slice(0, take);
  });
  return { rows, findMany };
}

describe('EventReadModelQueries collection limits', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-19T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('limits client notification reads to Client recipients and already scoped event ids', async () => {
    const notifications = model();
    const queries = new EventReadModelQueries({ opsNotificationLog: notifications } as unknown as PrismaService);
    await queries.clientNotificationsForEvents(['evt_1', 'evt_2']);
    expect(notifications.findMany).toHaveBeenCalledWith({
      where: { eventId: { in: ['evt_1', 'evt_2'] }, recipient: 'Client' },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: expect.any(Number),
    });
  });

  it('keyset-pages every event-scoped supplier readiness request', async () => {
    const rows = Array.from({ length: MAX_SUPPLIER_WORKSPACE_ROWS * 2 + 1 }, (_, index) => ({ id: `qr_${String(index).padStart(4, '0')}` }));
    const requests = { findMany: vi.fn(async ({ where, take }: { where: { id?: { gt?: string } }; take: number }) => {
      const afterId = where.id?.gt;
      return rows.filter((row) => !afterId || row.id > afterId).slice(0, take);
    }) };
    const queries = new EventReadModelQueries({ opsSupplierQuoteRequest: requests } as unknown as PrismaService);

    const result = await queries.supplierReadinessRequestsForEvent('evt_1');

    expect(result).toEqual(rows);
    expect(requests.findMany).toHaveBeenCalledTimes(3);
    expect(requests.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { eventId: 'evt_1' }, orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS }));
    expect(requests.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: { eventId: 'evt_1', id: { gt: rows[MAX_SUPPLIER_WORKSPACE_ROWS - 1]?.id } }, orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS }));
    expect(requests.findMany).toHaveBeenNthCalledWith(3, expect.objectContaining({ where: { eventId: 'evt_1', id: { gt: rows[MAX_SUPPLIER_WORKSPACE_ROWS * 2 - 1]?.id } }, orderBy: { id: 'asc' }, take: MAX_SUPPLIER_WORKSPACE_ROWS }));
  });

  it('keyset-pages every decision source and the attribution history without excluding pending requests', async () => {
    const event = {
      id: 'evt_1', inquiryId: 'inq_1', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked',
      archivedAt: null, archiveOverrideReason: null, archiveOverrideBy: null, updatedAt: new Date('2026-10-19T10:00:00.000Z'),
    };
    const eventDecisions = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const freezeExceptions = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const addenda = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const complianceOverrides = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const riskChanges = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const ocularWaivers = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const billingCorrections = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const billingWaivers = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const paymentTermsOverrides = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const reassignments = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const inquiryMerges = decisionLogSourceRows(DECISION_LOG_SOURCE_PAGE_SIZE);
    const auditAttributions = decisionLogSourceRows(DECISION_LOG_AUDIT_PAGE_SIZE);
    const queries = new EventReadModelQueries({
      opsEvent: { findUnique: vi.fn(async () => event) },
      opsEventDecision: eventDecisions,
      opsEventFreezeException: freezeExceptions,
      opsAddendum: addenda,
      opsComplianceCheck: complianceOverrides,
      opsComplianceRiskHistory: riskChanges,
      opsOcularVisitRequest: ocularWaivers,
      opsBillingCorrection: billingCorrections,
      opsAdditionalBilling: billingWaivers,
      opsBillingSource: paymentTermsOverrides,
      opsEventTaskReassignmentRequest: reassignments,
      opsInquiryMerge: inquiryMerges,
      opsAuditLog: auditAttributions,
    } as unknown as PrismaService);

    const sources = await queries.decisionLogSourcesForEvent('evt_1');

    expect(sources).not.toBeNull();
    expect(sources?.eventDecisions).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.freezeExceptions).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.addenda).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.complianceOverrides).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.riskChanges).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.ocularWaivers).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.billingCorrections).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.billingWaivers).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.paymentTermsOverrides).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.reassignments).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.inquiryMerges).toHaveLength(DECISION_LOG_SOURCE_PAGE_SIZE + 1);
    expect(sources?.auditAttributions).toHaveLength(DECISION_LOG_AUDIT_PAGE_SIZE + 1);

    for (const source of [eventDecisions, freezeExceptions, addenda, complianceOverrides, riskChanges, ocularWaivers, billingCorrections, billingWaivers, paymentTermsOverrides, reassignments, inquiryMerges]) {
      expect(source.findMany).toHaveBeenCalledTimes(2);
      expect(source.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
        where: expect.objectContaining({ id: { gt: source.rows[DECISION_LOG_SOURCE_PAGE_SIZE - 1]?.id } }),
        orderBy: { id: 'asc' },
        take: DECISION_LOG_SOURCE_PAGE_SIZE,
      }));
    }
    expect(freezeExceptions.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { eventId: 'evt_1' } }));
    expect(billingCorrections.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { eventId: 'evt_1' } }));
    expect(reassignments.findMany).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { eventId: 'evt_1' } }));
    expect(auditAttributions.findMany).toHaveBeenCalledTimes(2);
    expect(auditAttributions.findMany).toHaveBeenNthCalledWith(2, expect.objectContaining({
      where: expect.objectContaining({ id: { gt: auditAttributions.rows[DECISION_LOG_AUDIT_PAGE_SIZE - 1]?.id } }),
      select: expect.objectContaining({ id: true }),
      orderBy: { id: 'asc' },
      take: DECISION_LOG_AUDIT_PAGE_SIZE,
    }));
  });

  it('loads recent coordinator reliability history by coordinator with event and role context', async () => {
    const note = { id: 'note_1', eventId: 'evt_1', assignment: { role: 'lead' } };
    const reliabilityNotes = model<typeof note>();
    reliabilityNotes.findMany = vi.fn(async () => [note]);
    const event = { id: 'evt_1', eventName: 'Forum', eventDate: new Date('2026-06-18') };
    const opsEvent = { findMany: vi.fn(async () => [event]) };
    const queries = new EventReadModelQueries({ opsCoordinatorReliabilityNote: reliabilityNotes, opsEvent } as unknown as PrismaService);

    const result = await queries.coordinatorReliabilityHistory('coord_1');

    expect(reliabilityNotes.findMany).toHaveBeenCalledWith({
      where: { coordinatorId: 'coord_1' },
      include: {
        assignment: { select: { role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
    });
    expect(opsEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_1'] } },
      select: { id: true, eventName: true, eventDate: true },
    });
    expect(result[0]).toMatchObject({ event });
    expect(MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS).toBe(50);
  });

  it('composes the client timeline from the event plus one owner-read approved official plan and balance milestone per event', async () => {
    const approvedAt = new Date('2026-06-01');
    const dueDate = new Date('2026-06-10');
    const opsEvent = model<{ id: string }>();
    opsEvent.findMany = vi.fn(async () => [{ id: 'evt_a' }, { id: 'evt_b' }]);
    const opsFloorPlanDraft = model<{ eventId: string; isActive: boolean; approvedAt: Date }>();
    opsFloorPlanDraft.findMany = vi.fn(async () => [{ eventId: 'evt_a', isActive: true, approvedAt }]);
    const opsPaymentMilestone = model<{ eventId: string; dueDate: Date; status: string; remainingBalance: number }>();
    opsPaymentMilestone.findMany = vi.fn(async () => [{ eventId: 'evt_b', dueDate, status: 'paid', remainingBalance: 0 }]);
    const queries = new EventReadModelQueries({ opsEvent, opsFloorPlanDraft, opsPaymentMilestone } as unknown as PrismaService);

    const timeline = await queries.clientEventTimelineForEvents(['evt_a', 'evt_b', 'evt_hidden']);

    expect(opsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['evt_a', 'evt_b', 'evt_hidden'] } },
      take: MAX_VISIBLE_EVENTS,
    }));
    expect(opsFloorPlanDraft.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: { in: ['evt_a', 'evt_b'] }, status: 'approved', sourceType: { not: 'client_preference' } },
      distinct: ['eventId'],
    }));
    expect(opsPaymentMilestone.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { eventId: { in: ['evt_a', 'evt_b'] }, label: { contains: 'balance', mode: 'insensitive' }, OR: [{ statementId: null }, { statement: { is: { sentAt: { not: null } } } }] },
      distinct: ['eventId'],
    }));
    expect(timeline).toEqual([
      { id: 'evt_a', floorPlanDrafts: [{ isActive: true, approvedAt }], paymentMilestones: [] },
      { id: 'evt_b', floorPlanDrafts: [], paymentMilestones: [{ dueDate, status: 'paid', remainingBalance: 0 }] },
    ]);
  });

  it('bounds visible events and nested drafts with deterministic tie-breakers', async () => {
    const opsEvent = model();
    const queries = new EventReadModelQueries({ opsEvent } as unknown as PrismaService);

    const actor = { role: 'pmcm-admin' as const, name: 'PMCM', explicit: true };
    const page = await queries.visibleEvents(actor);

    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      totalCount: 0,
    });

    expect(opsEvent.findMany).toHaveBeenCalledWith({
      where: { archived: false },
      include: {
        inquiry: { select: { email: true } },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: EVENT_READ_PAGE_SIZE + 1,
    });
    expect(opsEvent.count).toHaveBeenCalledWith({ where: { archived: false } });
  });

  it('finds a client event after unrelated unarchived traffic by scoping before page limits', async () => {
    const clientEvent = {
      id: 'evt_client_after_global_volume',
      eventDate: new Date('2026-11-01T00:00:00.000Z'),
      archived: false,
      clientPortalStatus: 'unlocked',
      inquiry: { email: 'ana@example.test' },
    };
    const unrelatedEvents = Array.from({ length: 501 }, (_, index) => ({
      ...clientEvent,
      id: `evt_unrelated_${index}`,
      inquiry: { email: `other-${index}@example.test` },
    }));
    const allEvents = [...unrelatedEvents, clientEvent];
    const opsEvent = {
      findMany: vi.fn(async () =>
        allEvents.filter(
          (event) =>
            !event.archived &&
            event.clientPortalStatus === 'unlocked' &&
            event.inquiry.email.toLowerCase() === 'ana@example.test',
        ),
      ),
      count: vi.fn(async () => 1),
    };
    const queries = new EventReadModelQueries({
      opsEvent,
      $queryRaw: vi.fn(async () => []),
    } as unknown as PrismaService);
    const actor = {
      role: 'client' as const,
      email: 'ana@example.test',
      name: 'Ana',
      explicit: true,
      verified: true,
    };

    const page = await queries.visibleEvents(actor);
    const scope = {
      archived: false,
      clientPortalStatus: 'unlocked',
      inquiry: {
        is: { email: { equals: 'ana@example.test', mode: 'insensitive' } },
      },
    };

    expect(page.items.map((event) => event.id)).toEqual(['evt_client_after_global_volume']);
    expect(page.pagination).toEqual({
      nextCursor: null,
      hasMore: false,
      totalCount: 1,
    });
    expect(opsEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: scope, take: EVENT_READ_PAGE_SIZE + 1 }),
    );
    expect(opsEvent.count).toHaveBeenCalledWith({ where: scope });

    // Archived history uses the same ownership scope, restricted to archived events.
    await queries.archivedClientEvents(actor);
    expect(opsEvent.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { ...scope, archived: true }, take: MAX_CLIENT_ARCHIVED_EVENTS }),
    );
  });

  it('uses a stable eventDate and ID keyset for subsequent event pages', async () => {
    const eventDate = new Date('2026-11-01T00:00:00.000Z');
    const rows = Array.from({ length: EVENT_READ_PAGE_SIZE + 1 }, (_, index) => ({
      id: `evt_${String(index).padStart(3, '0')}`,
      eventDate,
    }));
    const opsEvent = {
      findMany: vi.fn(async () => rows),
      count: vi.fn(async () => rows.length),
    };
    const queries = new EventReadModelQueries({
      opsEvent,
      $queryRaw: vi.fn(async () => []),
    } as unknown as PrismaService);
    const actor = { role: 'pmcm-admin' as const, name: 'PMCM', explicit: true };

    const first = await queries.visibleEvents(actor);
    await queries.visibleEvents(actor, first.pagination.nextCursor ?? undefined);

    expect(first.items).toHaveLength(EVENT_READ_PAGE_SIZE);
    expect(first.pagination.hasMore).toBe(true);
    expect(opsEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          AND: [
            { archived: false },
            {
              OR: [{ eventDate: { gt: eventDate } }, { eventDate, id: { gt: 'evt_099' } }],
            },
          ],
        },
        orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('filters supplier and coordinator event eligibility in the database', async () => {
    const opsEvent = model();
    const opsSupplierQuoteRequest = { findMany: vi.fn(async () => [{ eventId: 'evt_supplier' }]) };
    const opsCoordinator = { findFirst: vi.fn(async () => ({ id: 'coord_1' })) };
    const opsCoordinatorAssignment = { findMany: vi.fn(async () => [{ eventId: 'evt_coordinator' }]) };
    const queries = new EventReadModelQueries({
      opsEvent,
      opsSupplierQuoteRequest,
      opsCoordinator,
      opsCoordinatorAssignment,
      $queryRaw: vi.fn(async () => []),
    } as unknown as PrismaService);

    await queries.visibleEvents({
      role: 'supplier',
      name: 'Supplier',
      email: 'vendor@example.test',
      supplierId: 'sup_1',
      explicit: true,
    });
    await queries.visibleEvents({
      role: 'coordinator',
      name: 'Coordinator',
      email: 'coord@example.test',
      id: 'user_1',
      coordinatorId: 'coord_1',
      explicit: true,
    });

    expect(opsEvent.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: {
          archived: false,
          id: { in: ['evt_supplier'] },
        },
      }),
    );
    expect(opsEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          archived: false,
          id: { in: ['evt_coordinator'] },
        },
      }),
    );
    expect(opsSupplierQuoteRequest.findMany).toHaveBeenCalledWith({ where: { supplierId: 'sup_1' }, select: { eventId: true } });
    expect(opsCoordinatorAssignment.findMany).toHaveBeenCalledWith({
      where: {
        coordinatorId: 'coord_1',
        status: { notIn: ['cancelled', 'replaced', 'declined'] },
      },
      select: { eventId: true },
    });
  });

  it('prefers supplier ID over an email that may identify another profile', async () => {
    const findFirst = vi.fn(async () => null);
    const queries = new EventReadModelQueries({
      opsSupplier: { findFirst },
    } as unknown as PrismaService);

    await queries.supplierForActor('sup_primary', 'other@example.test');
    await queries.supplierForActor(undefined, 'fallback@example.test');

    expect(findFirst).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'sup_primary' } }));
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { email: { equals: 'fallback@example.test', mode: 'insensitive' } },
      }),
    );
  });

  it('iterates client workspace source rows in bounded keyset pages', async () => {
    const documents = Array.from({ length: MAX_CLIENT_WORKSPACE_ROWS + 1 }, (_, index) => ({
      id: `doc_${String(index).padStart(3, '0')}`,
      eventId: 'evt_client',
      uploadedAt: new Date(`2026-10-${String((index % 28) + 1).padStart(2, '0')}T00:00:00.000Z`),
    }));
    const opsDocument = {
      findMany: vi.fn(async (args: { where: { id?: { gt?: string } }; take: number }) =>
        documents.filter((document) => !args.where.id?.gt || document.id > args.where.id.gt).slice(0, args.take),
      ),
    };
    const prisma = new Proxy(
      { opsDocument },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const [result] = await queries.clientWorkspaceForEvents(['evt_client']);

    expect(result).toHaveLength(MAX_CLIENT_WORKSPACE_ROWS + 1);
    expect(opsDocument.findMany).toHaveBeenCalledTimes(2);
    expect(opsDocument.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { eventId: { in: ['evt_client'] }, id: { gt: 'doc_499' } },
        orderBy: { id: 'asc' },
      }),
    );
  });
  it('shows the client a billing statement, its milestones and its stored file only after PMCM sent it', async () => {
    const whereOf = (call: unknown[]) => (call[0] as { where: Record<string, unknown> }).where;
    const opsBillingStatement = model();
    const opsPaymentMilestone = model();
    const prisma = new Proxy(
      { opsBillingStatement, opsPaymentMilestone },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    await queries.clientWorkspaceForEvents(['evt_client']);
    await queries.clientActionCenterForEvents(['evt_client']);
    await queries.billingForEvents(['evt_client'], false, true);
    await queries.billingForEvents(['evt_client'], true, false);

    const statementFilters = opsBillingStatement.findMany.mock.calls.map(whereOf);
    const milestoneFilters = opsPaymentMilestone.findMany.mock.calls.map(whereOf);
    // Client workspace, action center and client billing hide unsent statements; PMCM billing is unfiltered.
    expect(statementFilters.filter((where) => JSON.stringify(where).includes('"sentAt":{"not":null}'))).toHaveLength(3);
    expect(statementFilters).toHaveLength(4);
    expect(milestoneFilters.filter((where) => JSON.stringify(where).includes('"sentAt":{"not":null}'))).toHaveLength(3);
    expect(milestoneFilters).toHaveLength(4);
  });
  it('reads only client-pending addenda for event action cards', async () => {
    const opsAddendum = model();
    const prisma = new Proxy(
      { opsAddendum },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    await queries.clientActionCenterForEvents(['evt_client']);

    expect(opsAddendum.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        eventId: { in: ['evt_client'] },
        conformeExecution: { is: { status: 'awaiting_client' } },
      },
      select: {
        id: true,
        eventId: true,
        versionNumber: true,
        title: true,
        issuedAt: true,
        conformeExecution: { select: { status: true } },
      },
      orderBy: { id: 'asc' },
      take: MAX_CLIENT_ACTION_CENTER_ROWS,
    }));
  });

  it('bounds the PMCM reference and reads no floor-plan drafts or row lists it does not return', async () => {
    const opsEvent = model();
    const opsFloorPlanDraft = model();
    const opsPaymentMilestone = model();
    const prisma = new Proxy(
      { opsEvent, opsFloorPlanDraft, opsPaymentMilestone },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    await queries.pmcmReference();

    expect(opsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_VISIBLE_EVENTS,
    }));
    expect(opsFloorPlanDraft.findMany).not.toHaveBeenCalled();
    // Balances are one grouped sum over current milestones, not a list of milestone rows.
    expect(opsPaymentMilestone.findMany).not.toHaveBeenCalled();
    expect(opsPaymentMilestone.groupBy).toHaveBeenCalledWith({ by: ['eventId'], where: { supersededAt: null }, _sum: { remainingBalance: true } });
    expect(MAX_PMCM_DASHBOARD_ROWS).toBe(500);
  });

  it('pages only actionable command-inbox rows with stable ordering', async () => {
    const opsInquiry = model();
    const opsEvent = model();
    const opsPaymentMilestone = model();
    const opsSupplierQuoteRequest = model();
    const opsCoordinatorAssignment = model();
    const opsFloorPlanDraft = model();
    const opsPostEventDocument = model();
    const opsEventDayTask = model();
    const opsUrgentIssue = model();
    const prisma = {
      opsInquiry,
      opsEvent,
      opsPaymentMilestone,
      opsSupplierQuoteRequest,
      opsCoordinatorAssignment,
      opsFloorPlanDraft,
      opsPostEventDocument,
      opsEventDayTask,
      opsUrgentIssue,
    };
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);
    const now = new Date('2026-10-19T10:00:00.000Z');

    const result = await queries.pmcmCommandInbox(2, MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, now);

    const page = { skip: 2 * MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, take: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE + 1 };
    expect(opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ ...page, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }));
    expect(opsPaymentMilestone.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { not: 'paid' } }, ...page }));
    expect(opsEventDayTask.findMany).toHaveBeenCalledWith(expect.objectContaining({
      ...page,
      where: expect.objectContaining({
        status: { notIn: ['done', 'cancelled'] },
        OR: expect.arrayContaining([{ status: 'blocked' }, { slaDueAt: { lt: now } }, { slaDueAt: null, dueAt: { lt: now } }]),
      }),
      orderBy: [{ slaDueAt: 'asc' }, { id: 'asc' }],
    }));
    expect(opsUrgentIssue.findMany).toHaveBeenCalledWith(expect.objectContaining({
      ...page,
      where: { status: { in: ['open', 'assigned'] }, resolvedAt: null },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    }));
    expect(result.hasMore).toBe(false);
    expect(result.inquiries).toEqual([]);
  });

  it('reports another page when an actionable source exceeds the page size', async () => {
    const inquiries = Array.from({ length: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE + 1 }, (_, index) => ({
      id: `inq_${index}`,
      status: 'new',
      clientName: `Client ${index}`,
      eventName: `Event ${index}`,
      createdAt: new Date(`2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`),
      acceptedAt: null,
      conformeSignedAt: null,
      portalInvitationExpiresAt: null,
    }));
    const prisma = new Proxy({}, {
      get(_target, property: string) {
        if (property === 'opsInquiry') return { findMany: vi.fn(async () => inquiries) };
        return model();
      },
    });
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const page = await queries.pmcmCommandInbox(0);

    expect(page.inquiries).toHaveLength(MAX_PMCM_COMMAND_INBOX_PAGE_SIZE);
    expect(page.hasMore).toBe(true);
  });

  it('does not advertise a page beyond the accepted inbox range', async () => {
    const prisma = new Proxy({}, {
      get(_target, property: string) {
        if (property === 'opsInquiry') {
          return { findMany: vi.fn(async () => Array.from({ length: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE + 1 }, (_, index) => ({ id: `inq_${index}` }))) };
        }
        return model();
      },
    });
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const page = await queries.pmcmCommandInbox(100);

    expect(page.hasMore).toBe(false);
  });

  it('reads the event and exact aggregate counts, without row lists', async () => {
    const opsEvent = model();
    const prisma = new Proxy(
      { opsEvent },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const result = await queries.defenseReadiness('evt_high_volume');

    expect(result).toHaveLength(2);
    expect(result[1]).toEqual({
      briefings: 0,
      floorPlanDrafts: 0,
      approvedFloorplan: 0,
      quoteRequests: 0,
      selectedSupplierRequests: 0,
      eventDayTasks: 0,
      urgentIssues: 0,
      billingStatements: 0,
      paymentMilestones: 0,
      unpaidPaymentMilestones: 0,
    });
    expect((prisma as typeof prisma).opsEvent).toBe(opsEvent);
  });

  it('counts selected suppliers as selected quote requests, the same rows the PMCM Bookings tab shows', async () => {
    const requests = {
      ...model(),
      count: vi.fn(async (args?: { where?: { status?: string } }) => (args?.where?.status === 'selected' ? 2 : 5)),
    };
    const prisma = new Proxy(
      { opsEvent: model(), opsSupplierQuoteRequest: requests },
      {
        get(target, property: string) {
          if (property in target) return target[property as keyof typeof target];
          return model();
        },
      },
    );
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const result = await queries.defenseReadiness('evt_suppliers');

    expect(result[1].quoteRequests).toBe(5);
    expect(result[1].selectedSupplierRequests).toBe(2);
  });
});

describe('EventReadModelQueries client document rows', () => {
  it('shows a client only the document rows the file policy allows, with narrowing and billing sent state applied', async () => {
    const client = { name: 'Client', role: 'client', email: 'client@example.test', explicit: true, verified: true } as never;
    const row = (fields: Record<string, unknown>) => ({ eventId: 'evt_1', status: 'submitted', fileName: 'f.pdf', uploadedAt: new Date('2026-10-01T00:00:00Z'), ...fields });
    const documents = [
      row({ id: 'doc_bound', type: 'insurance_certificate', storageKey: 'obj_client_doc' }),
      row({ id: 'doc_hidden_by_pmcm', type: 'insurance_pmcm', storageKey: 'obj_pmcm_only' }),
      row({ id: 'doc_contract', type: 'supplier_contract', storageKey: 'obj_supplier' }),
      row({ id: 'doc_unsent_bill', type: 'billing_statement', storageKey: null }),
      row({ id: 'doc_sent_bill', type: 'billing_statement', storageKey: null }),
      row({ id: 'doc_proposal', type: 'proposal', storageKey: null }),
    ];
    const queries = new EventReadModelQueries({
      opsStoredObject: { findMany: vi.fn(async () => [
        { id: 'obj_client_doc', usage: 'client_document', ownerRecordType: 'event', ownerRecordId: 'evt_1', lifecycleState: 'stored', deletedAt: null },
        { id: 'obj_pmcm_only', usage: 'client_document', ownerRecordType: 'event', ownerRecordId: 'evt_1', lifecycleState: 'stored', deletedAt: null },
        { id: 'obj_supplier', usage: 'supplier_document', ownerRecordType: 'supplier', ownerRecordId: 'sup_1', lifecycleState: 'stored', deletedAt: null },
      ]) },
      opsFileRequirement: { findMany: vi.fn(async () => [
        { eventId: 'evt_1', key: 'insurance_certificate', visibleToRoles: ['pmcm-admin', 'client'] },
        { eventId: 'evt_1', key: 'insurance_pmcm', visibleToRoles: ['pmcm-admin'] },
      ]) },
      opsBillingStatement: { findMany: vi.fn(async () => [{ id: 'bill_sent', documentId: 'doc_sent_bill' }]) },
    } as unknown as PrismaService);

    const visible = await queries.clientReadableDocuments(client, documents as never);

    expect(visible.map((document) => document.id)).toEqual(['doc_bound', 'doc_sent_bill', 'doc_proposal']);
  });
});
