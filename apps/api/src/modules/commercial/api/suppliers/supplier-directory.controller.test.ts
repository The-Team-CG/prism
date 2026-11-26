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

  it('requires a verified session actor for listCategories', () => {
    const guards = Reflect.getMetadata('__guards__', OpsSupplierDirectoryController.prototype.listCategories);
    expect(guards).toContain(EventSessionGuard);
  });

  it('serves supplier categories using the verified session actor', async () => {
    const suppliersService = {
      listSupplierCategories: vi.fn(async () => [{ id: 'cat_food' }]),
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

    await expect(controller.listCategories(supplierActor as any)).resolves.toEqual([{ id: 'cat_food' }]);

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, supplierActor);
    expect(eventAccessPolicyService.requireActorRole).toHaveBeenCalledWith(
      { role: 'supplier', name: 'SonicLine' },
      ['pmcm-admin', 'system', 'supplier'],
      'supplier categories',
    );
    expect(suppliersService.listSupplierCategories).toHaveBeenCalledTimes(1);
  });
});
