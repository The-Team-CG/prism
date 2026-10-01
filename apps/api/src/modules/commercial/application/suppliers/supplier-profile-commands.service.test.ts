import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { SupplierProfileCommandsService } from './supplier-profile-commands.service';

const pmcmAdminActor = { id: 'user_pmcm_admin', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true };

describe('SupplierProfileCommandsService', () => {
  it('executes supplier review write and side effects with audit logging', async () => {
    const suppliersService = {
      addSupplierReview: vi.fn(async (_supplierId: string, _input: unknown, _reviewedBy: string, _context?: unknown) => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123' })),
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
    const actor = { id: 'user_real_admin', role: 'pmcm-admin', name: 'Real Admin', email: 'admin@pmcm.test' };

    await expect(
      service.addSupplierReview('sup_1', { rating: 5, notes: 'Great' } as any, actor as any),
    ).resolves.toEqual({ id: 'sup_1', name: 'Acme AV' });

    expect(suppliersService.addSupplierReview).toHaveBeenCalledTimes(1);
    expect(suppliersService.addSupplierReview.mock.calls[0]?.[2]).toBe('Real Admin');
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: undefined,
        actor: 'Real Admin',
        action: 'Added private supplier review: Acme AV',
        actorRole: 'pmcm-admin',
        actorEmail: 'admin@pmcm.test',
        affectedType: 'supplier_review',
        affectedId: 'review_abc123',
        metadata: { rating: 5, actorId: 'user_real_admin' },
      }),
      undefined,
    );
  });

  it('persists the verified actor name for supplier promotion', async () => {
    const promoteSupplier = vi.fn(async (_supplierId: string, _input: unknown, _promotedBy: string, _context?: unknown) => ({
      supplier: { id: 'sup_1', name: 'Acme AV' },
      replayed: false,
    }));
    const auditWriter = { write: vi.fn(async () => {}) };
    const service = new SupplierProfileCommandsService(
      { promoteSupplier } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[0],
      auditWriter as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[1],
      { requireActorRole: vi.fn(async () => {}) } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[2],
      new WorkflowCommandService(),
    );

    await service.promoteSupplier('sup_1', {
      eventId: 'evt_close_1',
      tier: 'tier_1',
      reason: 'Completed event assessment',
    }, pmcmAdminActor);

    expect(promoteSupplier.mock.calls[0]?.[2]).toBe('PMCM Admin');
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      actor: 'PMCM Admin',
      metadata: { tier: 'tier_1', reason: 'Completed event assessment', actorId: 'user_pmcm_admin' },
    }), undefined);
  });
  it('does not emit duplicate audit attribution for a promotion replay', async () => {
    const promoteSupplier = vi.fn(async (_supplierId: string, _input: unknown, _promotedBy: string) => ({
      supplier: { id: 'sup_1', name: 'Acme AV' },
      replayed: true,
    }));
    const audit = vi.fn();
    const service = new SupplierProfileCommandsService(
      { promoteSupplier } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[0],
      { write: audit } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[1],
      { requireActorRole: vi.fn(async () => {}) } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[2],
      new WorkflowCommandService(),
    );
    const retryingActor = { ...pmcmAdminActor, id: 'user_retrying_admin', name: 'Retrying Admin' };

    await expect(service.promoteSupplier('sup_1', {
      eventId: 'evt_close_1', tier: 'tier_1', reason: 'Completed event assessment', idempotencyKey: 'promotion-key-1',
    }, retryingActor)).resolves.toEqual({ id: 'sup_1', name: 'Acme AV' });

    expect(promoteSupplier.mock.calls[0]?.[1]).toMatchObject({ idempotencyKey: 'promotion-key-1' });
    expect(promoteSupplier.mock.calls[0]?.[2]).toBe('Retrying Admin');
    expect(audit).not.toHaveBeenCalled();
  });
  it('rejects supplier review writes without a verified actor ID before persistence', async () => {
    const addSupplierReview = vi.fn();
    const service = new SupplierProfileCommandsService(
      { addSupplierReview } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[0],
      { write: vi.fn() } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[1],
      { requireActorRole: vi.fn() } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[2],
      new WorkflowCommandService(),
    );
    const actor = { role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor;

    await expect(service.addSupplierReview('sup_1', { rating: 5, notes: 'Great' }, actor))
      .rejects.toBeInstanceOf(ForbiddenException);

    expect(addSupplierReview).not.toHaveBeenCalled();
  });
  it('rejects supplier review writes from a client actor before persistence', async () => {
    const suppliersService = {
      addSupplierReview: vi.fn(async (_supplierId: string, _input: unknown, _reviewedBy: string, _context?: unknown) => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123' })),
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
      id: 'user_client',
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

  it('does not emit a duplicate audit for an idempotent review replay', async () => {
    const addSupplierReview = vi.fn(async () => ({ supplier: { id: 'sup_1', name: 'Acme AV' }, reviewId: 'review_abc123', replayed: true }));
    const audit = vi.fn();
    const service = new SupplierProfileCommandsService(
      { addSupplierReview } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[0],
      { write: audit },
      { requireActorRole: vi.fn() } as unknown as ConstructorParameters<typeof SupplierProfileCommandsService>[2],
      new WorkflowCommandService(),
    );
    await service.addSupplierReview('sup_1', { eventId: 'evt_1', rating: 5, notes: 'Done', idempotencyKey: 'key-1' }, pmcmAdminActor);
    expect(audit).not.toHaveBeenCalled();
  });
});
