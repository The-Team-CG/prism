import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventSessionGuard } from '@prism/kernel/event-session';
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
    correctSupplierEventStatus: vi.fn(async () => ({ id: 'qr_sample' })),
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

const verifiedActor = {
  id: 'pmcm_admin',
  actorId: 'pmcm_admin',
  role: OpsUserRole.PmcmAdmin,
  actorRole: OpsUserRole.PmcmAdmin,
  email: 'admin@pmcm.test',
  actorEmail: 'admin@pmcm.test',
  name: 'PMCM Admin',
  actorName: 'PMCM Admin',
  expiresAt: '2026-07-03T12:00:00.000Z',
};

describe('OpsEventSupplierWithdrawalController', () => {
  it('keeps the event route base path stable', () => {
    expect(controllerPath(OpsEventSupplierWithdrawalController)).toBe('events');
  });

  it('requires a verified event session for supplier withdrawal', () => {
    const guards = Reflect.getMetadata('__guards__', OpsEventSupplierWithdrawalController.prototype.withdrawSupplier);
    expect(guards).toContain(EventSessionGuard);
  });

  it('delegates supplier withdrawal with the default reason', async () => {
    const { actor, controller, eventAccessPolicyService, supplierNetworkWorkflowService } = createController();
    await controller.withdrawSupplier('evt_sample', 'qr_sample', {}, verifiedActor);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Withdrawn by PMCM Admin',
      actor,
      'evt_sample',
    );
  });

  it('delegates supplier withdrawal with a custom reason', async () => {
    const { actor, controller, supplierNetworkWorkflowService } = createController();

    await controller.withdrawSupplier(
      'evt_sample',
      'qr_sample',
      { reason: 'Supplier unavailable' },
      verifiedActor,
    );

    expect(supplierNetworkWorkflowService.withdrawSupplier).toHaveBeenCalledWith(
      'qr_sample',
      'Supplier unavailable',
      actor,
      'evt_sample',
    );
  });

  it('guards the PMCM supplier status correction with a session and delegates with the resolved actor', async () => {
    const guards = Reflect.getMetadata('__guards__', OpsEventSupplierWithdrawalController.prototype.correctSupplierEventStatus);
    expect(guards).toContain(EventSessionGuard);

    const { actor, controller, supplierNetworkWorkflowService } = createController();
    const body = { status: 'arrived' as const, reason: 'Reported by mistake' };
    await controller.correctSupplierEventStatus('evt_sample', 'qr_sample', body, verifiedActor);

    expect(supplierNetworkWorkflowService.correctSupplierEventStatus).toHaveBeenCalledWith('evt_sample', 'qr_sample', body, actor);
  });
});
