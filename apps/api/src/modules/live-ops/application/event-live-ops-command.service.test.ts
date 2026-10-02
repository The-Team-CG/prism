import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventLiveOpsCommandService } from './event-live-ops-command.service';

function coordinatorActor() {
  return {
    id: 'usr_coord',
    role: OpsUserRole.Coordinator,
    name: 'Marco Santos',
    email: 'marco@pmcm.test',
    coordinatorId: 'coord_marco',
    explicit: true,
  };
}

function pmcmAdminActor() {
  return {
    id: 'usr_pmcm',
    role: OpsUserRole.PmcmAdmin,
    name: 'Ms. Mys',
    email: 'mys@pmcm.test',
    explicit: true,
  };
}

// mapCoordinatorAssignmentForEventDay reads attendance/replacement fields straight off
// this row, so the stub must resolve a realistic assignment rather than undefined.
function coordinatorAssignmentRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'coord_asg_ayala_marco',
    eventId: 'evt_sample_ayala',
    coordinatorId: 'coord_marco',
    coordinatorName: 'Marco Santos',
    role: 'Registration Staff',
    status: 'acknowledged',
    attendanceStatus: 'present',
    attendanceMarkedAt: new Date('2026-09-02T00:00:00.000Z'),
    attendanceNotes: '',
    replacedByAssignmentId: null,
    replacementReason: '',
    replacedAt: null,
    replacedBy: null,
    eventDate: new Date('2026-09-02T00:00:00.000Z'),
    createdAt: new Date('2026-09-02T00:00:00.000Z'),
    updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    ...overrides,
  };
}

function urgentIssueRow(overrides: Record<string, unknown> = {}) {
  const at = new Date('2026-09-02T00:00:00.000Z');
  return {
    id: 'issue_1',
    eventId: 'evt_sample_ayala',
    title: 'Power interruption',
    description: '',
    severity: 'high',
    status: 'open',
    affectedArea: 'Main Stage',
    ownerRole: 'Registration Staff',
    ownerName: 'Marco Santos',
    resolution: '',
    openedBy: 'Marco Santos',
    slaDueAt: null,
    slaStatus: 'on_track',
    escalationLevel: 'none',
    escalatedAt: null,
    escalatedBy: null,
    escalationNotes: '',
    createdAt: at,
    updatedAt: at,
    ...overrides,
  };
}

function createService(assignment: unknown) {
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_sample_unassigned', archived: false })),
    },
    opsEventOperatorDesignation: {
      findFirst: vi.fn(async () => null),
    },
    opsEventDayTask: {
      findFirst: vi.fn(async () => null),
    },
    opsUrgentIssue: {
      findFirst: vi.fn(async () => null),
    },
  };
  const eventAccessPolicyService = {
    requireActorRole: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
    sameText: vi.fn((left: string | null | undefined, right: string | null | undefined) => left?.trim().toLowerCase() === right?.trim().toLowerCase()),
  };
  const liveOperationsService = {
    createEventDayTask: vi.fn(),
    createUrgentIssue: vi.fn(async (_eventId: string, _input: unknown) => urgentIssueRow()),
    updateUrgentIssue: vi.fn(async () => urgentIssueRow()),
    escalateUrgentIssue: vi.fn(async () => urgentIssueRow()),
    updateEventDayTask: vi.fn(async (_eventId: string, taskId: string, input: { status?: string; notes?: string; ownerName?: string; slaDueAt?: string }) => ({
      id: taskId,
      eventId: 'evt_sample_ayala',
      title: 'Open registration',
      assignedRole: 'Registration Staff',
      ownerName: input.ownerName ?? 'Marco Santos',
      priority: 'normal',
      status: input.status ?? 'open',
      notes: input.notes ?? '',
      dueAt: null,
      slaDueAt: input.slaDueAt ?? null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    })),
  };
  const coordinatorCommandService = {
    updateCoordinatorAttendance: vi.fn(async () => coordinatorAssignmentRow()),
    replaceCoordinatorAssignment: vi.fn(),
  };
  const staffingReader = {
    findAssignmentForEventActor: vi.fn(async () => assignment),
    mapCoordinatorAssignment: vi.fn(),
  };
  const supplierCommands = {};
  const service = new EventLiveOpsCommandService(
    prisma as never,
    eventAccessPolicyService as never,
    liveOperationsService as never,
    coordinatorCommandService as never,
    staffingReader as never,
    supplierCommands as never,
  );
  return { service, liveOperationsService, coordinatorCommandService, eventAccessPolicyService, staffingReader, prisma };
}

describe('EventLiveOpsCommandService event scoping', () => {
  it('rejects archived coordinator task, issue, attendance and reassignment writes before commands run', async () => {
    const { service, prisma, liveOperationsService, coordinatorCommandService, eventAccessPolicyService } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala', archived: true });
    const actor = coordinatorActor();
    const writes = [
      () => service.createEventDayTask('evt_sample_ayala', { title: 'Task', assignedRole: 'Registration Staff' }, actor),
      () => service.updateEventDayTask('evt_sample_ayala', 'task_1', { status: 'done' }, actor),
      () => service.createUrgentIssue('evt_sample_ayala', { title: 'Issue' }, actor),
      () => service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_marco', { status: 'present' }, actor),
      () => service.requestTaskReassignment('evt_sample_ayala', 'task_1', { toOwnerRole: 'Usher', reason: 'Coverage' }, actor),
    ];
    for (const write of writes) await expect(write()).rejects.toThrow('Archived coordinator events are read-only');
    expect(liveOperationsService.createEventDayTask).not.toHaveBeenCalled();
    expect(liveOperationsService.updateEventDayTask).not.toHaveBeenCalled();
    expect(liveOperationsService.createUrgentIssue).not.toHaveBeenCalled();
    expect(coordinatorCommandService.updateCoordinatorAttendance).not.toHaveBeenCalled();
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(actor, 'archived coordinator event write', 'evt_sample_ayala');
  });

  it('rejects coordinator writes when the actor is not assigned to the event', async () => {
    const { service, liveOperationsService, eventAccessPolicyService, staffingReader } = createService(null);

    await expect(
      service.createEventDayTask('evt_sample_unassigned', { title: 'Should not persist' }, coordinatorActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(staffingReader.findAssignmentForEventActor).toHaveBeenCalledWith(
      'evt_sample_unassigned',
      expect.objectContaining({ email: 'marco@pmcm.test' }),
    );
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
      'assigned event-day operations',
      'evt_sample_unassigned',
    );
    expect(liveOperationsService.createEventDayTask).not.toHaveBeenCalled();
  });

  it('allows coordinator task writes when the assigned role normalizes to their historical assignment role', async () => {
    const { service, liveOperationsService, prisma } = createService(
      coordinatorAssignmentRow({ role: ' floor   director ' }),
    );

    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    liveOperationsService.createEventDayTask.mockResolvedValue({
      id: 'edt_ok',
      eventId: 'evt_sample_ayala',
      title: 'Open registration',
      assignedRole: 'Floor Director',
      ownerName: '',
      priority: 'normal',
      status: 'open',
      notes: '',
      dueAt: null,
      slaDueAt: null,
      slaStatus: 'on_track',
      escalationLevel: 'none',
      escalatedAt: null,
      escalatedBy: null,
      escalationNotes: '',
      completedAt: null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    });

    await service.createEventDayTask(
      'evt_sample_ayala',
      { title: 'Open registration', assignedRole: 'Floor Director' },
      coordinatorActor(),
    );
    expect(liveOperationsService.createEventDayTask).toHaveBeenCalledTimes(1);
  });

  it('allows an unmapped historical role only to create a canonical task in its own named queue', async () => {
    const { service, liveOperationsService, prisma } = createService(
      coordinatorAssignmentRow({ role: 'Volunteer Lead' }),
    );
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    liveOperationsService.createEventDayTask.mockResolvedValue({
      id: 'task_legacy_role',
      eventId: 'evt_sample_ayala',
      title: 'Check arrival desk',
      assignedRole: 'General Coordinator',
      ownerName: 'Marco Santos',
      priority: 'normal',
      status: 'open',
      notes: '',
      dueAt: null,
      slaDueAt: null,
      createdAt: new Date('2026-09-02T00:00:00.000Z'),
      updatedAt: new Date('2026-09-02T00:00:00.000Z'),
    } as never);

    await service.createEventDayTask(
      'evt_sample_ayala',
      { title: 'Check arrival desk', assignedRole: 'General Coordinator', ownerName: 'Marco Santos' },
      coordinatorActor(),
    );

    expect(liveOperationsService.createEventDayTask).toHaveBeenCalledWith(
      'evt_sample_ayala',
      expect.objectContaining({ assignedRole: 'General Coordinator', ownerName: 'Marco Santos' }),
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
    );
  });

  it('does not let an unmapped historical role submit a task without its own queue name', async () => {
    const { service, liveOperationsService, prisma } = createService(
      coordinatorAssignmentRow({ role: 'Volunteer Lead' }),
    );
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);

    await expect(
      service.createEventDayTask(
        'evt_sample_ayala',
        { title: 'Check arrival desk', assignedRole: 'General Coordinator' },
        coordinatorActor(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.createEventDayTask).not.toHaveBeenCalled();
  });

  it('keeps coordinator task updates to progress fields so reassignment requires PMCM review', async () => {
    const { service, liveOperationsService, eventAccessPolicyService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsEventDayTask.findFirst.mockResolvedValue({
      id: 'task_registration',
      eventId: 'evt_sample_ayala',
      title: 'Open registration',
      assignedRole: 'Registration Staff',
      ownerName: 'Marco Santos',
      status: 'open',
    } as never);

    await expect(
      service.updateEventDayTask(
        'evt_sample_ayala',
        'task_registration',
        { status: 'in_progress', ownerName: 'Rhea Dela Cruz' },
        coordinatorActor(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.updateEventDayTask).not.toHaveBeenCalled();
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
      'coordinator task ownership update',
      'evt_sample_ayala',
    );
  });

  it('lets an unmapped-role coordinator update their own General Coordinator fallback task', async () => {
    const { service, liveOperationsService, prisma } = createService(
      coordinatorAssignmentRow({ role: 'Volunteer Lead' }),
    );
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsEventDayTask.findFirst.mockResolvedValue({
      id: 'task_legacy_role',
      eventId: 'evt_sample_ayala',
      assignedRole: 'General Coordinator',
      ownerName: 'Marco Santos',
      status: 'open',
    } as never);

    await service.updateEventDayTask(
      'evt_sample_ayala',
      'task_legacy_role',
      { status: 'in_progress' },
      coordinatorActor(),
    );

    expect(liveOperationsService.updateEventDayTask).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'task_legacy_role',
      { status: 'in_progress' },
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
    );
  });

  it('keeps another coordinator out of an unmapped-role fallback task queue', async () => {
    const { service, liveOperationsService, prisma } = createService(
      coordinatorAssignmentRow({ role: 'Volunteer Lead' }),
    );
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsEventDayTask.findFirst.mockResolvedValue({
      id: 'task_legacy_other',
      eventId: 'evt_sample_ayala',
      assignedRole: 'General Coordinator',
      ownerName: 'Taylor Cruz',
      status: 'open',
    } as never);

    await expect(
      service.updateEventDayTask(
        'evt_sample_ayala',
        'task_legacy_other',
        { status: 'in_progress' },
        coordinatorActor(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.updateEventDayTask).not.toHaveBeenCalled();
  });

  it('assigns coordinator-created urgent issues to the creator role and queue by default', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);

    await service.createUrgentIssue('evt_sample_ayala', { title: 'Power interruption' }, coordinatorActor());

    expect(liveOperationsService.createUrgentIssue).toHaveBeenCalledWith(
      'evt_sample_ayala',
      expect.objectContaining({ ownerRole: 'Registration Staff', ownerName: 'Marco Santos' }),
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
    );
  });

  it('keeps a legacy coordinator role readable without writing it as a new issue queue', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow({ role: 'Volunteer Lead' }));
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);

    await service.createUrgentIssue('evt_sample_ayala', { title: 'Power interruption' }, coordinatorActor());

    const input = (liveOperationsService.createUrgentIssue as unknown as ReturnType<typeof vi.fn>).mock.calls[0][1] as Record<string, unknown>;
    expect(input.ownerName).toBe('Marco Santos');
    expect(input).not.toHaveProperty('ownerRole');
  });

  it('does not let a coordinator create an urgent issue in another role queue', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);

    await expect(
      service.createUrgentIssue(
        'evt_sample_ayala',
        { title: 'Finance issue', ownerRole: 'Finance', ownerName: 'Finance Lead' },
        coordinatorActor(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.createUrgentIssue).not.toHaveBeenCalled();
  });

  it.each(['update', 'escalate'] as const)('blocks coordinators from %s issues owned by another role', async (operation) => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsUrgentIssue.findFirst.mockResolvedValue(urgentIssueRow({ ownerRole: 'Finance', ownerName: 'Finance Lead' }) as never);
    const action = operation === 'update'
      ? service.updateUrgentIssue('evt_sample_ayala', 'issue_1', { status: 'resolved' }, coordinatorActor())
      : service.escalateUrgentIssue('evt_sample_ayala', 'issue_1', { notes: 'Escalate this' }, coordinatorActor());

    await expect(action).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.updateUrgentIssue).not.toHaveBeenCalled();
    expect(liveOperationsService.escalateUrgentIssue).not.toHaveBeenCalled();
  });

  it('does not let a coordinator reassign an urgent issue through update or escalation fields', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsUrgentIssue.findFirst.mockResolvedValue(urgentIssueRow() as never);

    await expect(
      service.updateUrgentIssue('evt_sample_ayala', 'issue_1', { ownerRole: 'Finance', ownerName: 'Finance Lead' }, coordinatorActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.escalateUrgentIssue('evt_sample_ayala', 'issue_1', { ownerRole: 'Finance', ownerName: 'Finance Lead' }, coordinatorActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(liveOperationsService.updateUrgentIssue).not.toHaveBeenCalled();
    expect(liveOperationsService.escalateUrgentIssue).not.toHaveBeenCalled();
  });

  it('allows the designated operator to reassign an urgent issue', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);
    prisma.opsEventOperatorDesignation.findFirst.mockResolvedValue({ id: 'operator_designation_1' } as never);
    prisma.opsUrgentIssue.findFirst.mockResolvedValue(urgentIssueRow() as never);

    await service.updateUrgentIssue(
      'evt_sample_ayala',
      'issue_1',
      { ownerRole: 'Finance', ownerName: 'Finance Lead' },
      coordinatorActor(),
    );

    expect(liveOperationsService.updateUrgentIssue).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'issue_1',
      { ownerRole: 'Finance', ownerName: 'Finance Lead' },
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
    );
  });
});

describe('EventLiveOpsCommandService coordinator attendance self-scope', () => {
  it('rejects a coordinator marking a different assignment on the same event', async () => {
    const { service, coordinatorCommandService, eventAccessPolicyService, staffingReader } = createService(
      coordinatorAssignmentRow(),
    );

    await expect(
      service.updateCoordinatorAttendance(
        'evt_sample_ayala',
        'coord_asg_ayala_rhea',
        { status: 'absent' },
        coordinatorActor(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(staffingReader.findAssignmentForEventActor).toHaveBeenCalledWith(
      'evt_sample_ayala',
      expect.objectContaining({ coordinatorId: 'coord_marco', email: 'marco@pmcm.test' }),
    );
    expect(coordinatorCommandService.updateCoordinatorAttendance).not.toHaveBeenCalled();
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
      'coordinator attendance',
      'evt_sample_ayala',
    );
  });

  it('allows a coordinator marking their own assignment', async () => {
    const { service, coordinatorCommandService } = createService(coordinatorAssignmentRow());
    const input = { status: 'present' };
    const actor = coordinatorActor();

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_marco', input, actor);

    expect(coordinatorCommandService.updateCoordinatorAttendance).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'coord_asg_ayala_marco',
      input,
      actor,
    );
  });

  // This test does NOT on its own prove the guard is role-gated rather than null-gated.
  // createService(null) makes the gate return assignment: null, and a null-gated guard
  // (`actorAssignment && actorAssignment.id !== assignmentId`) would skip the comparison
  // too, so it would pass this test as well. The observable contract is pinned by this
  // test and the rejection test TOGETHER. Role-gating is chosen because it does not
  // depend on the gate continuing to return null for non-Coordinators — not because a
  // unit test distinguishes the two.
  it('allows a PmcmAdmin to mark any coordinator assignment', async () => {
    const { service, coordinatorCommandService } = createService(null);
    const input = { status: 'absent' };
    const actor = pmcmAdminActor();

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_rhea', input, actor);

    expect(coordinatorCommandService.updateCoordinatorAttendance).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'coord_asg_ayala_rhea',
      input,
      actor,
    );
  });

  it('allows the designated Event Day System Operator to mark another assignment', async () => {
    const { service, coordinatorCommandService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEventOperatorDesignation.findFirst.mockResolvedValue({
      id: 'op_designation',
      eventId: 'evt_sample_ayala',
      coordinatorId: 'coord_marco',
      revokedAt: null,
    } as never);
    const input = { status: 'present', notes: 'Checked in at command desk' };

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_rhea', input, coordinatorActor());

    expect(coordinatorCommandService.updateCoordinatorAttendance).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'coord_asg_ayala_rhea',
      input,
      expect.objectContaining({ coordinatorId: 'coord_marco' }),
    );
  });

  it('rejects supplier verification from a non-ingress coordinator', async () => {
    const { service, eventAccessPolicyService, staffingReader, prisma } = createService(
      coordinatorAssignmentRow({ role: 'Floor Director' }),
    );
    prisma.opsEvent.findUnique.mockResolvedValue({ id: 'evt_sample_ayala' } as never);

    await expect(
      service.verifySupplierEventStatus('evt_sample_ayala', 'supplier_req_1', { verificationStatus: 'verified' }, coordinatorActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(staffingReader.findAssignmentForEventActor).toHaveBeenCalled();
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
      'supplier setup verification',
      'evt_sample_ayala',
    );
  });
});
