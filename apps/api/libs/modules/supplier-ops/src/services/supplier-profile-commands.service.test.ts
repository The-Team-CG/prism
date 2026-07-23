import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { WorkflowCommandService } from '@prism/modules/event-core';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';

describe('SupplierProfileCommandsService', () => {
  it('executes supplier review write and side effects with audit logging', async () => {
    const suppliersService = {
      addSupplierReview: vi.fn(async () => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123' })),
    };
    const auditService = {
      audit: vi.fn(async () => {}),
    };
    const eventAccessPolicyService = { requireActorRole: vi.fn(async () => {}) };
    const workflowCommandService = new WorkflowCommandService();
    const service = new SupplierProfileCommandsService(
      suppliersService as any,
      auditService as any,
      eventAccessPolicyService as any,
      workflowCommandService,
    );
    const actor = { role: 'pmcm-admin', name: 'Real Admin', email: 'admin@pmcm.test' };

    await expect(
      service.addSupplierReview('sup_1', { rating: 5, notes: 'Great' } as any, actor as any),
    ).resolves.toEqual({ id: 'sup_1', name: 'Acme AV' });

    expect(suppliersService.addSupplierReview).toHaveBeenCalledTimes(1);
    expect(auditService.audit).toHaveBeenCalledWith(
      undefined,
      'Real Admin',
      'Added private supplier review: Acme AV',
      expect.objectContaining({
        actorRole: 'pmcm-admin',
        actorEmail: 'admin@pmcm.test',
        affectedType: 'supplier_review',
        affectedId: 'review_abc123',
      }),
    );
  });
});
