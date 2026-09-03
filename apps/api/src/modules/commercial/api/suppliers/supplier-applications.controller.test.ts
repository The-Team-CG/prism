import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsSupplierApplicationsController } from './supplier-applications.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsSupplierApplicationsController', () => {
  it('keeps the public supplier-applications route base', () => {
    expect(controllerPath(OpsSupplierApplicationsController)).toBe('supplier-applications');
  });

  it.each([
    ['listInbox', OpsSupplierApplicationsController.prototype.listInbox],
    ['review', OpsSupplierApplicationsController.prototype.review],
  ])('requires a verified session actor for %s', (_name, handler) => {
    const guards = Reflect.getMetadata('__guards__', handler);
    expect(guards).toContain(EventSessionGuard);
  });

  it('lists and reviews applications with the verified actor, not a spoofed query', async () => {
    const supplierApplicationService = {
      createSupplierApplication: vi.fn(),
      listPublicCategories: vi.fn(),
      listInbox: vi.fn(async () => [{ id: 'sap_1', status: 'pending' }]),
      reviewApplication: vi.fn(async () => ({ id: 'sap_1', status: 'proposal_requested' })),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input, verifiedActor) => ({
        role: verifiedActor.actorRole,
        name: verifiedActor.actorName,
      })),
    };
    const controller = new OpsSupplierApplicationsController(
      supplierApplicationService as never,
      eventAccessPolicyService as never,
    );
    const adminActor = { actorId: 'admin_1', actorRole: 'pmcm-admin', actorName: 'PMCM Admin' };

    await expect(controller.listInbox(adminActor as never)).resolves.toEqual([{ id: 'sap_1', status: 'pending' }]);
    await expect(
      controller.review('sap_1', { action: 'request_proposal' }, adminActor as never),
    ).resolves.toEqual({ id: 'sap_1', status: 'proposal_requested' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, adminActor);
    expect(supplierApplicationService.listInbox).toHaveBeenCalledWith({
      role: 'pmcm-admin',
      name: 'PMCM Admin',
    });
    expect(supplierApplicationService.reviewApplication).toHaveBeenCalledWith(
      'sap_1',
      { action: 'request_proposal' },
      { role: 'pmcm-admin', name: 'PMCM Admin' },
    );
  });
});
