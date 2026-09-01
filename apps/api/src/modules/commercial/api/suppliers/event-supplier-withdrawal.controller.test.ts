import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { OpsEventSupplierWithdrawalController } from './event-supplier-withdrawal.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createController() {
  const actor = { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };
  const eventAccessPolicyService = {
    resolveActor: vi.fn(() => actor),
  };
  const supplierNetworkWorkflowService = {
    withdrawSupplier: vi.fn(async () => ({ id: 'qr_sample' })),
  };
  return {
    actor,
    controller: new OpsEventSupplierWithdrawalController(
      supplierNetworkWorkflowService as any,
      eventAccessPolicyService as any,
    ),
    eventAccessPolicyService,
    supplierNetworkWorkflowService,
  };
}

describe('OpsEventSupplierWithdrawalController', () => {
  it('keeps the event route base path stable', () => {
    expect(controllerPath(OpsEventSupplierWithdrawalController)).toBe('events');
  });

  it('delegates supplier withdrawal with the default reason', async () => {
    const { actor, controller, eventAccessPolicyService, supplierNetworkWorkflowService } = createController();
    const actorQuery = { actorRole: OpsUserRole.PmcmAdmin, actorName: 'PMCM Admin' };

    await controller.withdrawSupplier('evt_sample', 'qr_sample', {}, actorQuery as any);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith(actorQuery);
    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Withdrawn by PMCM Admin',
      actor,
    );
  });

  it('delegates supplier withdrawal with a custom reason', async () => {
    const { actor, controller, supplierNetworkWorkflowService } = createController();

    await controller.withdrawSupplier(
      'evt_sample',
      'qr_sample',
      { reason: 'Supplier unavailable' },
      { actorRole: OpsUserRole.PmcmAdmin } as any,
    );

    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Supplier unavailable',
      actor,
    );
  });
});
