import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsEventReadsController } from './events.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const eventReadModelsService = {
    eventList: vi.fn(async () => ({
      items: [{ id: 'evt_sample' }],
      pagination: { nextCursor: null, hasMore: false, totalCount: 1 },
    })),
    eventDetail: vi.fn(async () => ({ id: 'evt_sample' })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((_input: any, verified: any) => ({ role: verified.actorRole, name: verified.actorName })),
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
    const listActor = {
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
    const detailActor = { ...listActor, name: 'pmcm-admin', actorName: 'pmcm-admin' };

    await expect(controller.list(listActor as any)).resolves.toEqual({
      items: [
      { id: 'evt_sample' },
    ],
      pagination: { nextCursor: null, hasMore: false, totalCount: 1 },
    });
    await expect(controller.detail('evt_sample', detailActor as any)).resolves.toEqual({ id: 'evt_sample' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, listActor);
    expect(eventReadModelsService.eventList).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      expect.objectContaining({ mapEvent: expect.any(Function) }),
      undefined,
    );
    expect(eventReadModelsService.eventDetail).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'pmcm-admin' },
      'evt_sample',
      expect.objectContaining({ mapEvent: expect.any(Function) }),
    );
  });
});