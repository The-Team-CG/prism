import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import {
  EventReadModelQueries,
  EVENT_READ_PAGE_SIZE,
  MAX_PMCM_COMMAND_INBOX_PAGE_SIZE,
  MAX_EVENT_FLOORPLAN_DRAFTS,
  MAX_PMCM_DASHBOARD_ROWS,
  MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
  MAX_CLIENT_WORKSPACE_ROWS,
  MAX_VISIBLE_EVENTS,
} from './event-read-models.queries';

function model() {
  return {
    findMany: vi.fn(async () => []),
    findUnique: vi.fn(async () => null),
    findFirst: vi.fn(async () => null),
    count: vi.fn(async () => 0),
  };
}

describe('EventReadModelQueries collection limits', () => {
  it('loads recent coordinator reliability history by coordinator with event and role context', async () => {
    const reliabilityNotes = model();
    const queries = new EventReadModelQueries({ opsCoordinatorReliabilityNote: reliabilityNotes } as unknown as PrismaService);

    await queries.coordinatorReliabilityHistory('coord_1');

    expect(reliabilityNotes.findMany).toHaveBeenCalledWith({
      where: { coordinatorId: 'coord_1' },
      include: {
        event: { select: { eventName: true, eventDate: true } },
        assignment: { select: { role: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
    });
    expect(MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS).toBe(50);
  });

  it('scopes the client timeline query and selects only an approved official floor plan', async () => {
    const opsEvent = model();
    const queries = new EventReadModelQueries({ opsEvent } as unknown as PrismaService);

    await queries.clientEventTimelineForEvents(['evt_visible']);

    expect(opsEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_visible'] } },
      select: {
        id: true,
        eventDate: true,
        status: true,
        archived: true,
        proposalClientStatus: true,
        proposalReviewedAt: true,
        inquiry: { select: { conformeSignedAt: true } },
        floorPlanDrafts: {
          where: { status: 'approved', sourceType: { not: 'client_preference' } },
          select: { isActive: true, approvedAt: true },
          orderBy: [
            { isActive: 'desc' },
            { approvedAt: { sort: 'desc', nulls: 'last' } },
            { id: 'asc' },
          ],
          take: 1,
        },
        paymentMilestones: {
          where: { label: { contains: 'balance', mode: 'insensitive' } },
          select: { dueDate: true, status: true, remainingBalance: true },
          orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
          take: 1,
        },
      },
      orderBy: [{ id: 'asc' }],
      take: MAX_VISIBLE_EVENTS,
    });
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
        floorPlanDrafts: {
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_EVENT_FLOORPLAN_DRAFTS,
        },
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
    const queries = new EventReadModelQueries({
      opsEvent,
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
          supplierQuoteRequests: { some: { supplierId: 'sup_1' } },
        },
      }),
    );
    expect(opsEvent.findMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          archived: false,
          coordinatorAssignments: {
            some: {
              status: { notIn: ['cancelled', 'replaced', 'declined'] },
              coordinator: { is: { active: true, id: 'coord_1' } },
            },
          },
        },
      }),
    );
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
  it('bounds PMCM dashboard collections and nested floorplan history', async () => {
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

    await queries.pmcmDashboard();

    expect(opsEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({
      include: {
        floorPlanDrafts: {
          orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
          take: MAX_EVENT_FLOORPLAN_DRAFTS,
        },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_VISIBLE_EVENTS,
    }));
    expect((prisma as typeof prisma).opsEvent).toBe(opsEvent);
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
    const prisma = {
      opsInquiry,
      opsEvent,
      opsPaymentMilestone,
      opsSupplierQuoteRequest,
      opsCoordinatorAssignment,
      opsFloorPlanDraft,
      opsPostEventDocument,
    };
    const queries = new EventReadModelQueries(prisma as unknown as PrismaService);

    const result = await queries.pmcmCommandInbox(2);

    expect(opsInquiry.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 2 * MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, take: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE + 1, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] }));
    expect(opsPaymentMilestone.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { status: { not: 'paid' } }, skip: 2 * MAX_PMCM_COMMAND_INBOX_PAGE_SIZE, take: MAX_PMCM_COMMAND_INBOX_PAGE_SIZE + 1 }));
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

  it('returns exact aggregate counts alongside capped defense rows', async () => {
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

    expect(result[8]).toEqual({
      briefings: 0,
      floorPlanDrafts: 0,
      approvedFloorplan: 0,
      quoteRequests: 0,
      selectedSupplierQuotes: 0,
      eventDayTasks: 0,
      urgentIssues: 0,
      billingStatements: 0,
      paymentMilestones: 0,
      unpaidPaymentMilestones: 0,
    });
    expect((prisma as typeof prisma).opsEvent).toBe(opsEvent);
  });
});
