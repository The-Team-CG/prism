import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsSuppliersController } from './suppliers.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsSuppliersController', () => {
  it('keeps the public suppliers route base stable under supplier-ops command ownership', () => {
    expect(controllerPath(OpsSuppliersController)).toBe('suppliers');
  });

  it('delegates supplier writes through the supplier command port with a resolved actor', async () => {
    const actor = { role: 'pmcm-admin', name: 'Maxine', email: 'maxine@pmcm.test' };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
    };
    const supplierCommands = {
      createSupplier: vi.fn(async () => ({ id: 'sup_new' })),
      updateSupplier: vi.fn(async () => ({ id: 'sup_existing' })),
      changeSupplierTier: vi.fn(async () => ({ id: 'sup_tier' })),
      addSupplierReview: vi.fn(async () => ({ id: 'sup_review' })),
      addSupplierCertification: vi.fn(async () => ({ id: 'sup_cert' })),
    };
    const controller = new OpsSuppliersController(eventAccessPolicyService as any, supplierCommands as any);
    const actorInput = { actorRole: 'pmcm-admin', actorName: 'Maxine' };

    await expect(controller.create({ categoryId: 'cat_food', name: 'SonicLine' }, actorInput)).resolves.toEqual({
      id: 'sup_new',
    });
    await expect(controller.update('sup_1', { phone: '+63 900 111 2222' }, actorInput)).resolves.toEqual({
      id: 'sup_existing',
    });
    await expect(controller.changeTier('sup_1', { tier: 'preferred', reason: 'Reliable' }, actorInput)).resolves.toEqual({
      id: 'sup_tier',
    });
    await expect(controller.addReview('sup_1', { rating: 5, notes: 'Excellent' }, actorInput)).resolves.toEqual({
      id: 'sup_review',
    });
    await expect(
      controller.addCertification('sup_1', { fileName: 'permit.pdf', documentType: 'permit' }, actorInput),
    ).resolves.toEqual({ id: 'sup_cert' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledTimes(5);
    expect(supplierCommands.createSupplier).toHaveBeenCalledWith({ categoryId: 'cat_food', name: 'SonicLine' }, actor);
    expect(supplierCommands.updateSupplier).toHaveBeenCalledWith('sup_1', { phone: '+63 900 111 2222' }, actor);
    expect(supplierCommands.changeSupplierTier).toHaveBeenCalledWith(
      'sup_1',
      { tier: 'preferred', reason: 'Reliable' },
      actor,
    );
    expect(supplierCommands.addSupplierReview).toHaveBeenCalledWith('sup_1', { rating: 5, notes: 'Excellent' }, actor);
    expect(supplierCommands.addSupplierCertification).toHaveBeenCalledWith(
      'sup_1',
      { fileName: 'permit.pdf', documentType: 'permit' },
      actor,
    );
  });
});
