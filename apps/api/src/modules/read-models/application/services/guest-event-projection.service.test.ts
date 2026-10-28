import { describe, expect, it, vi } from 'vitest';
import { GuestEventProjectionService } from './guest-event-projection.service';

describe('GuestEventProjectionService', () => {
  it('selects only access-code candidate fields and scopes ordinary lookup to active events', async () => {
    const findMany = vi.fn(async () => []);
    const service = new GuestEventProjectionService({ opsEvent: { findMany } } as never);

    await service.listGuestAccessCandidates(false);

    expect(findMany).toHaveBeenCalledWith({
      where: { archived: false },
      select: { id: true, eventName: true, eventDate: true, actualEndedAt: true, updatedAt: true, archived: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
    });
  });

  it('keeps the guest pass event projection within lifecycle-owned fields', async () => {
    const findUnique = vi.fn(async () => null);
    const service = new GuestEventProjectionService({ opsEvent: { findUnique } } as never);

    await service.findGuestEvent('evt_1');

    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'evt_1' },
      select: {
        id: true,
        eventName: true,
        eventDate: true,
        status: true,
        archived: true,
        actualEndedAt: true,
        walkInPolicy: true,
        walkInThreshold: true,
        clientName: true,
        readiness: true,
        floorPlanStatus: true,
        floorPlanId: true,
        updatedAt: true,
        proposalClientStatus: true,
        proposalReviewedAt: true,
        // Guests may see where and when to arrive, from the latest briefing only; no budget or notes.
        briefings: {
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { venue: true, confirmedStartTime: true, submittedAt: true },
        },
      },
    });
  });

  it('exposes arrival facts only for the briefing behind an approved proposal', async () => {
    const reviewedAt = new Date('2026-09-01T00:00:00.000Z');
    const briefing = { venue: 'Grand Ballroom', confirmedStartTime: '18:30', submittedAt: new Date('2026-08-20T00:00:00.000Z') };
    const project = async (event: Record<string, unknown>) => {
      const findUnique = vi.fn(async () => ({ id: 'evt_1', proposalClientStatus: 'approved', proposalReviewedAt: reviewedAt, briefings: [briefing], ...event }));
      return new GuestEventProjectionService({ opsEvent: { findUnique }, $queryRaw: vi.fn(async () => []) } as never).findGuestEvent('evt_1');
    };

    const approved = await project({});
    expect(approved?.confirmedArrival).toEqual({ venue: 'Grand Ballroom', confirmedStartTime: '18:30' });
    expect(approved).not.toHaveProperty('briefings');
    expect(approved).not.toHaveProperty('proposalClientStatus');
    expect(await project({ proposalClientStatus: 'pending', proposalReviewedAt: null })).not.toHaveProperty('confirmedArrival');
    expect(await project({ briefings: [{ ...briefing, submittedAt: new Date('2026-09-05T00:00:00.000Z') }] })).not.toHaveProperty('confirmedArrival');
  });

  it('bounds coordinator workspace event and floorplan projection queries', async () => {
    const findMany = vi.fn(async () => []);
    const service = new GuestEventProjectionService({ opsEvent: { findMany } } as never);

    await expect(service.listCoordinatorWorkspaceEvents(['evt_1', 'evt_2'])).resolves.toEqual([]);
    expect(findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_1', 'evt_2'] } },
      select: {
        id: true,
        inquiryId: true,
        clientName: true,
        eventName: true,
        eventDate: true,
        status: true,
        clientPortalStatus: true,
        readiness: true,
        archived: true,
        floorPlanStatus: true,
        floorPlanId: true,
        briefings: {
          orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
          take: 1,
          select: { venue: true },
        },
      },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: 2,
    });

    findMany.mockClear();
    await expect(service.listCoordinatorWorkspaceEvents([])).resolves.toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });
});
