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
    resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
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

    await expect(controller.defenseReadiness('evt_sample', { actorRole: 'pmcm-admin', actorName: 'Maxine' })).resolves.toEqual({
      eventId: 'evt_sample',
      overallStatus: 'attention',
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({
      actorRole: 'pmcm-admin',
      actorName: 'Maxine',
    });
    expect(eventReadModelsService.defenseReadiness).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      'evt_sample',
    );
  });
});