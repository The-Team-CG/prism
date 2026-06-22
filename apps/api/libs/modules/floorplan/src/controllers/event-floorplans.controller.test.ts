import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsEventFloorplansController } from './event-floorplans.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const floorPlanWorkflowService = {
    createFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new' })),
    createFloorPlanPreference: vi.fn(async () => ({ id: 'fpd_pref' })),
    submitFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'submitted' })),
    approveFloorPlanDraft: vi.fn(async () => ({ id: 'fpd_new', status: 'approved' })),
    getFloorPlanSnapshot: vi.fn(async () => ({ objects: [] })),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input = {}) => ({ role: input.actorRole ?? OpsUserRole.PmcmAdmin, name: input.actorName ?? 'Maxine' })),
    requireCanMutateOfficialFloorplan: vi.fn(async () => undefined),
    requireActorRole: vi.fn(async () => undefined),
    canReadEvent: vi.fn(() => true),
    recordForbiddenAccess: vi.fn(async () => undefined),
  };
  const prisma = {
    opsEvent: {
      findUniqueOrThrow: vi.fn(async () => ({ id: 'evt_sample', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked' })),
    },
  };
  const controller = new OpsEventFloorplansController(
    floorPlanWorkflowService as any,
    eventAccessPolicyService as any,
    prisma as any,
  );
  return { controller, floorPlanWorkflowService, eventAccessPolicyService, prisma };
}

describe('OpsEventFloorplansController', () => {
  it('keeps event floorplan routes under the events route base', () => {
    expect(controllerPath(OpsEventFloorplansController)).toBe('events');
  });

  it('serves official floorplan commands through FloorPlanWorkflowService with route policy', async () => {
    const { controller, floorPlanWorkflowService, eventAccessPolicyService } = createController();
    const actor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine' };

    await expect(controller.createFloorPlanDraft('evt_sample', { name: 'Official', sourceType: 'blank' }, actor)).resolves.toEqual({ id: 'fpd_new' });
    await expect(controller.submitFloorPlanDraft('evt_sample', 'fpd_new', actor)).resolves.toEqual({ id: 'fpd_new', status: 'submitted' });
    await expect(controller.approveFloorPlanDraft('evt_sample', 'fpd_new', actor)).resolves.toEqual({ id: 'fpd_new', status: 'approved' });

    expect(eventAccessPolicyService.requireCanMutateOfficialFloorplan).toHaveBeenCalledTimes(3);
    expect(floorPlanWorkflowService.createFloorPlanDraft).toHaveBeenCalledWith('evt_sample', { name: 'Official', sourceType: 'blank' }, { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
    expect(floorPlanWorkflowService.submitFloorPlanDraft).toHaveBeenCalledWith('evt_sample', 'fpd_new', { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
    expect(floorPlanWorkflowService.approveFloorPlanDraft).toHaveBeenCalledWith('evt_sample', 'fpd_new', { name: 'Maxine', role: OpsUserRole.PmcmAdmin });
  });

  it('serves client preferences and snapshots through floorplan ownership', async () => {
    const { controller, floorPlanWorkflowService, eventAccessPolicyService, prisma } = createController();
    const actor = { actorRole: OpsUserRole.Client, actorName: 'Ana Reyes', clientName: 'Ana Reyes' };

    await expect(
      controller.createFloorPlanPreference(
        'evt_sample',
        { name: 'Client Preference', seatingStyle: 'banquet', stagePreference: 'front', flowNotes: 'Wide aisle', guestCount: 120, constraints: [] },
        actor,
      ),
    ).resolves.toEqual({ id: 'fpd_pref' });
    await expect(controller.getFloorPlanSnapshot('evt_sample', 'fpd_pref', { ...actor, type: 'submitted' })).resolves.toEqual({ objects: [] });

    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: OpsUserRole.Client, name: 'Ana Reyes' },
      [OpsUserRole.Client, OpsUserRole.PmcmAdmin, OpsUserRole.System],
      'client floorplan preference',
      'evt_sample',
    );
    expect(prisma.opsEvent.findUniqueOrThrow).toHaveBeenCalledWith({ where: { id: 'evt_sample' } });
    expect(floorPlanWorkflowService.createFloorPlanPreference).toHaveBeenCalledWith(
      'evt_sample',
      expect.objectContaining({ name: 'Client Preference' }),
      { name: 'Ana Reyes', role: OpsUserRole.Client },
    );
    expect(floorPlanWorkflowService.getFloorPlanSnapshot).toHaveBeenCalledWith('evt_sample', 'fpd_pref', 'submitted');
  });
});