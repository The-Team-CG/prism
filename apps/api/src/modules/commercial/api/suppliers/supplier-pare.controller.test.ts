import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsSupplierPareController } from './supplier-pare.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const supplierNetworkWorkflowService = {
    withdrawSupplier: vi.fn(async () => ({ id: 'qr_sample' })),
    pareGetPendingApprovals: vi.fn(async () => []),
    pareApprove: vi.fn(async () => ({ id: 'aip_sample', status: 'approved' })),
    pareReject: vi.fn(async () => ({ id: 'aip_sample', status: 'rejected' })),
  };
  const eventAccessPolicyService = { resolveActor: (_input: unknown, actor: unknown) => actor, requireActorRole: vi.fn(async () => undefined) };
  const verifiedActor = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'Maxine', actorEmail: 'maxine@pmcm.test' };
  return {
    controller: new OpsSupplierPareController(supplierNetworkWorkflowService as any, eventAccessPolicyService as any),
    supplierNetworkWorkflowService,
    eventAccessPolicyService,
    verifiedActor,
  };
}

describe('OpsSupplierPareController', () => {
  it('keeps the PARE route base path stable', () => {
    expect(controllerPath(OpsSupplierPareController)).toBe('ai');
  });

  it('delegates manual PARE triggers through the supplier withdrawal workflow', async () => {
    const { controller, supplierNetworkWorkflowService, verifiedActor } = createController();

    await controller.pareManualTrigger('qr_sample', verifiedActor as never);

    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Manual PARE trigger via API',
      expect.objectContaining({ role: OpsUserRole.PmcmAdmin, explicit: true }),
    );
  });

  it('delegates pending approval reads to the supplier workflow', async () => {
    const { controller, supplierNetworkWorkflowService, verifiedActor } = createController();

    await controller.pareGetPending('evt_sample', verifiedActor as never);

    expect(supplierNetworkWorkflowService.pareGetPendingApprovals).toHaveBeenCalledWith('evt_sample');
  });

  it('delegates PARE approval decisions to the supplier workflow', async () => {
    const { controller, supplierNetworkWorkflowService, verifiedActor } = createController();

    await controller.pareApprove('aip_sample', verifiedActor as never);
    await controller.pareReject('aip_sample', verifiedActor as never);

    expect(supplierNetworkWorkflowService.pareApprove).toHaveBeenCalledWith('aip_sample', 'Maxine');
    expect(supplierNetworkWorkflowService.pareReject).toHaveBeenCalledWith('aip_sample', 'Maxine');
  });
});

