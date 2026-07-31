import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsDefenseReadinessController } from './defense-readiness.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const eventReadModelsService = {
    defenseReadiness: vi.fn(async () => ({ eventId: 'evt_sample', overallStatus: 'attention' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((_input: any, verified: any) => ({ role: verified.actorRole, name: verified.actorName })),
  };
  const controller = new OpsDefenseReadinessController(
    eventReadModelsService as any,
    eventAccessPolicyService as any,
  );
  return { controller, eventReadModelsService, eventAccessPolicyService };
}

describe('OpsDefenseReadinessController', () => {
  it('keeps defense readiness under the events route base', () => {
    expect(controllerPath(OpsDefenseReadinessController)).toBe('events');
  });

  it('delegates defense readiness to EventReadModelsService with a resolved actor', async () => {
    const { controller, eventReadModelsService, eventAccessPolicyService } = createController();
    const verifiedActor = {
      id: 'user_pmcm',
      actorId: 'user_pmcm',
      role: 'pmcm-admin',
      actorRole: 'pmcm-admin',
      email: 'mys@pmcm.test',
      actorEmail: 'mys@pmcm.test',
      name: 'Maxine',
      actorName: 'Maxine',
      expiresAt: '2026-07-03T12:00:00.000Z',
    };

    await expect(controller.defenseReadiness('evt_sample', verifiedActor as any)).resolves.toEqual({
      eventId: 'evt_sample',
      overallStatus: 'attention',
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(eventReadModelsService.defenseReadiness).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      'evt_sample',
    );
  });
});