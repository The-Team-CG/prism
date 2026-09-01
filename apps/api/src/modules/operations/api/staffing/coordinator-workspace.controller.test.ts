import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsCoordinatorWorkspaceController } from './coordinator-workspace.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsCoordinatorWorkspaceController', () => {
  it('keeps the public coordinator route base stable under staffing ownership', () => {
    expect(controllerPath(OpsCoordinatorWorkspaceController)).toBe('coordinator');
  });

  it('serves coordinator workspace reads through staffing read service', async () => {
    const actor = { role: 'coordinator', name: 'Marco', coordinatorId: 'coord_marco' };
    const coordinatorWorkspaceReadService = {
      listCoordinatorWorkspace: vi.fn(async () => ({ coordinator: { id: 'coord_marco' }, events: [] })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input: any, _verified: any) => actor),
    };
    const controller = new OpsCoordinatorWorkspaceController(
      coordinatorWorkspaceReadService as any,
      eventAccessPolicyService as any,
    );

    await expect(controller.getCoordinatorWorkspace({ id: 'user_coord', actorId: 'user_coord', role: 'coordinator', actorRole: 'coordinator', email: 'marco@pmcm.test', actorEmail: 'marco@pmcm.test', name: 'Marco', actorName: 'Marco', expiresAt: '2026-07-03T12:00:00.000Z' } as any)).resolves.toEqual({
      coordinator: { id: 'coord_marco' },
      events: [],
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, expect.objectContaining({ actorRole: 'coordinator', actorName: 'Marco' }));
    expect(coordinatorWorkspaceReadService.listCoordinatorWorkspace).toHaveBeenCalledWith(actor);
  });
});
