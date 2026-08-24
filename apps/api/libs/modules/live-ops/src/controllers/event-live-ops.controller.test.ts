import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/modules/event-session';
import type { EventAccessPolicyService } from '@prism/modules/access-control';
import type { PrismVerifiedEventActor } from '@prism/types';
import type { EventLiveOpsCommandService } from '../services/event-live-ops-command.service';
import type { EventLiveOpsReadService } from '../services/event-live-ops-read.service';
import { EventLiveOpsController } from './event-live-ops.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function verifiedActor(): PrismVerifiedEventActor {
  return {
    id: 'admin_session',
    actorId: 'admin_session',
    role: 'pmcm-admin',
    actorRole: 'pmcm-admin',
    email: 'admin@pmcm.test',
    actorEmail: 'admin@pmcm.test',
    name: 'Verified Admin',
    actorName: 'Verified Admin',
    expiresAt: '2026-08-25T00:00:00.000Z',
  };
}

const liveOpsRouteNames = [
  'liveOps',
  'statusFeed',
  'createEventDayTask',
  'updateEventDayTask',
  'escalateEventDayTask',
  'createUrgentIssue',
  'updateUrgentIssue',
  'escalateUrgentIssue',
  'updateCoordinatorAttendance',
  'replaceCoordinatorAssignment',
  'verifySupplierStatus',
] as const;

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
  const resolvedActor = { id: 'admin_session', role: 'pmcm-admin', name: 'Verified Admin', email: 'admin@pmcm.test', explicit: true };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => resolvedActor),
  };
  const controller = new EventLiveOpsController(
    readService as unknown as EventLiveOpsReadService,
    commandService as unknown as EventLiveOpsCommandService,
    eventAccessPolicyService as unknown as EventAccessPolicyService,
  );
  return { controller, readService, commandService, eventAccessPolicyService, resolvedActor };
}

describe('EventLiveOpsController', () => {
  it('keeps event live-ops routes under the events route base', () => {
    expect(controllerPath(EventLiveOpsController)).toBe('events');
  });

  it.each(liveOpsRouteNames)('requires a verified session actor for %s', (methodName) => {
    const guards = Reflect.getMetadata('__guards__', EventLiveOpsController.prototype[methodName]);
    expect(guards).toBeDefined();
    expect(guards).toContain(EventSessionGuard);
  });

  it('delegates event-day read and command routes with stable parameters', async () => {
    const { controller, readService, commandService, eventAccessPolicyService, resolvedActor } = createController();
    const spoofedActor = { actorRole: 'pmcm-admin', actorName: 'Spoofed Admin' };
    const sessionActor = verifiedActor();

    await controller.liveOps('evt_sample', spoofedActor, sessionActor);
    await controller.statusFeed('evt_sample', spoofedActor, sessionActor);
    await controller.createEventDayTask('evt_sample', { title: 'Open registration' }, spoofedActor, sessionActor);
    await controller.updateEventDayTask('evt_sample', 'task_sample', { status: 'done' }, spoofedActor, sessionActor);
    await controller.escalateEventDayTask('evt_sample', 'task_sample', { notes: 'Need backup' }, spoofedActor, sessionActor);
    await controller.createUrgentIssue('evt_sample', { title: 'Power issue' }, spoofedActor, sessionActor);
    await controller.updateUrgentIssue('evt_sample', 'issue_sample', { status: 'resolved' }, spoofedActor, sessionActor);
    await controller.escalateUrgentIssue('evt_sample', 'issue_sample', { ownerRole: 'Floor Director' }, spoofedActor, sessionActor);
    await controller.updateCoordinatorAttendance('evt_sample', 'coord_asg_sample', { status: 'present' }, spoofedActor, sessionActor);
    await controller.replaceCoordinatorAssignment(
      'evt_sample',
      'coord_asg_sample',
      { replacementCoordinatorId: 'coord_backup', role: 'Usher', reason: 'Sick leave' },
      spoofedActor,
      sessionActor,
    );
    await controller.verifySupplierStatus('evt_sample', 'qr_sample', { verificationStatus: 'verified' }, spoofedActor, sessionActor);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledTimes(11);
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, sessionActor);
    expect(readService.getEventLiveOps).toHaveBeenCalledWith('evt_sample', resolvedActor);
    expect(readService.getEventDayStatusFeed).toHaveBeenCalledWith('evt_sample', resolvedActor);
    expect(commandService.createEventDayTask).toHaveBeenCalledWith('evt_sample', { title: 'Open registration' }, resolvedActor);
    expect(commandService.updateEventDayTask).toHaveBeenCalledWith('evt_sample', 'task_sample', { status: 'done' }, resolvedActor);
    expect(commandService.escalateEventDayTask).toHaveBeenCalledWith('evt_sample', 'task_sample', { notes: 'Need backup' }, resolvedActor);
    expect(commandService.createUrgentIssue).toHaveBeenCalledWith('evt_sample', { title: 'Power issue' }, resolvedActor);
    expect(commandService.updateUrgentIssue).toHaveBeenCalledWith('evt_sample', 'issue_sample', { status: 'resolved' }, resolvedActor);
    expect(commandService.escalateUrgentIssue).toHaveBeenCalledWith('evt_sample', 'issue_sample', { ownerRole: 'Floor Director' }, resolvedActor);
    expect(commandService.updateCoordinatorAttendance).toHaveBeenCalledWith('evt_sample', 'coord_asg_sample', { status: 'present' }, resolvedActor);
    expect(commandService.replaceCoordinatorAssignment).toHaveBeenCalledWith(
      'evt_sample',
      'coord_asg_sample',
      { replacementCoordinatorId: 'coord_backup', role: 'Usher', reason: 'Sick leave' },
      resolvedActor,
    );
    expect(commandService.verifySupplierEventStatus).toHaveBeenCalledWith('evt_sample', 'qr_sample', { verificationStatus: 'verified' }, resolvedActor);
  });
});
