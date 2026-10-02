import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import {
  EventReadModelQueries,
  MAX_PMCM_COMMAND_INBOX_PAGE_SIZE,
  MAX_EVENT_FLOORPLAN_DRAFTS,
  MAX_PMCM_DASHBOARD_ROWS,
  MAX_COORDINATOR_RELIABILITY_HISTORY_ROWS,
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

    await queries.visibleEvents();

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
      take: MAX_VISIBLE_EVENTS,
    });
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
