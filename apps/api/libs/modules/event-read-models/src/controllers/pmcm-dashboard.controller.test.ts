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
  };
  const eventAccessPolicyService = {
    resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
  };
  const auditService = { mapAuditLog: vi.fn((log) => log) };
  const billingOperationsService = {
    mapBillingSource: vi.fn((source) => source),
    mapBillingStatement: vi.fn((statement) => statement),
    mapPaymentMilestone: vi.fn((milestone) => milestone),
    mapPaymentRecord: vi.fn((record) => record),
  };
  const coordinatorsService = {
    mapCoordinator: vi.fn((coordinator) => coordinator),
    mapCoordinatorAssignment: vi.fn((assignment) => assignment),
  };
  const floorPlanWorkflowService = { mapFloorPlanDraft: vi.fn((draft) => draft) };
  const guestWorkflowService = { guestAccessCode: vi.fn(() => 'EVENT-CODE') };

  const controller = new OpsPmcmDashboardController(
    eventReadModelsService as any,
    eventAccessPolicyService as any,
    auditService as any,
    billingOperationsService as any,
    coordinatorsService as any,
    floorPlanWorkflowService as any,
    guestWorkflowService as any,
  );

  return { controller, eventReadModelsService, eventAccessPolicyService };
}

describe('OpsPmcmDashboardController', () => {
  it('keeps the public PMCM route base stable under event-read-models ownership', () => {
    expect(controllerPath(OpsPmcmDashboardController)).toBe('pmcm');
  });

  it('serves PMCM dashboard reads through EventReadModelsService', async () => {
    const { controller, eventReadModelsService, eventAccessPolicyService } = createController();

    await expect(controller.dashboard({ actorRole: 'pmcm-admin', actorName: 'Maxine' })).resolves.toEqual({ events: [] });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({
      actorRole: 'pmcm-admin',
      actorName: 'Maxine',
    });
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

    await expect(controller.eventWorkspace('evt_sample', { actorRole: 'pmcm-admin' })).resolves.toEqual({
      event: { id: 'evt_sample' },
    });

    expect(eventReadModelsService.pmcmEventWorkspace).toHaveBeenCalledWith(
      { role: 'pmcm-admin', name: 'pmcm-admin' },
      'evt_sample',
      expect.objectContaining({ mapEvent: expect.any(Function) }),
    );
  });
});
