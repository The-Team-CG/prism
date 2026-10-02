import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsPmcmDashboardController } from './pmcm-dashboard.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const eventReadModelsService = {
    pmcmDashboard: vi.fn(async () => ({ events: [] })),
    pmcmEventWorkspace: vi.fn(async () => ({ event: { id: 'evt_sample' } })),
    coordinatorReliabilityHistory: vi.fn(async () => [{ id: 'note_1' }]),
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((_input: any, verified: any) => ({ role: verified.actorRole, name: verified.actorName })),
  };
  const coordinatorsService = {
    mapCoordinator: vi.fn((coordinator) => coordinator),
    mapCoordinatorAssignment: vi.fn((assignment) => assignment),
  };
  const floorPlanWorkflowService = { mapFloorPlanDraft: vi.fn((draft) => draft) };
  const guestWorkflowService = { guestAccessCode: vi.fn(() => 'EVENT-CODE') };
  const registrationPlatformReader = { mapRegistrationPlatform: vi.fn((p) => p) };

  const controller = new OpsPmcmDashboardController(
    eventReadModelsService as any,
    eventAccessPolicyService as any,
    coordinatorsService as any,
    floorPlanWorkflowService as any,
    guestWorkflowService as any,
    registrationPlatformReader as any,
  );

  return { controller, eventReadModelsService, eventAccessPolicyService };
}

describe('OpsPmcmDashboardController', () => {
  it('keeps the public PMCM route base stable under event-read-models ownership', () => {
    expect(controllerPath(OpsPmcmDashboardController)).toBe('pmcm');
  });

  it('serves PMCM dashboard reads through EventReadModelsService', async () => {
    const { controller, eventReadModelsService, eventAccessPolicyService } = createController();

    await expect(controller.dashboard({ id: 'user_pmcm', actorId: 'user_pmcm', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'mys@pmcm.test', actorEmail: 'mys@pmcm.test', name: 'Maxine', actorName: 'Maxine', expiresAt: '2026-07-03T12:00:00.000Z' } as any)).resolves.toEqual({ events: [] });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, { id: 'user_pmcm', actorId: 'user_pmcm', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'mys@pmcm.test', actorEmail: 'mys@pmcm.test', name: 'Maxine', actorName: 'Maxine', expiresAt: '2026-07-03T12:00:00.000Z' });
    expect(eventReadModelsService.pmcmDashboard).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      expect.objectContaining({
        coordinatorRoleRequirements: expect.any(Array),
        mapEvent: expect.any(Function),
      }),
    );
  });

  it('serves PMCM event workspace reads through EventReadModelsService', async () => {
    const { controller, eventReadModelsService } = createController();

    await expect(controller.eventWorkspace('evt_sample', { id: 'user_pmcm', actorId: 'user_pmcm', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'mys@pmcm.test', actorEmail: 'mys@pmcm.test', name: 'Maxine', actorName: 'Maxine', expiresAt: '2026-07-03T12:00:00.000Z' } as any)).resolves.toEqual({
      event: { id: 'evt_sample' },
    });

    expect(eventReadModelsService.pmcmEventWorkspace).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      'evt_sample',
      expect.objectContaining({ mapEvent: expect.any(Function) }),
    );
  });

  it('serves coordinator reliability history through the PMCM reader with the verified actor', async () => {
    const { controller, eventReadModelsService } = createController();
    const verifiedActor = { id: 'user_pmcm', actorId: 'user_pmcm', role: 'pmcm-admin', actorRole: 'pmcm-admin', email: 'pmcm@example.test', actorEmail: 'pmcm@example.test', name: 'Maxine', actorName: 'Maxine' } as any;

    await expect(controller.coordinatorReliabilityHistory('coord_1', verifiedActor)).resolves.toEqual([{ id: 'note_1' }]);

    expect(eventReadModelsService.coordinatorReliabilityHistory).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'Maxine' },
      'coord_1',
    );
  });
});
