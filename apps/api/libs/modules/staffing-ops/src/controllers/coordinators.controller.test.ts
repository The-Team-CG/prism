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

  it('serves the coordinator directory through CoordinatorsService with PmcmAdmin-only role policy', async () => {
    const coordinators = [{ id: 'coord_1', name: 'Marco' }];
    const actor = { role: OpsUserRole.PmcmAdmin, name: 'Admin' };
    const coordinatorsService = {
      listCoordinators: vi.fn(async () => coordinators),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, _verified: any) => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsCoordinatorsController(coordinatorsService as any, eventAccessPolicyService as any);

    const verifiedActor = {
      id: 'user_admin',
      actorId: 'user_admin',
      role: OpsUserRole.PmcmAdmin,
      actorRole: OpsUserRole.PmcmAdmin,
      email: 'admin@pmcm.test',
      actorEmail: 'admin@pmcm.test',
      name: 'Admin',
      actorName: 'Admin',
      expiresAt: '2026-07-03T12:00:00.000Z',
    } as any;

    await expect(controller.list(verifiedActor)).resolves.toBe(coordinators);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      actor,
      [OpsUserRole.PmcmAdmin],
      'coordinator directory',
    );
    expect(coordinatorsService.listCoordinators).toHaveBeenCalledTimes(1);
  });
});
