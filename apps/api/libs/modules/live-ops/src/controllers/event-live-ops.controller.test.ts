import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventLiveOpsController } from './event-live-ops.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const readService = {
    getEventLiveOps: vi.fn(async () => ({ id: 'live_ops' })),
    getEventDayStatusFeed: vi.fn(async () => ({ id: 'status_feed' })),
  };
  const commandService = {
    createEventDayTask: vi.fn(async () => ({ id: 'task_created' })),
    updateEventDayTask: vi.fn(async () => ({ id: 'task_updated' })),
    escalateEventDayTask: vi.fn(async () => ({ id: 'task_escalated' })),
    createUrgentIssue: vi.fn(async () => ({ id: 'issue_created' })),
    updateUrgentIssue: vi.fn(async () => ({ id: 'issue_updated' })),
    escalateUrgentIssue: vi.fn(async () => ({ id: 'issue_escalated' })),
    updateCoordinatorAttendance: vi.fn(async () => ({ id: 'coord_status' })),
    replaceCoordinatorAssignment: vi.fn(async () => ({ id: 'coord_replace' })),
    verifySupplierEventStatus: vi.fn(async () => ({ id: 'supplier_verified' })),
  };
  return { controller: new EventLiveOpsController(readService as any, commandService as any), readService, commandService };
}

describe('EventLiveOpsController', () => {
  it('keeps event live-ops routes under the events route base', () => {
    expect(controllerPath(EventLiveOpsController)).toBe('events');
  });

  it('delegates event-day read and command routes with stable parameters', async () => {
    const { controller, readService, commandService } = createController();
    const actor = { actorRole: 'pmcm-admin' };

    await controller.liveOps('evt_sample', actor);
    await controller.statusFeed('evt_sample', actor);
    await controller.createEventDayTask('evt_sample', { title: 'Open registration' }, actor);
    await controller.updateEventDayTask('evt_sample', 'task_sample', { status: 'done' }, actor);
    await controller.escalateEventDayTask('evt_sample', 'task_sample', { notes: 'Need backup' }, actor);
    await controller.createUrgentIssue('evt_sample', { title: 'Power issue' }, actor);
    await controller.updateUrgentIssue('evt_sample', 'issue_sample', { status: 'resolved' }, actor);
    await controller.escalateUrgentIssue('evt_sample', 'issue_sample', { ownerRole: 'Floor Director' }, actor);
    await controller.updateCoordinatorAttendance('evt_sample', 'coord_asg_sample', { status: 'present' }, actor);
    await controller.replaceCoordinatorAssignment(
      'evt_sample',
      'coord_asg_sample',
      { replacementCoordinatorId: 'coord_backup', role: 'Usher', reason: 'Sick leave' },
      actor,
    );
    await controller.verifySupplierStatus('evt_sample', 'qr_sample', { verificationStatus: 'verified' }, actor);

    expect(readService.getEventLiveOps).toHaveBeenCalledWith('evt_sample', actor);
    expect(readService.getEventDayStatusFeed).toHaveBeenCalledWith('evt_sample', actor);
    expect(commandService.createEventDayTask).toHaveBeenCalledWith('evt_sample', { title: 'Open registration' }, actor);
    expect(commandService.updateEventDayTask).toHaveBeenCalledWith('evt_sample', 'task_sample', { status: 'done' }, actor);
    expect(commandService.escalateEventDayTask).toHaveBeenCalledWith('evt_sample', 'task_sample', { notes: 'Need backup' }, actor);
    expect(commandService.createUrgentIssue).toHaveBeenCalledWith('evt_sample', { title: 'Power issue' }, actor);
    expect(commandService.updateUrgentIssue).toHaveBeenCalledWith('evt_sample', 'issue_sample', { status: 'resolved' }, actor);
    expect(commandService.escalateUrgentIssue).toHaveBeenCalledWith('evt_sample', 'issue_sample', { ownerRole: 'Floor Director' }, actor);
    expect(commandService.updateCoordinatorAttendance).toHaveBeenCalledWith('evt_sample', 'coord_asg_sample', { status: 'present' }, actor);
    expect(commandService.replaceCoordinatorAssignment).toHaveBeenCalledWith(
      'evt_sample',
      'coord_asg_sample',
      { replacementCoordinatorId: 'coord_backup', role: 'Usher', reason: 'Sick leave' },
      actor,
    );
    expect(commandService.verifySupplierEventStatus).toHaveBeenCalledWith('evt_sample', 'qr_sample', { verificationStatus: 'verified' }, actor);
  });
});