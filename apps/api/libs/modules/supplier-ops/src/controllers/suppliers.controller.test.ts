import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { EventSessionGuard } from '@prism/modules/event-session';
import { OpsSuppliersController } from './suppliers.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsSuppliersController', () => {
  it('keeps the public suppliers route base stable under supplier-ops command ownership', () => {
    expect(controllerPath(OpsSuppliersController)).toBe('suppliers');
  });

  it('requires a verified session actor for supplier review writes', async () => {
    const guards = Reflect.getMetadata('__guards__', OpsSuppliersController.prototype.addReview);
    expect(guards).toContain(EventSessionGuard);

    const actor = { role: 'pmcm-admin', name: 'Real Admin', email: 'admin@pmcm.test' };
    const verifiedActor = {
      actorId: 'user_real_admin',
      actorRole: 'pmcm-admin',
      actorName: 'Real Admin',
      actorEmail: 'admin@pmcm.test',
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
    };
    const supplierCommands = {
      addSupplierReview: vi.fn(async () => ({ id: 'sup_review' })),
    };
    const controller = new OpsSuppliersController(eventAccessPolicyService as any, supplierCommands as any);
    const spoofedQuery = { actorRole: 'pmcm-admin', actorName: 'Spoofed Admin', actorEmail: 'spoofed@example.com' };
    const review = { rating: 5, notes: 'Excellent' };

    await expect(controller.addReview('sup_1', review, spoofedQuery, verifiedActor as any)).resolves.toEqual({
      id: 'sup_review',
    });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, verifiedActor);
    expect(supplierCommands.addSupplierReview).toHaveBeenCalledWith('sup_1', review, actor);
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
    await expect(controller.addReview('sup_1', { rating: 5, notes: 'Excellent' }, actorInput, undefined as any)).resolves.toEqual({
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
