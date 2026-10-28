import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { EventScheduleService } from './event-schedule.service';

function createScheduleService(
  prisma: any,
  access: any,
  audit: any,
  staffing: any,
  readModel: any,
  clock?: any,
  owners: { eventReferences?: any; operationsReferences?: any } = {},
) {
  const eventReferences = owners.eventReferences ?? {
    findOperationsEvent: vi.fn(async (eventId: string, transaction?: { prisma: any }) => {
      const client = transaction?.prisma ?? prisma;
      const event = await client.opsEvent?.findUnique?.({ where: { id: eventId } });
      return event ?? { id: eventId, archived: false };
    }),
  };
  const operationsReferences = owners.operationsReferences ?? {
    findCoordinatorProfile: vi.fn(async () => null),
    findEligibleOperatorAssignment: vi.fn(async () => null),
    findEligibleHandoffAssignments: vi.fn(async () => []),
  };
  return new EventScheduleService(
    prisma as never,
    access as never,
    audit as never,
    staffing as never,
    readModel as never,
    eventReferences as never,
    operationsReferences as never,
    clock,
  );
}
function service(access: { requireActorRole: ReturnType<typeof vi.fn> }, staffing = {}) {
  return createScheduleService({} as never, access as never, {} as never, staffing as never, { getEventLiveOps: vi.fn() } as never);
}

describe('EventScheduleService authority', () => {
  it('keeps archived schedules, handoffs and reports readable but refuses coordinator writes', async () => {
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ archived: true })) },
      opsEventOperatorDesignation: { findFirst: vi.fn(async () => ({ id: 'designation_1' })) },
      opsEventHandoff: { findMany: vi.fn(async () => []) },
      opsEventEodReport: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(),
    };
    const instance = createScheduleService(prisma as never, { requireActorRole: vi.fn() } as never, {} as never,
      { findAssignmentForEventActor: vi.fn(async () => ({ id: 'a_1', coordinatorId: 'coord_1' })) } as never,
      { getEventLiveOps: vi.fn(async () => ({ schedule: { eventId: 'evt_1', days: [] } })) } as never);
    const actor = { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as const;
    const writes = [
      () => instance.createDay('evt_1', { dayDate: '2026-10-01' }, actor as never),
      () => instance.createSegment('evt_1', 'day_1', { title: 'Opening', ownerRole: 'Usher', plannedStartAt: '2026-10-01T10:00:00Z', plannedEndAt: '2026-10-01T11:00:00Z' }, actor as never),
      () => instance.updateSegmentStatus('evt_1', 'segment_1', { action: 'start' }, actor as never),
      () => instance.createHandoff('evt_1', { dayId: 'day_1', role: 'Usher', fromAssignmentId: 'a_1', toAssignmentId: 'a_2', outstandingItems: [] }, actor as never),
      () => instance.submitEodReport('evt_1', { dayId: 'day_1', progress: ['Done'], issues: [], risksForTomorrow: [] }, actor as never),
    ];
    for (const write of writes) await expect(write()).rejects.toThrow('Archived coordinator events are read-only');
    expect(prisma.$transaction).not.toHaveBeenCalled();
    await expect(instance.getSchedule('evt_1', actor as never)).resolves.toMatchObject({ eventId: 'evt_1', days: [] });
    await expect(instance.listHandoffs('evt_1', actor as never)).resolves.toEqual([]);
    await expect(instance.listEodReports('evt_1', actor as never)).resolves.toEqual([]);
  });

  it('keeps operator designation PMCM-only', async () => {
    const access = { requireActorRole: vi.fn().mockRejectedValue(new ForbiddenException('denied')) };
    await expect(service(access).designateOperator('evt_1', { coordinatorId: 'coord_1' }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('denied');
    expect(access.requireActorRole).toHaveBeenCalledWith(expect.anything(), ['pmcm-admin'], 'event day system operator designation', 'evt_1');
    await expect(service(access).revokeOperator('evt_1', { id: 'coord_1', name: 'Coordinator', role: 'coordinator', explicit: true })).rejects.toThrow('denied');
  });

  it('does not permit a coordinator to bypass event-day authority checks', async () => {
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const instance = service(access, { findAssignmentForEventActor: vi.fn().mockResolvedValue(null) });
    await expect(instance.createHandoff('evt_1', { dayId: 'day_1', role: 'Floor Director', fromAssignmentId: 'a_1', toAssignmentId: 'a_2', outstandingItems: [] }, { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('Coordinator may only act');
  });

  it('lists handoffs only for a coordinator assigned to the event', async () => {
    const eventId = 'evt_1';
    const actor = { id: 'coord_1', name: 'Coordinator One', role: 'coordinator' };
    const row = {
      id: 'handoff_1', eventId, dayId: 'day_1', role: 'Floor Director',
      fromAssignmentId: 'assignment_1', toAssignmentId: 'assignment_2',
      handedOffBy: 'coord_1', receivedBy: 'coord_2',
      handedOffAt: new Date('2026-10-01T10:00:00.000Z'), outstandingItems: ['Confirm stage cue'],
    };
    const prisma = { opsEventHandoff: { findMany: vi.fn().mockResolvedValue([row]) } };
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn().mockResolvedValue({ id: 'assignment_1' }) };
    const instance = createScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.listHandoffs(eventId, actor as never)).resolves.toMatchObject([
      { id: 'handoff_1', eventId, dayId: 'day_1', outstandingItems: ['Confirm stage cue'] },
    ]);
    expect(prisma.opsEventHandoff.findMany).toHaveBeenCalledWith({
      where: { eventId }, orderBy: [{ handedOffAt: 'desc' }, { id: 'desc' }],
    });
    expect(staffing.findAssignmentForEventActor).toHaveBeenCalledWith(eventId, actor);
  });

  it('rejects a handoff that reuses the same coordinator assignment', async () => {
    const day = { id: 'day_1' };
    const assignment = { id: 'assignment_1', role: 'Floor Director', coordinatorId: 'coord_1', coordinatorName: 'Coordinator One' };
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsEventScheduleDay: { findFirst: vi.fn().mockResolvedValue(day) },
      opsCoordinatorAssignment: { findFirst: vi.fn().mockResolvedValue(assignment) },
      opsEventHandoff: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const instance = createScheduleService(prisma as never, access as never, {} as never, {} as never, {} as never);

    await expect(instance.createHandoff('evt_1', {
      dayId: 'day_1', role: 'Floor Director', fromAssignmentId: 'assignment_1', toAssignmentId: 'assignment_1', outstandingItems: [],
    }, { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never)).rejects.toThrow('different coordinator assignment');
    expect(tx.opsEventHandoff.create).not.toHaveBeenCalled();
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
      $executeRaw: vi.fn(async () => 0),
      opsCoordinator: { findFirst: vi.fn().mockResolvedValue(current) },
      opsCoordinatorAssignment: { findFirst: vi.fn().mockResolvedValue({ id: 'assignment_2' }) },
      opsEventOperatorDesignation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue(created),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const auditWriter = { write: vi.fn().mockResolvedValue(undefined) };
    const instance = createScheduleService(
      prisma as never,
      access as never,
      auditWriter as never,
      {} as never,
      { getEventLiveOps: vi.fn() } as never,
      { now: () => new Date('2026-09-08T03:00:00.000Z') },
      { operationsReferences: {
        findCoordinatorProfile: vi.fn(async () => current),
        findEligibleOperatorAssignment: vi.fn(async () => ({
          id: 'assignment_2', eventId: 'evt_1', coordinatorId: 'coord_2', coordinatorName: current.name,
          role: 'Registration Staff', status: 'acknowledged',
        })),
        findEligibleHandoffAssignments: vi.fn(async () => []),
      } },
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

  function harness(eligibleAssignment: Record<string, unknown> | null) {
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsEventOperatorDesignation: {
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'designation_2', eventId: 'evt_1', coordinatorId: 'coord_2' }),
      },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const operationsReferences = {
      findCoordinatorProfile: vi.fn(async () => null),
      findEligibleOperatorAssignment: vi.fn(async () => eligibleAssignment),
      findEligibleHandoffAssignments: vi.fn(async () => []),
    };
    const instance = createScheduleService(
      prisma as never,
      { requireActorRole: vi.fn() } as never,
      { write: vi.fn() } as never,
      {} as never,
      { getEventLiveOps: vi.fn() } as never,
      clock,
      { operationsReferences },
    );
    return { instance, tx, operationsReferences };
  }

  it('designates a current assignment through the Operations capability', async () => {
    const assignment = {
      id: 'assignment_2', eventId: 'evt_1', coordinatorId: 'coord_2',
      coordinatorName: 'Coordinator Two', role: 'Registration Staff', status: 'acknowledged',
    };
    const { instance, tx, operationsReferences } = harness(assignment);

    await instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, pmcm);

    expect(operationsReferences.findEligibleOperatorAssignment).toHaveBeenCalledWith(
      'evt_1', 'coord_2', expect.objectContaining({ prisma: tx, actorId: 'pmcm_1' }),
    );
    expect(tx.opsEventOperatorDesignation.create).toHaveBeenCalledTimes(1);
  });

  it.each(['inactive coordinator', 'missing assignment', 'cross-event assignment', 'cancelled or replaced assignment'])(
    'leaves the current designation in place when Operations rejects an %s',
    async () => {
      const { instance, tx } = harness(null);

      await expect(instance.designateOperator('evt_1', { coordinatorId: 'coord_2' }, pmcm)).rejects.toBeInstanceOf(BadRequestException);

      expect(tx.opsEventOperatorDesignation.updateMany).not.toHaveBeenCalled();
      expect(tx.opsEventOperatorDesignation.create).not.toHaveBeenCalled();
    },
  );

  it('reports the current operator through the Operations owner and handles a missing profile', async () => {
    const findFirst = vi.fn()
      .mockResolvedValueOnce({ coordinatorId: 'coord_2', designatedAt: new Date('2026-09-08T03:00:00.000Z') })
      .mockResolvedValueOnce({ coordinatorId: 'coord_missing', designatedAt: new Date('2026-09-08T03:00:00.000Z') })
      .mockResolvedValueOnce(null);
    const operationsReferences = {
      findCoordinatorProfile: vi.fn(async (coordinatorId: string) =>
        coordinatorId === 'coord_2' ? { id: coordinatorId, name: 'Coordinator Two', active: true } : null),
      findEligibleOperatorAssignment: vi.fn(async () => null),
      findEligibleHandoffAssignments: vi.fn(async () => []),
    };
    const instance = createScheduleService(
      { opsEventOperatorDesignation: { findFirst } } as never,
      { requireActorRole: vi.fn() } as never,
      {} as never,
      {} as never,
      { getEventLiveOps: vi.fn() } as never,
      clock,
      { operationsReferences },
    );

    await expect(instance.getOperatorDesignation('evt_1', pmcm)).resolves.toEqual({
      eventId: 'evt_1',
      operator: { coordinatorId: 'coord_2', coordinatorName: 'Coordinator Two', designatedAt: '2026-09-08T03:00:00.000Z' },
    });
    await expect(instance.getOperatorDesignation('evt_1', pmcm)).resolves.toEqual({
      eventId: 'evt_1',
      operator: { coordinatorId: 'coord_missing', coordinatorName: null, designatedAt: '2026-09-08T03:00:00.000Z' },
    });
    await expect(instance.getOperatorDesignation('evt_1', pmcm)).resolves.toEqual({ eventId: 'evt_1', operator: null });
  });

  it('keeps the current-operator lookup away from coordinators', async () => {
    const access = { requireActorRole: vi.fn().mockRejectedValue(new ForbiddenException('denied')) };

    await expect(service(access).getOperatorDesignation('evt_1', { id: 'coord_1', name: 'Coordinator', role: 'coordinator' } as never)).rejects.toThrow('denied');
  });
});
describe('EventScheduleService schedule-segment transitions', () => {
  const pmcm = { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never;
  const now = new Date('2026-10-02T12:00:00.000Z');

  function makeTransitionHarness(status: string, updateCount = 1) {
    const current = {
      id: 'segment_1', dayId: 'day_1', sequence: 0, title: 'Doors open',
      plannedStartAt: new Date('2026-10-02T08:00:00.000Z'), plannedEndAt: new Date('2026-10-02T09:00:00.000Z'),
      ownerRole: 'Registration Staff', location: '', status,
      actualStartedAt: status === 'active' || status === 'complete' ? new Date('2026-10-02T08:05:00.000Z') : null,
      actualEndedAt: status === 'complete' ? new Date('2026-10-02T09:10:00.000Z') : null,
    };
    let updated = current;
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      $queryRaw: vi.fn(async () => []),
      opsEventScheduleSegment: {
        findFirst: vi.fn(async () => updated),
        updateMany: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          if (updateCount === 1) updated = { ...current, ...data } as typeof current;
          return { count: updateCount };
        }),
        count: vi.fn(async () => 0),
      },
      opsEventScheduleDay: { update: vi.fn(async () => undefined) },
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = createScheduleService(
      prisma as never,
      access as never,
      auditWriter as never,
      {} as never,
      {} as never,
      { now: () => now },
    );
    return { instance, tx, auditWriter };
  }

  it.each([
    ['planned', 'stop'],
    ['active', 'start'],
    ['complete', 'start'],
    ['complete', 'skip'],
    ['skipped', 'stop'],
  ])('rejects %s → %s without changing the segment', async (status, action) => {
    const { instance, tx, auditWriter } = makeTransitionHarness(status);

    await expect(instance.updateSegmentStatus('evt_1', 'segment_1', { action } as never, pmcm)).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.opsEventScheduleSegment.updateMany).not.toHaveBeenCalled();
    expect(tx.opsEventScheduleDay.update).not.toHaveBeenCalled();
    expect(auditWriter.write).not.toHaveBeenCalled();
  });

  it('ends an active segment when skipped and closes the day when no work remains', async () => {
    const { instance, tx } = makeTransitionHarness('active');

    await expect(instance.updateSegmentStatus('evt_1', 'segment_1', { action: 'skip' }, pmcm)).resolves.toMatchObject({
      status: 'skipped',
      actualEndedAt: now.toISOString(),
    });

    expect(tx.opsEventScheduleSegment.updateMany).toHaveBeenCalledWith({
      where: { id: 'segment_1', status: 'active' },
      data: { status: 'skipped', actualEndedAt: now },
    });
    expect(tx.opsEventScheduleDay.update).toHaveBeenCalledWith({ where: { id: 'day_1' }, data: { status: 'complete' } });
  });

  it('reports a conflict when another update changed the segment state first', async () => {
    const { instance, tx } = makeTransitionHarness('planned', 0);

    await expect(instance.updateSegmentStatus('evt_1', 'segment_1', { action: 'start' }, pmcm)).rejects.toBeInstanceOf(ConflictException);

    expect(tx.opsEventScheduleDay.update).not.toHaveBeenCalled();
  });

  it('closes the day when concurrent transitions finish its last segments', async () => {
    const segments = new Map([
      ['segment_1', { id: 'segment_1', dayId: 'day_1', sequence: 0, title: 'Doors open', plannedStartAt: new Date('2026-10-02T08:00:00.000Z'), plannedEndAt: new Date('2026-10-02T09:00:00.000Z'), ownerRole: 'Registration Staff', location: '', status: 'active', actualStartedAt: new Date('2026-10-02T08:00:00.000Z'), actualEndedAt: null }],
      ['segment_2', { id: 'segment_2', dayId: 'day_1', sequence: 1, title: 'Guest exit', plannedStartAt: new Date('2026-10-02T09:00:00.000Z'), plannedEndAt: new Date('2026-10-02T10:00:00.000Z'), ownerRole: 'Registration Staff', location: '', status: 'active', actualStartedAt: new Date('2026-10-02T09:00:00.000Z'), actualEndedAt: null }],
    ]);
    let dayStatus = 'active';
    let lockTail: Promise<void> = Promise.resolve();
    const prisma = {
      $transaction: vi.fn(async (callback: (tx: Record<string, unknown>) => unknown) => {
        const stagedSegments = new Map<string, Record<string, unknown>>();
        let stagedDayStatus: string | undefined;
        let releaseDayLock: (() => void) | undefined;
        const tx = {
      $executeRaw: vi.fn(async () => 0),
          $queryRaw: vi.fn(async () => {
            const priorLock = lockTail;
            let release!: () => void;
            lockTail = new Promise<void>((resolve) => { release = resolve; });
            await priorLock;
            releaseDayLock = release;
            return [];
          }),
          opsEventScheduleSegment: {
            findFirst: vi.fn(async ({ where }: { where: { id: string } }) => {
              const segment = segments.get(where.id);
              return segment ? { ...segment, ...stagedSegments.get(where.id) } : null;
            }),
            updateMany: vi.fn(async ({ where, data }: { where: { id: string; status: string }; data: Record<string, unknown> }) => {
              const segment = segments.get(where.id);
              const currentStatus = stagedSegments.get(where.id)?.status ?? segment?.status;
              if (!segment || currentStatus !== where.status) return { count: 0 };
              stagedSegments.set(where.id, { ...stagedSegments.get(where.id), ...data });
              return { count: 1 };
            }),
            count: vi.fn(async ({ where }: { where: { status: { notIn: string[] } } }) => [...segments.values()].filter((segment) => {
              const stagedStatus = stagedSegments.get(segment.id)?.status;
              const status = typeof stagedStatus === 'string' ? stagedStatus : segment.status;
              return !where.status.notIn.includes(status);
            }).length),
          },
          opsEventScheduleDay: {
            update: vi.fn(async ({ data }: { data: { status: string } }) => { stagedDayStatus = data.status; }),
          },
        };
        try {
          const result = await callback(tx);
          for (const [id, data] of stagedSegments) {
            const segment = segments.get(id);
            if (segment) segments.set(id, { ...segment, ...data });
          }
          if (stagedDayStatus) dayStatus = stagedDayStatus;
          return result;
        } finally {
          releaseDayLock?.();
        }
      }),
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const instance = createScheduleService(
      prisma as never,
      { requireActorRole: vi.fn(async () => undefined) } as never,
      auditWriter as never,
      {} as never,
      {} as never,
      { now: () => now },
    );

    const [completed, skipped] = await Promise.all([
      instance.updateSegmentStatus('evt_1', 'segment_1', { action: 'stop' }, pmcm),
      instance.updateSegmentStatus('evt_1', 'segment_2', { action: 'skip' }, pmcm),
    ]);

    expect(completed.status).toBe('complete');
    expect(skipped.status).toBe('skipped');
    expect(dayStatus).toBe('complete');
    expect([...segments.values()].map((segment) => segment.status)).toEqual(['complete', 'skipped']);
  });
});

describe('EventScheduleService end-of-day reports', () => {
  const coordinator = { id: 'user_coord_1', name: 'Coordinator One', role: 'coordinator' };
  const input = { dayId: 'day_1', progress: ['Doors opened'], issues: [], risksForTomorrow: [] };

  it('does not read reports for coordinators who are not assigned to the event', async () => {
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => null) };
    const findMany = vi.fn();
    const instance = createScheduleService({ opsEventEodReport: { findMany } } as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.listEodReports('evt_secret', coordinator as never)).rejects.toBeInstanceOf(ForbiddenException);

    expect(findMany).not.toHaveBeenCalled();
  });

  it('keeps report submission coordinator-only at the service boundary', async () => {
    const access = {
      requireActorRole: vi.fn(async (actor: { role: string }, allowedRoles: string[]) => {
        if (!allowedRoles.includes(actor.role)) throw new ForbiddenException('role cannot submit reports');
      }),
    };
    const transaction = vi.fn();
    const instance = createScheduleService({ $transaction: transaction } as never, access as never, {} as never, {} as never, {} as never);

    await expect(instance.submitEodReport('evt_1', input, { id: 'pmcm_1', name: 'PMCM', role: 'pmcm-admin' } as never)).rejects.toBeInstanceOf(ForbiddenException);

    expect(transaction).not.toHaveBeenCalled();
  });

  it('marks only the submitting coordinator as able to edit their report', async () => {
    const report = {
      id: 'report_1', eventId: 'evt_1', dayId: 'day_1', authoredBy: 'user_coord_1', authoredByRole: 'coordinator',
      progress: ['Doors opened'], issues: [], risksForTomorrow: [], submittedAt: new Date('2026-10-02T18:00:00.000Z'),
      replies: [{ id: 'reply_1', reportId: 'report_1', authorId: 'pmcm_1', authorRole: 'pmcm-admin', body: 'Thanks', createdAt: new Date('2026-10-02T18:10:00.000Z') }],
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'assignment_1' })) };
    const findMany = vi.fn(async () => [report]);
    const instance = createScheduleService({ opsEventEodReport: { findMany } } as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.listEodReports('evt_1', coordinator as never)).resolves.toMatchObject([
      { id: 'report_1', canEdit: true, replies: [{ id: 'reply_1', body: 'Thanks' }] },
    ]);
  });

  it('blocks another coordinator from overwriting an existing report', async () => {
    const day = { dayDate: new Date('2026-10-02T00:00:00.000Z') };
    const existing = { id: 'report_1', authoredBy: 'user_coord_1' };
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsEventScheduleDay: { findFirst: vi.fn(async () => day) },
      opsEventEodReport: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'assignment_2' })) };
    const prisma = { opsEvent: { findUnique: vi.fn(async () => ({ archived: false })) }, $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = createScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);
    const actor = { ...coordinator, id: 'user_coord_2' } as never;

    await expect(instance.submitEodReport('evt_1', input, actor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.opsEventEodReport.update).not.toHaveBeenCalled();
    expect(tx.opsEventEodReport.create).not.toHaveBeenCalled();
  });

  it('turns a concurrent same-day report insert into a reload conflict', async () => {
    const day = { dayDate: new Date('2026-10-02T00:00:00.000Z') };
    const tx = {
      $executeRaw: vi.fn(async () => 0),
      opsEventScheduleDay: { findFirst: vi.fn(async () => day) },
      opsEventEodReport: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => { throw { code: 'P2002' }; }),
      },
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'assignment_1' })) };
    const prisma = { opsEvent: { findUnique: vi.fn(async () => ({ archived: false })) }, $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = createScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.submitEodReport('evt_1', input, coordinator as never)).rejects.toBeInstanceOf(ConflictException);
  });
});
