import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventCoordinatorAssignmentsController } from './event-coordinator-assignments.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

const verifiedActor = { actorId: 'admin_1', actorRole: 'pmcm-admin', actorName: 'PMCM Admin', actorEmail: 'admin@pmcm.test' };
const resolvedActor = { id: 'admin_1', role: 'pmcm-admin', name: 'PMCM Admin' };

function createControllerDeps() {
  const coordinatorsService = {
    assignCoordinator: vi.fn(async () => ({ id: 'coord_asg_new', status: 'pending_acknowledgement' })),
    acknowledgeCoordinator: vi.fn(async () => ({ id: 'coord_asg_new', status: 'acknowledged' })),
    withdrawCoordinator: vi.fn(async () => ({ id: 'coord_asg_new', status: 'cancelled' })),
    replaceCoordinator: vi.fn(async () => ({
      outgoing: { id: 'coord_asg_new', status: 'replaced' },
      incoming: { id: 'coord_asg_replacement', status: 'pending_acknowledgement' },
    })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => resolvedActor),
  };
  const controller = new OpsEventCoordinatorAssignmentsController(coordinatorsService as any, eventAccessPolicyService as any);
  return { controller, coordinatorsService, eventAccessPolicyService };
}

describe('OpsEventCoordinatorAssignmentsController', () => {
  it('keeps event coordinator assignment routes under the events route base', () => {
    expect(controllerPath(OpsEventCoordinatorAssignmentsController)).toBe('events');
  });

  it('serves coordinator assignment commands through StaffingOps without changing route payloads', async () => {
    const { controller, coordinatorsService, eventAccessPolicyService } = createControllerDeps();

    await expect(
      controller.assignCoordinator(
        'evt_sample',
        { coordinatorId: 'coord_marco', role: 'Floor Director', overrideConflict: true },
        verifiedActor as any,
      ),
    ).resolves.toEqual({ id: 'coord_asg_new', status: 'pending_acknowledgement' });
    await expect(
      controller.acknowledgeCoordinator('evt_sample', 'coord_asg_new', verifiedActor as any),
    ).resolves.toEqual({
      id: 'coord_asg_new',
      status: 'acknowledged',
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(coordinatorsService.assignCoordinator).toHaveBeenCalledWith(
      'evt_sample',
      { coordinatorId: 'coord_marco', role: 'Floor Director', overrideConflict: true },
      resolvedActor,
    );
    expect(coordinatorsService.acknowledgeCoordinator).toHaveBeenCalledWith('evt_sample', 'coord_asg_new', resolvedActor);
  });

  it('delegates withdrawCoordinator with the resolved actor', async () => {
    const { controller, coordinatorsService } = createControllerDeps();

    await expect(
      controller.withdrawCoordinator('evt_sample', 'coord_asg_new', { reason: 'No longer available' }, verifiedActor as any),
    ).resolves.toEqual({ id: 'coord_asg_new', status: 'cancelled' });

    expect(coordinatorsService.withdrawCoordinator).toHaveBeenCalledWith(
      'evt_sample',
      'coord_asg_new',
      { reason: 'No longer available' },
      resolvedActor,
    );
  });

  it('delegates replaceCoordinator with the resolved actor', async () => {
    const { controller, coordinatorsService } = createControllerDeps();
    const dto = { replacementCoordinatorId: 'coord_new', replacementRole: 'Floor Director', reason: 'Scheduling conflict' };

    await expect(
      controller.replaceCoordinator('evt_sample', 'coord_asg_new', dto, verifiedActor as any),
    ).resolves.toEqual({
      outgoing: { id: 'coord_asg_new', status: 'replaced' },
      incoming: { id: 'coord_asg_replacement', status: 'pending_acknowledgement' },
    });

    expect(coordinatorsService.replaceCoordinator).toHaveBeenCalledWith('evt_sample', 'coord_asg_new', dto, resolvedActor);
  });
});
