import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';

describe('SupplierProfileCommandsService', () => {
  it('executes supplier review write and side effects with audit logging', async () => {
    const suppliersService = {
      addSupplierReview: vi.fn(async () => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123' })),
    };
    const auditWriter = {
      write: vi.fn(async () => {}),
    };
    const eventAccessPolicyService = { requireActorRole: vi.fn(async () => {}) };
    const workflowCommandService = new WorkflowCommandService();
    const service = new SupplierProfileCommandsService(
      suppliersService as any,
      auditWriter as any,
      eventAccessPolicyService as any,
      workflowCommandService,
    );
    const actor = { role: 'pmcm-admin', name: 'Real Admin', email: 'admin@pmcm.test' };

    await expect(
      service.addSupplierReview('sup_1', { rating: 5, notes: 'Great' } as any, actor as any),
    ).resolves.toEqual({ id: 'sup_1', name: 'Acme AV' });

    expect(suppliersService.addSupplierReview).toHaveBeenCalledTimes(1);
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: undefined,
        actor: 'Real Admin',
        action: 'Added private supplier review: Acme AV',
        actorRole: 'pmcm-admin',
        actorEmail: 'admin@pmcm.test',
        affectedType: 'supplier_review',
        affectedId: 'review_abc123',
      }),
      undefined,
    );
  });

  it('rejects supplier review writes from a client actor before persistence', async () => {
    const suppliersService = {
      addSupplierReview: vi.fn(async () => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123' })),
    };
    const auditWriter = { write: vi.fn(async () => {}) };
    const eventAccessPolicyService = {
      requireActorRole: vi.fn(async () => {
        throw new ForbiddenException('Forbidden');
      }),
    };
    const service = new SupplierProfileCommandsService(
      suppliersService as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[0],
      auditWriter as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[1],
      eventAccessPolicyService as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[2],
      new WorkflowCommandService(),
    );
    const actor = {
      role: OpsUserRole.Client,
      name: 'Client User',
      email: 'client@example.test',
      explicit: true,
    } satisfies ResolvedEventOpsActor;

    await expect(
      service.addSupplierReview('sup_1', { eventId: 'evt_close_1', rating: 5, notes: 'Private PMCM note' }, actor),
    ).rejects.toThrow(ForbiddenException);
    expect(suppliersService.addSupplierReview).not.toHaveBeenCalled();
  });
});
