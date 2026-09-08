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

function createService(assignment: unknown) {
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_sample_unassigned' })),
    },
    opsEventOperatorDesignation: {
      findFirst: vi.fn(async () => null),
    },
    opsEventDayTask: {
      findFirst: vi.fn(async () => null),
    },
  };
  const eventAccessPolicyService = {
    requireActorRole: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const liveOperationsService = {
    createEventDayTask: vi.fn(),
    updateCoordinatorAttendance: vi.fn(async () => coordinatorAssignmentRow()),
    computeSlaStatus: vi.fn(() => 'on_track'),
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
    staffingReader as never,
    supplierCommands as never,
  );
  return { service, liveOperationsService, eventAccessPolicyService, staffingReader, prisma };
}

describe('EventLiveOpsCommandService event scoping', () => {
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

  it('allows coordinator writes when an assignment exists for the event', async () => {
    const { service, liveOperationsService, prisma } = createService({
      id: 'coord_asg_ayala_marco',
      eventId: 'evt_sample_ayala',
      coordinatorId: 'coord_marco',
    });

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

    await service.createEventDayTask('evt_sample_ayala', { title: 'Open registration' }, coordinatorActor());
    expect(liveOperationsService.createEventDayTask).toHaveBeenCalledTimes(1);
  });
});

describe('EventLiveOpsCommandService coordinator attendance self-scope', () => {
  it('rejects a coordinator marking a different assignment on the same event', async () => {
    const { service, liveOperationsService, eventAccessPolicyService, staffingReader } = createService(
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
    expect(liveOperationsService.updateCoordinatorAttendance).not.toHaveBeenCalled();
    expect(eventAccessPolicyService.recordForbiddenAccess).toHaveBeenCalledWith(
      expect.objectContaining({ role: OpsUserRole.Coordinator }),
      'coordinator attendance',
      'evt_sample_ayala',
    );
  });

  it('allows a coordinator marking their own assignment', async () => {
    const { service, liveOperationsService } = createService(coordinatorAssignmentRow());
    const input = { status: 'present' };
    const actor = coordinatorActor();

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_marco', input, actor);

    expect(liveOperationsService.updateCoordinatorAttendance).toHaveBeenCalledWith(
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
    const { service, liveOperationsService } = createService(null);
    const input = { status: 'absent' };
    const actor = pmcmAdminActor();

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_rhea', input, actor);

    expect(liveOperationsService.updateCoordinatorAttendance).toHaveBeenCalledWith(
      'evt_sample_ayala',
      'coord_asg_ayala_rhea',
      input,
      actor,
    );
  });

  it('allows the designated Event Day System Operator to mark another assignment', async () => {
    const { service, liveOperationsService, prisma } = createService(coordinatorAssignmentRow());
    prisma.opsEventOperatorDesignation.findFirst.mockResolvedValue({
      id: 'op_designation',
      eventId: 'evt_sample_ayala',
      coordinatorId: 'coord_marco',
      revokedAt: null,
    } as never);
    const input = { status: 'present', notes: 'Checked in at command desk' };

    await service.updateCoordinatorAttendance('evt_sample_ayala', 'coord_asg_ayala_rhea', input, coordinatorActor());

    expect(liveOperationsService.updateCoordinatorAttendance).toHaveBeenCalledWith(
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
