import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CoordinatorLiveOpsCommandService } from './coordinator-live-ops-command.service';
import { LiveOpsTaskIssueCommandService } from './live-ops-task-issue-command.service';
import { mapUrgentIssue } from './live-ops.mappers';

type WorkflowCommandInput = {
  validateState?: () => Promise<void> | void;
  write: () => Promise<unknown>;
  sideEffects?: (result: unknown) => Promise<void> | void;
};

const mockWorkflowCommandService = {
  execute: vi.fn(async (definition: WorkflowCommandInput) => {
    await definition.validateState?.();
    const result = await definition.write();
    await definition.sideEffects?.(result);
    return result;
  }),
};

const mockNotificationOutboxWriter = {
  write: vi.fn(async () => undefined),
};
const mockAccountContacts = {
  findApprovedEmailByRole: vi.fn(async () => 'admin@pmcm.test'),
  findApprovedEmailByName: vi.fn(async () => 'alex@example.test'),
};

describe('LiveOpsTaskIssueCommandService - Urgent Issues & Attribution Security', () => {

  it('enforces openedBy to verified actor.name and persists affectedArea', async () => {
    let createdRecord: Record<string, unknown> | null = null;
    const mockPrisma = {
      opsUrgentIssue: {
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          createdRecord = { ...data, createdAt: new Date(), updatedAt: new Date() };
          return createdRecord;
        }),
      },
      opsEventDayLog: {
        create: vi.fn(async () => ({ id: 'log_1' })),
      },
    };

    const mockAuditWriter = {
      write: vi.fn(async () => undefined),
    };

    const service = new LiveOpsTaskIssueCommandService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[0],
      mockAuditWriter as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[1],
      mockNotificationOutboxWriter as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[3],
      mockAccountContacts as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[4],
    );

    const actor = {
      id: 'usr_coord_123',
      name: 'Francis Coordinator',
      email: 'francis@pmcm.test',
      role: 'coordinator',
    };

    const input = {
      title: 'Microphone feedback at Stage A',
      description: 'Audio screeching on main presenter mic',
      severity: 'high',
      affectedArea: 'Main Stage',
      ownerRole: 'Audio Lead',
      ownerName: 'Dan Sounds',
      openedBy: 'Spoofed Administrator', // Attempt to spoof reporter
    };

    const issue = await service.createUrgentIssue('evt_001', input, actor);

    // 1. openedBy must strictly be the verified session actor.name
    expect(issue.openedBy).toBe('Francis Coordinator');
    expect(issue.openedBy).not.toBe('Spoofed Administrator');

    // 2. affectedArea must be persisted
    expect(issue.affectedArea).toBe('Main Stage');
    expect(issue.title).toBe('Microphone feedback at Stage A');
    expect(issue.severity).toBe('high');
    expect(issue.ownerRole).toBe('Audio Lead');

    // 3. Mapper maps affectedArea
    const mapped = mapUrgentIssue(issue, () => 'on_track');
    expect(mapped.affectedArea).toBe('Main Stage');
    expect(mapped.openedBy).toBe('Francis Coordinator');

    // 4. Audit trail matches actor
    expect(mockAuditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_001',
        actor: 'Francis Coordinator',
        action: 'Opened urgent issue: Microphone feedback at Stage A',
        actorRole: 'coordinator',
        actorEmail: 'francis@pmcm.test',
        affectedType: 'urgent_issue',
      }),
      undefined,
    );
  });

  it('updates affectedArea on an existing urgent issue', async () => {
    const existing = {
      id: 'urg_test_1',
      eventId: 'evt_001',
      title: 'Power outage',
      description: 'Breaker tripped',
      severity: 'critical',
      status: 'open',
      affectedArea: 'Stage A',
      ownerRole: 'Electrician',
      ownerName: 'Bob',
      resolution: '',
      openedBy: 'Francis Coordinator',
      slaDueAt: null,
      resolvedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPrisma = {
      opsUrgentIssue: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
      },
      opsEventDayLog: {
        create: vi.fn(async () => ({ id: 'log_2' })),
      },
    };

    const mockAuditWriter = {
      write: vi.fn(async () => undefined),
    };

    const service = new LiveOpsTaskIssueCommandService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[0],
      mockAuditWriter as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[1],
      mockNotificationOutboxWriter as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[3],
      mockAccountContacts as unknown as ConstructorParameters<typeof LiveOpsTaskIssueCommandService>[4],
    );

    const actor = {
      id: 'usr_admin',
      name: 'Anthony Admin',
      email: 'anthony@pmcm.test',
      role: 'pmcm-admin',
    };

    const updated = await service.updateUrgentIssue('evt_001', 'urg_test_1', {
      affectedArea: 'Entire North Wing',
      status: 'assigned',
    }, actor);

    expect(updated.affectedArea).toBe('Entire North Wing');
    expect(updated.status).toBe('assigned');
  });

  it('creates a reassignment request with an approval deadline and queued PMCM notification', async () => {
    const requestedAt = new Date('2026-09-08T03:00:00.000Z');
    vi.useFakeTimers();
    vi.setSystemTime(requestedAt);
    const task = { id: 'task_1', eventId: 'evt_001', title: 'Open registration', assignedRole: 'Registration Staff', ownerName: 'Alex' };
    const request = {
      id: 'reassignment_1', eventId: 'evt_001', taskId: 'task_1', requestedBy: 'Alex', requestedByRole: 'coordinator',
      fromOwnerRole: 'Registration Staff', fromOwnerName: 'Alex', toOwnerRole: 'Floor Director', toOwnerName: 'Jamie',
      reason: 'Registration queue is clear', status: 'pending', requestedAt,
      autoApproveAt: new Date('2026-09-08T03:02:00.000Z'), decidedAt: null, decidedBy: null, decisionReason: null,
    };
    const mockPrisma = {
      opsEventDayTask: { findUnique: vi.fn(async () => task) },
      opsEventTaskReassignmentRequest: { create: vi.fn(async () => request) },
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const service = new LiveOpsTaskIssueCommandService(mockPrisma as never, auditWriter as never, mockNotificationOutboxWriter as never, mockWorkflowCommandService as never, mockAccountContacts as never);

    const result = await service.requestTaskReassignment('evt_001', 'task_1', {
      toOwnerRole: 'Floor Director', toOwnerName: 'Jamie', reason: 'Registration queue is clear',
    }, { name: 'Alex', role: 'coordinator' });

    expect(result).toMatchObject({ id: 'reassignment_1', status: 'pending', toOwnerRole: 'Floor Director' });
    expect(mockNotificationOutboxWriter.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_001', recipient: 'admin@pmcm.test' }), undefined);
    expect(mockAccountContacts.findApprovedEmailByRole).toHaveBeenCalledWith('pmcm-admin');
    vi.useRealTimers();
  });

  it('approves a pending reassignment transactionally and updates the task owner', async () => {
    const request = {
      id: 'reassignment_1', eventId: 'evt_001', taskId: 'task_1', requestedBy: 'Alex', requestedByRole: 'coordinator',
      fromOwnerRole: 'Registration Staff', fromOwnerName: 'Alex', toOwnerRole: 'Floor Director', toOwnerName: 'Jamie',
      reason: 'Registration queue is clear', status: 'pending', requestedAt: new Date('2026-09-08T03:00:00.000Z'),
      autoApproveAt: new Date('2099-09-08T03:02:00.000Z'), decidedAt: null, decidedBy: null, decisionReason: null,
    };
    const updated = { ...request, status: 'approved', decidedAt: new Date(), decidedBy: 'PMCM', decisionReason: 'Approved' };
    const tx = {
      opsEventTaskReassignmentRequest: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => updated),
      },
      opsEventDayTask: { update: vi.fn(async () => undefined) },
    };
    const mockPrisma = {
      opsEventTaskReassignmentRequest: { findFirst: vi.fn(async () => request) },
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const service = new LiveOpsTaskIssueCommandService(mockPrisma as never, auditWriter as never, mockNotificationOutboxWriter as never, mockWorkflowCommandService as never, mockAccountContacts as never);

    const result = await service.decideTaskReassignment('evt_001', 'reassignment_1', { decision: 'approved', reason: 'Approved' }, { name: 'PMCM', role: 'pmcm-admin' });

    expect(tx.opsEventDayTask.update).toHaveBeenCalledWith({ where: { id: 'task_1' }, data: { assignedRole: 'Floor Director', ownerName: 'Jamie' } });
    expect(result.status).toBe('approved');
    expect(mockNotificationOutboxWriter.write).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'alex@example.test' }), undefined);
    expect(mockAccountContacts.findApprovedEmailByName).toHaveBeenCalledWith('Alex');
  });

  it('rejects a reassignment without a decision reason', async () => {
    const request = {
      id: 'reassignment_1', eventId: 'evt_001', taskId: 'task_1', requestedBy: 'Alex', requestedByRole: 'coordinator',
      fromOwnerRole: 'Registration Staff', fromOwnerName: 'Alex', toOwnerRole: 'Floor Director', toOwnerName: 'Jamie',
      reason: 'Registration queue is clear', status: 'pending', requestedAt: new Date('2026-09-08T03:00:00.000Z'),
      autoApproveAt: new Date('2099-09-08T03:02:00.000Z'), decidedAt: null, decidedBy: null, decisionReason: null,
    };
    const service = new LiveOpsTaskIssueCommandService(
      { opsEventTaskReassignmentRequest: { findFirst: vi.fn(async () => request) } } as never,
      {} as never,
      mockNotificationOutboxWriter as never,
      mockWorkflowCommandService as never,
      mockAccountContacts as never,
    );

    await expect(service.decideTaskReassignment('evt_001', 'reassignment_1', { decision: 'rejected' }, { name: 'PMCM', role: 'pmcm-admin' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps a late explicit rejection rejected and leaves task ownership unchanged', async () => {
    const request = {
      id: 'reassignment_late', eventId: 'evt_001', taskId: 'task_1', requestedBy: 'Alex', requestedByRole: 'coordinator',
      fromOwnerRole: 'Registration Staff', fromOwnerName: 'Alex', toOwnerRole: 'Floor Director', toOwnerName: 'Jamie',
      reason: 'Registration queue is clear', status: 'pending', requestedAt: new Date('2026-09-08T03:00:00.000Z'),
      autoApproveAt: new Date('2026-09-08T03:02:00.000Z'), decidedAt: null, decidedBy: null, decisionReason: null,
    };
    const rejected = { ...request, status: 'rejected', decidedAt: new Date(), decidedBy: 'PMCM', decisionReason: 'Keep current owner' };
    const tx = {
      opsEventTaskReassignmentRequest: {
        updateMany: vi.fn(async () => ({ count: 1 })),
        findUnique: vi.fn(async () => rejected),
      },
      opsEventDayTask: { update: vi.fn(async () => undefined) },
    };
    const service = new LiveOpsTaskIssueCommandService({
      opsEventTaskReassignmentRequest: { findFirst: vi.fn(async () => request) },
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    } as never, { write: vi.fn(async () => undefined) } as never, mockNotificationOutboxWriter as never, mockWorkflowCommandService as never, mockAccountContacts as never);
    const result = await service.decideTaskReassignment('evt_001', request.id, { decision: 'rejected', reason: 'Keep current owner' }, { name: 'PMCM', role: 'pmcm-admin' });
    expect(result.status).toBe('rejected');
    expect(tx.opsEventDayTask.update).not.toHaveBeenCalled();
  });
});

describe('CoordinatorLiveOpsCommandService', () => {
  type EventDayLogUpsertArgs = { where: { id: string }; create: Record<string, unknown>; update: Record<string, unknown> };
  const actor = { id: 'usr_admin', name: 'Anthony Admin', email: 'anthony@pmcm.test', role: 'pmcm-admin', explicit: true } as const;
  const assignment = {
    id: 'coord_asg_test_1', eventId: 'evt_001', coordinatorId: 'coord_1', coordinatorName: 'Alex Coordinator',
    role: 'Registration Staff', status: 'acknowledged', attendanceStatus: 'late', attendanceNotes: 'Checked in at registration.',
    doubleBookingWarning: false,
  };

  it('retries an attendance log after the assignment update already committed', async () => {
    const upsertLog = vi.fn(async (_args: EventDayLogUpsertArgs) => ({ id: 'log_3' }))
      .mockRejectedValueOnce(new Error('temporary event-day log failure'))
      .mockResolvedValueOnce({ id: 'log_3' });
    const prisma = { opsEventDayLog: { upsert: upsertLog } };
    const retriedAssignment = { ...assignment, attendanceMarkedAt: '2026-10-04T00:00:00.000Z' };
    const staffingCommands = {
      updateCoordinatorAttendance: vi.fn()
        .mockResolvedValueOnce({ assignment: retriedAssignment, changed: true })
        .mockResolvedValueOnce({ assignment: retriedAssignment, changed: false }),
    };
    const service = new CoordinatorLiveOpsCommandService(prisma as never, staffingCommands as never);
    const input = { status: 'late', notes: 'Checked in at registration.' };

    await expect(service.updateCoordinatorAttendance('evt_001', assignment.id, input, actor, { allowAnotherAssignment: true }))
      .rejects.toThrow('temporary event-day log failure');
    const result = await service.updateCoordinatorAttendance('evt_001', assignment.id, input, actor, { allowAnotherAssignment: true });

    expect(result).toEqual(retriedAssignment);
    expect(staffingCommands.updateCoordinatorAttendance).toHaveBeenCalledTimes(2);
    expect(upsertLog).toHaveBeenCalledTimes(2);
    expect(upsertLog).toHaveBeenNthCalledWith(1, expect.objectContaining({
      create: expect.objectContaining({ actionType: 'coordinator_status_updated', relatedId: assignment.id, actor: actor.name }),
    }));
    expect(upsertLog.mock.calls[0]?.[0].where).toEqual(upsertLog.mock.calls[1]?.[0].where);
  });

  it('uses a stable log identity when a replacement command is replayed', async () => {
    const upsertLog = vi.fn(async (_args: EventDayLogUpsertArgs) => ({ id: 'log_4' }));
    const prisma = { opsEventDayLog: { upsert: upsertLog } };
    const outgoing = { ...assignment, status: 'replaced' };
    const incoming = { ...assignment, id: 'coord_asg_new', coordinatorName: 'New Coordinator', coordinatorId: 'coord_2' };
    const staffingCommands = { replaceCoordinator: vi.fn(async () => ({ outgoing, incoming })) };
    const service = new CoordinatorLiveOpsCommandService(prisma as never, staffingCommands as never);
    const input = { replacementCoordinatorId: 'coord_2', role: 'Registration Staff', reason: 'Coverage change' } as const;

    const first = await service.replaceCoordinatorAssignment('evt_001', assignment.id, input, actor);
    const replay = await service.replaceCoordinatorAssignment('evt_001', assignment.id, input, actor);
    expect(first).toEqual({ replacedAssignment: outgoing, replacementAssignment: incoming });
    expect(replay).toEqual(first);
    expect(staffingCommands.replaceCoordinator).toHaveBeenCalledWith('evt_001', assignment.id, input, actor);
    expect(upsertLog).toHaveBeenCalledTimes(2);
    expect(upsertLog).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ actionType: 'coordinator_replaced', relatedId: assignment.id }),
    }));
    expect(upsertLog.mock.calls[0]?.[0].where).toEqual(upsertLog.mock.calls[1]?.[0].where);
  });
});
