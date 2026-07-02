import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { CoordinatorLiveOpsController } from './coordinator-live-ops.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('CoordinatorLiveOpsController', () => {
  it('keeps coordinator live-ops routes under the coordinator route base', () => {
    expect(controllerPath(CoordinatorLiveOpsController)).toBe('coordinator');
  });

  it('delegates coordinator role view with stable route parameters', async () => {
    const readService = { getCoordinatorRoleView: vi.fn(async () => ({ id: 'role_view' })) };
    const controller = new CoordinatorLiveOpsController(readService as any);
    const actor = { id: 'user_coord', actorId: 'user_coord', role: 'coordinator', actorRole: 'coordinator', email: 'marco@pmcm.test', actorEmail: 'marco@pmcm.test', name: 'Marco', actorName: 'Marco', expiresAt: '2026-07-03T12:00:00.000Z' };

    await controller.roleView('evt_sample', actor as any);

    expect(readService.getCoordinatorRoleView).toHaveBeenCalledWith('evt_sample', {}, actor);
  });
});