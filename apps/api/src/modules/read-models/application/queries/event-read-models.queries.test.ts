import { describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import {
  EventReadModelQueries,
  MAX_EVENT_FLOORPLAN_DRAFTS,
  MAX_PMCM_DASHBOARD_ROWS,
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
