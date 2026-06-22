import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsCoordinatorsController } from './coordinators.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsCoordinatorsController', () => {
  it('keeps the public coordinators route base stable under staffing ownership', () => {
    expect(controllerPath(OpsCoordinatorsController)).toBe('coordinators');
  });

  it('serves the coordinator directory through CoordinatorsService with role policy', async () => {
    const coordinators = [{ id: 'coord_1', name: 'Marco' }];
    const coordinatorsService = {
      listCoordinators: vi.fn(async () => coordinators),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsCoordinatorsController(coordinatorsService as any, eventAccessPolicyService as any);

    await expect(controller.list({ actorRole: OpsUserRole.Coordinator, actorName: 'Marco' })).resolves.toBe(coordinators);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({
      actorRole: OpsUserRole.Coordinator,
      actorName: 'Marco',
    });
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.Coordinator, name: 'Marco' },
      [OpsUserRole.PmcmAdmin, OpsUserRole.System, OpsUserRole.Coordinator],
      'coordinator directory',
    );
    expect(coordinatorsService.listCoordinators).toHaveBeenCalledTimes(1);
  });
});
