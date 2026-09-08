import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { EventScheduleService } from './event-schedule.service';

function service(access: { requireActorRole: ReturnType<typeof vi.fn> }, staffing = {}) {
  return new EventScheduleService({} as never, access as never, {} as never, staffing as never, {} as never);
}

describe('EventScheduleService authority', () => {
  it('keeps operator designation PMCM-only', async () => {
    const access = { requireActorRole: vi.fn().mockRejectedValue(new ForbiddenException('denied')) };
    await expect(service(access).designateOperator('evt_1', { coordinatorId: 'coord_1' }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('denied');
    expect(access.requireActorRole).toHaveBeenCalledWith(expect.anything(), ['pmcm-admin'], 'event day system operator designation', 'evt_1');
  });

  it('does not permit a coordinator to bypass event-day authority checks', async () => {
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const instance = service(access, { findAssignmentForEventActor: vi.fn().mockResolvedValue(null) });
    await expect(instance.createHandoff('evt_1', { dayId: 'day_1', role: 'Lead', fromAssignmentId: 'a_1', toAssignmentId: 'a_2', outstandingItems: [] }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('Coordinator may only act');
  });

  it('revokes the current designation before creating one, preserving uniqueness per event', async () => {
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const current = {
      id: 'coord_2',
      name: 'Coordinator Two',
      active: true,
    };
    const created = {
      id: 'designation_2',
      eventId: 'evt_1',
      coordinatorId: 'coord_2',
      designatedBy: 'pmcm_1',
      designatedAt: new Date('2026-09-08T03:00:00.000Z'),
      revokedAt: null,
      revokedBy: null,
    };
    const tx = {
      opsCoordinator: { findFirst: vi.fn().mockResolvedValue(current) },
      opsEventOperatorDesignation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const auditWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const instance = new EventScheduleService(
      prisma as never,
      access as never,
      auditWriter as never,
      {} as never,
      {} as never,
      { now: () => new Date('2026-09-08T03:00:00.000Z') },
    );

    await instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never);

    expect(tx.opsEventOperatorDesignation.updateMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1', revokedAt: null },
      data: { revokedAt: new Date('2026-09-08T03:00:00.000Z'), revokedBy: 'pmcm_1' },
    });
    expect(tx.opsEventOperatorDesignation.create).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).toHaveBeenCalledTimes(1);
  });
});
