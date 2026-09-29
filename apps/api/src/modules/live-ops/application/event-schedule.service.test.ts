import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { EventScheduleService } from './event-schedule.service';

function service(access: { requireActorRole: ReturnType<typeof vi.fn> }, staffing = {}) {
  return new EventScheduleService({} as never, access as never, {} as never, staffing as never, { getEventLiveOps: vi.fn() } as never);
}

describe('EventScheduleService authority', () => {
  it('returns only the event-scoped live-ops view to an assigned coordinator run sheet', async () => {
    const eventId = 'evt_1';
    const actor = { id: 'usr_coord', role: 'coordinator', name: 'Coordinator', email: 'coord@example.test' };
    const day = {
      id: 'day_1',
      eventId,
      dayDate: '2026-10-01',
      label: 'Event day',
      status: 'planned',
      segments: [],
    };
    const ownAssignment = { id: 'assignment_own', coordinatorName: 'Coordinator' };
    const scopedLiveOps = {
      schedule: { eventId, authored: true, days: [day], serverTime: '2026-09-29T00:00:00.000Z' },
      coordinatorAssignments: [ownAssignment],
      supplierStatuses: [{ id: 'supplier_visible', supplierName: 'Visible Supplier', category: 'Catering', eventDayStatus: 'ready', readinessStatus: 'ready', eventDayNotes: '' }],
      tasks: [{ id: 'task_visible' }],
      urgentIssues: [{ id: 'issue_visible' }],
    };
    const readModel = { getEventLiveOps: vi.fn(async () => scopedLiveOps) };
    const instance = new EventScheduleService(
      {} as never,
      { requireActorRole: vi.fn(async () => undefined) } as never,
      {} as never,
      {} as never,
      readModel as never,
    );

    const result = await instance.getRunSheet(eventId, 'day_1', actor as never);

    expect(result).toMatchObject({
      coordinators: [ownAssignment],
      supplierCommitments: [{ id: 'supplier_visible', supplierName: 'Visible Supplier' }],
      openTasks: [{ id: 'task_visible' }],
      openIssues: [{ id: 'issue_visible' }],
    });
    expect(readModel.getEventLiveOps).toHaveBeenCalledWith(eventId, actor);
  });

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
      opsCoordinatorAssignment: { findFirst: vi.fn().mockResolvedValue({ id: 'assignment_2' }) },
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
      { getEventLiveOps: vi.fn() } as never,
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

describe('EventScheduleService operator designation', () => {
  const pmcm = { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never;
  const clock = { now: () => new Date('2026-09-08T03:00:00.000Z') };

  type AssignmentRow = { eventId: string; coordinatorId: string; status: string };

  function harness(assignments: AssignmentRow[]) {
    const tx = {
      opsCoordinator: { findFirst: vi.fn().mockResolvedValue({ id: 'coord_2', name: 'Coordinator Two', active: true }) },
      // Answers the way the database would: a row matches unless its status is in the excluded list.
      opsCoordinatorAssignment: {
        findFirst: vi.fn(async ({ where }: { where: { eventId: string; coordinatorId: string; status: { notIn: string[] } } }) =>
          assignments.find((row) => row.eventId === where.eventId && row.coordinatorId === where.coordinatorId && !where.status.notIn.includes(row.status)) ?? null),
      },
      opsEventOperatorDesignation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'designation_2', eventId: 'evt_1', coordinatorId: 'coord_2' }),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = new EventScheduleService(prisma as never, { requireActorRole: vi.fn() } as never, { write: vi.fn() } as never, {} as never, { getEventLiveOps: vi.fn() } as never, clock);
    return { instance, tx };
  }

  it('designates a coordinator who is working the event', async () => {
    const { instance, tx } = harness([{ eventId: 'evt_1', coordinatorId: 'coord_2', status: 'pending_acknowledgement' }]);

    await instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, pmcm);

    expect(tx.opsEventOperatorDesignation.create).toHaveBeenCalledTimes(1);
  });

  it.each(['cancelled', 'replaced', 'declined'])('refuses a coordinator whose assignment is %s and leaves the current operator in place', async (status) => {
    const { instance, tx } = harness([{ eventId: 'evt_1', coordinatorId: 'coord_2', status }]);

    await expect(instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.opsEventOperatorDesignation.updateMany).not.toHaveBeenCalled();
    expect(tx.opsEventOperatorDesignation.create).not.toHaveBeenCalled();
  });

  it('refuses a coordinator who is only assigned to a different event', async () => {
    const { instance, tx } = harness([{ eventId: 'evt_other', coordinatorId: 'coord_2', status: 'acknowledged' }]);

    await expect(instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.opsEventOperatorDesignation.create).not.toHaveBeenCalled();
  });

  it('reports the current operator by name, or none before anyone is designated', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ coordinatorId: 'coord_2', coordinator: { name: 'Coordinator Two' }, designatedAt: new Date('2026-09-08T03:00:00.000Z') })
      .mockResolvedValueOnce(null);
    const instance = new EventScheduleService({ opsEventOperatorDesignation: { findFirst } } as never, { requireActorRole: vi.fn() } as never, {} as never, {} as never, { getEventLiveOps: vi.fn() } as never, clock);

    await expect(instance.getOperatorDesignation('evt_1', pmcm)).resolves.toEqual({
      eventId: 'evt_1',
      operator: { coordinatorId: 'coord_2', coordinatorName: 'Coordinator Two', designatedAt: '2026-09-08T03:00:00.000Z' },
    });
    await expect(instance.getOperatorDesignation('evt_1', pmcm)).resolves.toEqual({ eventId: 'evt_1', operator: null });
  });

  it('keeps the current-operator lookup away from coordinators', async () => {
    const access = { requireActorRole: vi.fn().mockRejectedValue(new ForbiddenException('denied')) };

    await expect(service(access).getOperatorDesignation('evt_1', { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('denied');
  });
});
