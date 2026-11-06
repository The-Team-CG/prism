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
    const eventAccessPolicyService = { resolveActor: vi.fn(() => ({ role: 'coordinator', name: 'Marco' })) };
    const controller = new CoordinatorLiveOpsController(readService as any, eventAccessPolicyService as any);
    const actor = { id: 'user_coord', actorId: 'user_coord', role: 'coordinator', actorRole: 'coordinator', email: 'marco@pmcm.test', actorEmail: 'marco@pmcm.test', name: 'Marco', actorName: 'Marco', expiresAt: '2026-07-03T12:00:00.000Z' };

    await controller.roleView('evt_sample', actor as any);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, actor);
    expect(readService.getCoordinatorRoleView).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ role: 'coordinator', name: 'Marco' }),
    );
  });

  it('delegates the coordinator event schedule with the resolved actor and event id', async () => {
    const schedule = { eventId: 'evt_sample', eventStatus: 'planned', schedule: { eventId: 'evt_sample', authored: true, days: [], serverTime: '2026-07-03T09:00:00.000Z' } };
    const readService = { getCoordinatorEventSchedule: vi.fn(async () => schedule) };
    const eventAccessPolicyService = { resolveActor: vi.fn(() => ({ role: 'coordinator', name: 'Marco' })) };
    const controller = new CoordinatorLiveOpsController(readService as any, eventAccessPolicyService as any);
    const verifiedActor = { id: 'user_coord', role: 'coordinator', name: 'Marco', expiresAt: '2026-07-03T12:00:00.000Z' };

    await expect(controller.eventSchedule('evt_sample', verifiedActor as any)).resolves.toBe(schedule);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(readService.getCoordinatorEventSchedule).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ role: 'coordinator', name: 'Marco' }),
    );
  });
});
