import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/kernel/event-session';
import { OpsSupplierDirectoryController } from './supplier-directory.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsSupplierDirectoryController', () => {
  it('keeps the public suppliers route base stable under supplier-ops ownership', () => {
    expect(controllerPath(OpsSupplierDirectoryController)).toBe('suppliers');
  });

  it.each([
    ['listCategories', OpsSupplierDirectoryController.prototype.listCategories],
    ['list', OpsSupplierDirectoryController.prototype.list],
  ])('requires a verified session actor for %s', (_name, handler) => {
    const guards = Reflect.getMetadata('__guards__', handler);
    expect(guards).toContain(EventSessionGuard);
  });

  it('serves supplier directory reads using the verified session actor', async () => {
    const suppliersService = {
      listSupplierCategories: vi.fn(async () => [{ id: 'cat_food' }]),
      listSuppliers: vi.fn(async () => [{ id: 'sup_1' }]),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((_input, verifiedActor) => ({
        role: verifiedActor.actorRole,
        name: verifiedActor.actorName ?? verifiedActor.actorRole,
      })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsSupplierDirectoryController(suppliersService as any, eventAccessPolicyService as any);
    const supplierActor = {
      actorId: 'user_sonicline',
      actorRole: 'supplier',
      actorName: 'SonicLine',
      actorEmail: 'sonicline@example.test',
    };
    const adminActor = {
      actorId: 'user_maxine',
      actorRole: 'pmcm-admin',
      actorName: 'Maxine',
      actorEmail: 'maxine@pmcm.test',
    };

    await expect(controller.listCategories(supplierActor as any)).resolves.toEqual([{ id: 'cat_food' }]);
    await expect(controller.list(adminActor as any)).resolves.toEqual([{ id: 'sup_1' }]);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenNthCalledWith(1, {}, supplierActor);
    expect(eventAccessPolicyService.resolveActor).toHaveBeenNthCalledWith(2, {}, adminActor);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenNthCalledWith(
      1,
      { role: 'supplier', name: 'SonicLine' },
      ['pmcm-admin', 'system', 'supplier'],
      'supplier categories',
    );
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenNthCalledWith(
      2,
      { role: 'pmcm-admin', name: 'Maxine' },
      ['pmcm-admin', 'system'],
      'supplier directory',
    );
    expect(suppliersService.listSupplierCategories).toHaveBeenCalledTimes(1);
    expect(suppliersService.listSuppliers).toHaveBeenCalledTimes(1);
  });
});
