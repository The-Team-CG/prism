import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventReadsController } from './events.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const eventReadModelsService = {
    eventList: vi.fn(async () => [{ id: 'evt_sample' }]),
    eventDetail: vi.fn(async () => ({ id: 'evt_sample' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
  };
  const floorPlanWorkflowService = { mapFloorPlanDraft: vi.fn((draft) => draft) };
  const guestWorkflowService = { guestAccessCode: vi.fn(() => 'EVENT-CODE') };
  const controller = new OpsEventReadsController(
    eventReadModelsService as any,
    eventAccessPolicyService as any,
    floorPlanWorkflowService as any,
    guestWorkflowService as any,
  );
  return { controller, eventReadModelsService, eventAccessPolicyService };
}

describe('OpsEventReadsController', () => {
  it('keeps event list/detail routes under the events route base', () => {
    expect(controllerPath(OpsEventReadsController)).toBe('events');
  });

  it('serves event list and detail reads through EventReadModelsService', async () => {
    const { controller, eventReadModelsService, eventAccessPolicyService } = createController();

    await expect(controller.list({ actorRole: 'pmcm-admin', actorName: 'Maxine' })).resolves.toEqual([
      { id: 'evt_sample' },
    ]);
    await expect(controller.detail('evt_sample', { actorRole: 'pmcm-admin' })).resolves.toEqual({ id: 'evt_sample' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({
      actorRole: 'pmcm-admin',
      actorName: 'Maxine',
    });
    expect(eventReadModelsService.eventList).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      expect.objectContaining({ mapEvent: expect.any(Function) }),
    );
    expect(eventReadModelsService.eventDetail).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'pmcm-admin' },
      'evt_sample',
      expect.objectContaining({ mapEvent: expect.any(Function) }),
    );
  });
});