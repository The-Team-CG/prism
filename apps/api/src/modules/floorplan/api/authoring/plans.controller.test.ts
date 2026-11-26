import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { PlansController } from './plans.controller';

const verifiedPmcmActor = {
  id: 'user_pmcm',
  actorId: 'user_pmcm',
  role: 'pmcm-admin',
  actorRole: 'pmcm-admin',
  email: 'mys@pmcm.test',
  actorEmail: 'mys@pmcm.test',
  name: 'Ms. Mys',
  actorName: 'Ms. Mys',
  expiresAt: '2026-07-03T12:00:00.000Z',
};

function createController() {
  const resolvedActor = { id: 'user_pmcm', role: 'pmcm-admin', email: 'mys@pmcm.test', name: 'Ms. Mys', explicit: true };
  const plansService = {
    getPlan: vi.fn(async () => ({ id: 'plan_1' })),
    updatePlan: vi.fn(async () => ({ id: 'plan_1', updated: true })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => resolvedActor),
  };

  return {
    controller: new PlansController(plansService as any, eventAccessPolicyService as any),
    plansService,
    eventAccessPolicyService,
    resolvedActor,
  };
}

describe('PlansController auth boundary', () => {
  it('uses the verified session actor for plan reads and updates', async () => {
    const { controller, plansService, eventAccessPolicyService, resolvedActor } = createController();

    await expect(controller.getOne('plan_1', verifiedPmcmActor as any)).resolves.toEqual({ id: 'plan_1' });
    await expect(
      controller.update('plan_1', { expectedUpdatedAt: '2026-05-05T00:00:00.000Z', width: 30 }, verifiedPmcmActor as any),
    ).resolves.toEqual({ id: 'plan_1', updated: true });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedPmcmActor);
    expect(plansService.getPlan).toHaveBeenCalledWith('plan_1', resolvedActor);
    expect(plansService.updatePlan).toHaveBeenCalledWith(
      'plan_1',
      { expectedUpdatedAt: '2026-05-05T00:00:00.000Z', width: 30 },
      resolvedActor,
    );
  });

});
