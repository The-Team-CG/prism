import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsSupplierDirectoryController } from './supplier-directory.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsSupplierDirectoryController', () => {
  it('keeps the public suppliers route base stable under supplier-ops ownership', () => {
    expect(controllerPath(OpsSupplierDirectoryController)).toBe('suppliers');
  });

  it('serves supplier directory reads through SuppliersService with role policy', async () => {
    const suppliersService = {
      listSupplierCategories: vi.fn(async () => [{ id: 'cat_food' }]),
      listSuppliers: vi.fn(async () => [{ id: 'sup_1' }]),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn((input) => ({ role: input.actorRole, name: input.actorName ?? input.actorRole })),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsSupplierDirectoryController(suppliersService as any, eventAccessPolicyService as any);

    await expect(controller.listCategories({ actorRole: 'supplier', actorName: 'SonicLine' })).resolves.toEqual([
      { id: 'cat_food' },
    ]);
    await expect(controller.list({ actorRole: 'pmcm-admin', actorName: 'Maxine' })).resolves.toEqual([{ id: 'sup_1' }]);

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