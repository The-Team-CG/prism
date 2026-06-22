import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventCoordinatorAssignmentsController } from './event-coordinator-assignments.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsEventCoordinatorAssignmentsController', () => {
  it('keeps event coordinator assignment routes under the events route base', () => {
    expect(controllerPath(OpsEventCoordinatorAssignmentsController)).toBe('events');
  });

  it('serves coordinator assignment commands through StaffingOps without changing route payloads', async () => {
    const coordinatorsService = {
      assignCoordinator: vi.fn(async () => ({ id: 'coord_asg_new', status: 'pending_acknowledgement' })),
      acknowledgeCoordinator: vi.fn(async () => ({ id: 'coord_asg_new', status: 'acknowledged' })),
    };
    const controller = new OpsEventCoordinatorAssignmentsController(coordinatorsService as any);

    await expect(
      controller.assignCoordinator('evt_sample', {
        coordinatorId: 'coord_marco',
        role: 'Floor Director',
        overrideConflict: true,
      }),
    ).resolves.toEqual({ id: 'coord_asg_new', status: 'pending_acknowledgement' });
    await expect(controller.acknowledgeCoordinator('evt_sample', 'coord_asg_new')).resolves.toEqual({
      id: 'coord_asg_new',
      status: 'acknowledged',
    });

    expect(coordinatorsService.assignCoordinator).toHaveBeenCalledWith('evt_sample', {
      coordinatorId: 'coord_marco',
      role: 'Floor Director',
      overrideConflict: true,
    });
    expect(coordinatorsService.acknowledgeCoordinator).toHaveBeenCalledWith('evt_sample', 'coord_asg_new');
  });
});