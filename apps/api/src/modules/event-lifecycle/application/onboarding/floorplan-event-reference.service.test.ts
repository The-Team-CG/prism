import { describe, expect, it, vi } from 'vitest';
import { FloorplanEventReferenceService } from './floorplan-event-reference.service';

describe('FloorplanEventReferenceService', () => {
  it('locks Lifecycle event then ocular state before reading the owner projection through the supplied transaction', async () => {
    const order: string[] = [];
    const event = {
      id: 'evt_floorplan',
      eventName: 'Ayala Summit',
      clientName: 'Ana Reyes',
      clientPortalStatus: 'unlocked',
      archived: false,
      freezeStatus: 'open',
      floorPlanStatus: 'in_review',
      readiness: 'Floorplan awaiting review',
      inquiry: { email: 'ana@example.test', conformeSignedAt: new Date('2026-01-01T00:00:00.000Z') },
      ocularVisitRequest: { status: 'completed' },
    };
    const transaction = {
      $queryRawUnsafe: vi.fn(async (sql: string) => {
        order.push(sql.includes('ocular_visit_requests') ? 'ocular-lock' : 'event-lock');
        return [{ id: 'locked' }];
      }),
      opsEvent: { findUnique: vi.fn(async () => { order.push('event-read'); return event; }) },
    };
    const service = new FloorplanEventReferenceService({} as never);

    await expect(service.findFloorplanEvent('evt_floorplan', {
      prisma: transaction as never,
      correlationId: 'floorplan-test',
    })).resolves.toEqual({
      eventId: 'evt_floorplan',
      eventName: 'Ayala Summit',
      clientName: 'Ana Reyes',
      clientPortalStatus: 'unlocked',
      archived: false,
      freezeStatus: 'open',
      floorPlanStatus: 'in_review',
      readiness: 'Floorplan awaiting review',
      primaryClientEmail: 'ana@example.test',
      conformeSigned: true,
      ocularVisitStatus: 'completed',
    });

    expect(order).toEqual(['event-lock', 'ocular-lock', 'event-read']);
    expect(transaction.opsEvent.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_floorplan' },
      select: expect.objectContaining({ inquiry: { select: { email: true, conformeSignedAt: true } } }),
    }));
  });

  it('returns missing without querying dependent ocular state or a stale relation', async () => {
    const transaction = {
      $queryRawUnsafe: vi.fn(async () => []),
      opsEvent: { findUnique: vi.fn() },
    };
    const service = new FloorplanEventReferenceService({} as never);

    await expect(service.findFloorplanEvent('evt_missing', {
      prisma: transaction as never,
      correlationId: 'floorplan-test',
    })).resolves.toBeNull();

    expect(transaction.$queryRawUnsafe).toHaveBeenCalledTimes(1);
    expect(transaction.opsEvent.findUnique).not.toHaveBeenCalled();
  });
});
