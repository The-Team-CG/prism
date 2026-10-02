import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
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
    const instance = new EventScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);

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
      opsEventScheduleDay: { findFirst: vi.fn().mockResolvedValue(day) },
      opsCoordinatorAssignment: { findFirst: vi.fn().mockResolvedValue(assignment) },
      opsEventHandoff: { create: vi.fn() },
    };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const access = { requireActorRole: vi.fn().mockResolvedValue(undefined) };
    const instance = new EventScheduleService(prisma as never, access as never, {} as never, {} as never, {} as never);

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
    const instance = new EventScheduleService(
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
});

describe('EventScheduleService end-of-day reports', () => {
  const coordinator = { id: 'user_coord_1', name: 'Coordinator One', role: 'coordinator' };
  const input = { dayId: 'day_1', progress: ['Doors opened'], issues: [], risksForTomorrow: [] };

  it('does not read reports for coordinators who are not assigned to the event', async () => {
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => null) };
    const findMany = vi.fn();
    const instance = new EventScheduleService({ opsEventEodReport: { findMany } } as never, access as never, {} as never, staffing as never, {} as never);

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
    const instance = new EventScheduleService({ $transaction: transaction } as never, access as never, {} as never, {} as never, {} as never);

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
    const instance = new EventScheduleService({ opsEventEodReport: { findMany } } as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.listEodReports('evt_1', coordinator as never)).resolves.toMatchObject([
      { id: 'report_1', canEdit: true, replies: [{ id: 'reply_1', body: 'Thanks' }] },
    ]);
  });

  it('blocks another coordinator from overwriting an existing report', async () => {
    const day = { dayDate: new Date('2026-10-02T00:00:00.000Z') };
    const existing = { id: 'report_1', authoredBy: 'user_coord_1' };
    const tx = {
      opsEventScheduleDay: { findFirst: vi.fn(async () => day) },
      opsEventEodReport: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(),
        create: vi.fn(),
      },
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'assignment_2' })) };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = new EventScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);
    const actor = { ...coordinator, id: 'user_coord_2' } as never;

    await expect(instance.submitEodReport('evt_1', input, actor)).rejects.toBeInstanceOf(ForbiddenException);

    expect(tx.opsEventEodReport.update).not.toHaveBeenCalled();
    expect(tx.opsEventEodReport.create).not.toHaveBeenCalled();
  });

  it('turns a concurrent same-day report insert into a reload conflict', async () => {
    const day = { dayDate: new Date('2026-10-02T00:00:00.000Z') };
    const tx = {
      opsEventScheduleDay: { findFirst: vi.fn(async () => day) },
      opsEventEodReport: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async () => { throw { code: 'P2002' }; }),
      },
    };
    const access = { requireActorRole: vi.fn(async () => undefined) };
    const staffing = { findAssignmentForEventActor: vi.fn(async () => ({ id: 'assignment_1' })) };
    const prisma = { $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)) };
    const instance = new EventScheduleService(prisma as never, access as never, {} as never, staffing as never, {} as never);

    await expect(instance.submitEodReport('evt_1', input, coordinator as never)).rejects.toBeInstanceOf(ConflictException);
  });
});
