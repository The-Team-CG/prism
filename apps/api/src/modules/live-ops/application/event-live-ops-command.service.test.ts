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

function createService(assignment: unknown) {
  const prisma = {
    opsEvent: {
      findUnique: vi.fn(async () => ({ id: 'evt_sample_unassigned' })),
    },
  };
  const eventAccessPolicyService = {
    requireActorRole: vi.fn(async () => undefined),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const liveOperationsService = {
    createEventDayTask: vi.fn(),
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
