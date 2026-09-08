import 'reflect-metadata';
import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { LiveOperationsService } from './live-operations.service';
import { mapUrgentIssue } from './live-ops.mappers';

type WorkflowCommandInput = {
  validateState?: () => Promise<void> | void;
  write: () => Promise<unknown>;
  sideEffects?: (result: unknown) => Promise<void> | void;
};

describe('LiveOperationsService - Urgent Issues & Attribution Security', () => {
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

    const service = new LiveOperationsService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      mockAuditWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[1],
      mockNotificationOutboxWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
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

    const service = new LiveOperationsService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      mockAuditWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[1],
      mockNotificationOutboxWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
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
    const service = new LiveOperationsService(mockPrisma as never, auditWriter as never, mockNotificationOutboxWriter as never, mockWorkflowCommandService as never);

    const result = await service.requestTaskReassignment('evt_001', 'task_1', {
      toOwnerRole: 'Floor Director', toOwnerName: 'Jamie', reason: 'Registration queue is clear',
    }, { name: 'Alex', role: 'coordinator' });

    expect(result).toMatchObject({ id: 'reassignment_1', status: 'pending', toOwnerRole: 'Floor Director' });
    expect(mockNotificationOutboxWriter.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_001', recipient: 'PMCM Admin' }), undefined);
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
        findFirst: vi.fn(async () => request),
        update: vi.fn(async () => updated),
      },
      opsEventDayTask: { update: vi.fn(async () => undefined) },
    };
    const mockPrisma = {
      opsEventTaskReassignmentRequest: { findFirst: vi.fn(async () => request) },
      $transaction: vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx)),
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const service = new LiveOperationsService(mockPrisma as never, auditWriter as never, mockNotificationOutboxWriter as never, mockWorkflowCommandService as never);

    const result = await service.decideTaskReassignment('evt_001', 'reassignment_1', { decision: 'approved', reason: 'Approved' }, { name: 'PMCM', role: 'pmcm-admin' });

    expect(tx.opsEventDayTask.update).toHaveBeenCalledWith({ where: { id: 'task_1' }, data: { assignedRole: 'Floor Director', ownerName: 'Jamie' } });
    expect(result.status).toBe('approved');
    expect(mockNotificationOutboxWriter.write).toHaveBeenCalledWith(expect.objectContaining({ recipient: 'Alex' }), undefined);
  });

  it('rejects a reassignment without a decision reason', async () => {
    const request = {
      id: 'reassignment_1', eventId: 'evt_001', taskId: 'task_1', requestedBy: 'Alex', requestedByRole: 'coordinator',
      fromOwnerRole: 'Registration Staff', fromOwnerName: 'Alex', toOwnerRole: 'Floor Director', toOwnerName: 'Jamie',
      reason: 'Registration queue is clear', status: 'pending', requestedAt: new Date('2026-09-08T03:00:00.000Z'),
      autoApproveAt: new Date('2099-09-08T03:02:00.000Z'), decidedAt: null, decidedBy: null, decisionReason: null,
    };
    const service = new LiveOperationsService(
      { opsEventTaskReassignmentRequest: { findFirst: vi.fn(async () => request) } } as never,
      {} as never,
      mockNotificationOutboxWriter as never,
      mockWorkflowCommandService as never,
    );

    await expect(service.decideTaskReassignment('evt_001', 'reassignment_1', { decision: 'rejected' }, { name: 'PMCM', role: 'pmcm-admin' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the verified actor for coordinator attendance attribution', async () => {
    const existing = {
      id: 'coord_asg_test_1',
      eventId: 'evt_001',
      coordinatorId: 'coord_1',
      coordinatorName: 'Alex Coordinator',
      role: 'Registration Staff',
      attendanceStatus: 'pending',
    };
    const mockPrisma = {
      opsCoordinatorAssignment: {
        findUnique: vi.fn(async () => existing),
        update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
      },
      opsCoordinatorReliabilityNote: {
        create: vi.fn(async () => ({ id: 'reliability_1' })),
      },
      opsEventDayLog: {
        create: vi.fn(async () => ({ id: 'log_3' })),
      },
    };
    const mockAuditWriter = {
      write: vi.fn(async () => undefined),
    };
    const service = new LiveOperationsService(
      mockPrisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      mockAuditWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[1],
      mockNotificationOutboxWriter as unknown as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
    );

    const actor = {
      id: 'usr_admin',
      name: 'Anthony Admin',
      email: 'anthony@pmcm.test',
      role: 'pmcm-admin',
    };
    const input = { status: 'present', notes: 'Checked in at registration.', markedBy: 'Spoofed Operator' };

    await service.updateCoordinatorAttendance('evt_001', existing.id, input, actor);

    expect(mockAuditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_001',
        actor: 'Anthony Admin',
        action: 'Updated coordinator attendance: Alex Coordinator',
        metadata: { status: 'present', notes: 'Checked in at registration.', markedBy: 'Anthony Admin' },
      }),
      undefined,
    );
    expect(mockAuditWriter.write).not.toHaveBeenCalledWith(
      expect.objectContaining({ metadata: expect.objectContaining({ markedBy: 'Spoofed Operator' }) }),
      undefined,
    );
  });

  it('locks and rechecks the replacement coordinator before creating an assignment', async () => {
    const order: string[] = [];
    const event = { id: 'evt_001', eventName: 'Main Event', eventDate: new Date('2026-06-18T00:00:00.000Z') };
    const current = { id: 'assignment_1', eventId: event.id, coordinatorId: 'coord_old', coordinatorName: 'Old', role: 'Registration Staff', eventDate: event.eventDate };
    const conflict = { event: { eventName: 'Other Event' } };
    const tx = {
      $executeRaw: vi.fn(async () => { order.push('lock'); return 0; }),
      opsCoordinatorAssignment: {
        findFirst: vi.fn(async () => { order.push('conflict-check'); return conflict; }),
        create: vi.fn(),
        update: vi.fn(),
      },
    };
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => event) },
      opsCoordinatorAssignment: { findUnique: vi.fn(async () => current) },
      opsCoordinator: { findUnique: vi.fn(async () => ({ id: 'coord_new', name: 'New', active: true, roleTags: ['Registration Staff'] })) },
      $transaction: vi.fn(async (callback: (value: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    const service = new LiveOperationsService(
      prisma as unknown as ConstructorParameters<typeof LiveOperationsService>[0],
      {} as ConstructorParameters<typeof LiveOperationsService>[1],
      {} as ConstructorParameters<typeof LiveOperationsService>[2],
      mockWorkflowCommandService as unknown as ConstructorParameters<typeof LiveOperationsService>[3],
    );

    await expect(service.replaceCoordinatorAssignment(event.id, current.id, {
      replacementCoordinatorId: 'coord_new', role: 'Registration Staff', reason: 'Coverage change',
    }, { name: 'Coordinator', role: 'coordinator' })).rejects.toThrow('already assigned to Other Event');
    expect(order).toEqual(['lock', 'conflict-check']);
    expect(tx.opsCoordinatorAssignment.create).not.toHaveBeenCalled();
  });
});
