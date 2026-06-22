import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
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
  return {
    controller: new OpsSupplierPareController(supplierNetworkWorkflowService as any),
    supplierNetworkWorkflowService,
  };
}

describe('OpsSupplierPareController', () => {
  it('keeps the PARE route base path stable', () => {
    expect(controllerPath(OpsSupplierPareController)).toBe('ai');
  });

  it('delegates manual PARE triggers through the supplier withdrawal workflow', async () => {
    const { controller, supplierNetworkWorkflowService } = createController();

    await controller.pareManualTrigger('qr_sample');

    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Manual PARE trigger via API',
      { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true },
    );
  });

  it('delegates pending approval reads to the supplier workflow', async () => {
    const { controller, supplierNetworkWorkflowService } = createController();

    await controller.pareGetPending('evt_sample');

    expect(supplierNetworkWorkflowService.pareGetPendingApprovals).toHaveBeenCalledWith('evt_sample');
  });

  it('delegates PARE approval decisions to the supplier workflow', async () => {
    const { controller, supplierNetworkWorkflowService } = createController();

    await controller.pareApprove('aip_sample', 'Maxine');
    await controller.pareReject('aip_sample', 'Maxine');

    expect(supplierNetworkWorkflowService.pareApprove).toHaveBeenCalledWith('aip_sample', 'Maxine');
    expect(supplierNetworkWorkflowService.pareReject).toHaveBeenCalledWith('aip_sample', 'Maxine');
  });
});

