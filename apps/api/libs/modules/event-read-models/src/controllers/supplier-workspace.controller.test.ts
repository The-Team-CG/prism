import 'reflect-metadata';
import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { EventSessionGuard } from '@prism/modules/event-session';
import type { PrismVerifiedEventActor } from '@prism/types';
import { OpsSupplierWorkspaceReadsController } from './supplier-workspace.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function verifiedActor(role: string, overrides: Partial<PrismVerifiedEventActor> = {}) {
  return {
    id: 'user_supplier',
    actorId: 'user_supplier',
    role,
    actorRole: role,
    email: 'supplier@example.com',
    actorEmail: 'supplier@example.com',
    name: 'SonicLine Technicals',
    actorName: 'SonicLine Technicals',
    expiresAt: '2026-08-04T00:00:00.000Z',
    ...overrides,
  } as PrismVerifiedEventActor;
}

describe('OpsSupplierWorkspaceReadsController', () => {
  it('keeps supplier workspace read routes under the supplier route base', () => {
    expect(controllerPath(OpsSupplierWorkspaceReadsController)).toBe('supplier');
  });

  it('serves supplier workspace and readiness board through EventReadModelsService', async () => {
    const eventReadModelsService = {
      supplierWorkspace: vi.fn(async (_actor, mappers) => ({
        quoteRequests: [
          mappers.mapSupplierQuoteRequest({
            id: 'qr_sonic',
            eventId: 'evt_sample',
            supplierId: 'sup_sonic',
            categoryId: 'supcat_technicals',
            supplierName: 'SonicLine Technicals',
            category: 'Technicals',
            message: 'Ayala Tech Summit quote request.',
            dueDate: new Date('2026-06-25T00:00:00.000Z'),
            accessToken: 'token-sample',
            confidentialBid: false,
            status: 'selected',
            assignmentStatus: 'confirmed',
            assignmentConfirmedAt: new Date('2026-06-20T08:00:00.000Z'),
            readinessStatus: 'confirmed',
            readinessConfirmedAt: new Date('2026-06-20T09:00:00.000Z'),
            readinessNotes: 'Ready for ingress',
            contractDocumentId: 'doc_contract',
            createdAt: new Date('2026-06-19T08:00:00.000Z'),
          }),
        ],
        supplierQuotes: [
          mappers.mapSupplierQuoteForSupplier({
            id: 'quote_sonic',
            eventId: 'evt_sample',
            requestId: 'qr_sonic',
            supplierId: 'sup_sonic',
            categoryId: 'supcat_technicals',
            supplierName: 'SonicLine Technicals',
            category: 'Technicals',
            amount: 125000,
            inclusions: ['Sound system'],
            paymentTerms: '50/50',
            notes: 'Includes ingress',
            acceptableMin: 100000,
            acceptableMax: 130000,
            outsideAcceptableRange: false,
            status: 'submitted',
            selectedAt: null,
            createdAt: new Date('2026-06-19T09:00:00.000Z'),
          }),
        ],
      })),
      supplierReadinessBoard: vi.fn(async () => ({ items: [{ id: 'supplier-readiness:qr_sonic' }] })),
    };
    const actor = { role: OpsUserRole.Supplier, supplierId: 'sup_sonic', name: 'SonicLine Technicals' };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
      requireActorRole: vi.fn(async () => undefined),
    };
    const controller = new OpsSupplierWorkspaceReadsController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );
    const session = verifiedActor(OpsUserRole.Supplier);

    const workspace = await controller.getSupplierWorkspace(session);
    const board = await controller.readinessBoard(session);

    expect(workspace.quoteRequests[0]).toMatchObject({
      id: 'qr_sonic',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: '2026-06-20T08:00:00.000Z',
    });
    expect(workspace.supplierQuotes[0]).toMatchObject({ id: 'quote_sonic', amount: 125000 });
    expect(workspace.supplierQuotes[0]).not.toHaveProperty('acceptableMin');
    expect(board).toEqual({ items: [{ id: 'supplier-readiness:qr_sonic' }] });
    expect(eventReadModelsService.supplierWorkspace).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({
        mapSupplierQuoteRequest: expect.any(Function),
        mapSupplierQuoteForSupplier: expect.any(Function),
      }),
    );
    expect(eventReadModelsService.supplierReadinessBoard).toHaveBeenCalledWith(actor);
    // Identity must come from the verified session only - resolveActor gets an empty
    // request input, so nothing from the query string can influence the actor (PA-284).
    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledWith({}, session);
  });

  it('guards both reads with EventSessionGuard', () => {
    for (const handler of ['getSupplierWorkspace', 'readinessBoard'] as const) {
      const guards = Reflect.getMetadata('__guards__', OpsSupplierWorkspaceReadsController.prototype[handler]);
      expect(guards, `${handler} must be session-guarded`).toContain(EventSessionGuard);
    }
  });

  it('accepts no query parameters, so ?actorRole= cannot reach resolveActor', () => {
    // Zero declared route params means a forged ?actorRole=supplier is simply ignored.
    for (const handler of ['getSupplierWorkspace', 'readinessBoard'] as const) {
      const params = Reflect.getMetadata(
        '__routeArguments__',
        OpsSupplierWorkspaceReadsController,
        handler,
      ) as Record<string, unknown> | undefined;
      const queryParams = Object.keys(params ?? {}).filter((key) => key.startsWith('3:'));
      expect(queryParams, `${handler} must not declare @Query params`).toEqual([]);
    }
  });

  it('rejects a session whose role is neither supplier nor pmcm-admin', async () => {
    const eventReadModelsService = {
      supplierWorkspace: vi.fn(),
      supplierReadinessBoard: vi.fn(),
    };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => ({ role: OpsUserRole.Guest, name: 'Nosy Guest' })),
      requireActorRole: vi.fn(async () => {
        throw new ForbiddenException('Forbidden');
      }),
    };
    const controller = new OpsSupplierWorkspaceReadsController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );

    await expect(controller.getSupplierWorkspace(verifiedActor(OpsUserRole.Guest))).rejects.toThrow(
      ForbiddenException,
    );
    await expect(controller.readinessBoard(verifiedActor(OpsUserRole.Guest))).rejects.toThrow(ForbiddenException);
    expect(eventReadModelsService.supplierWorkspace).not.toHaveBeenCalled();
    expect(eventReadModelsService.supplierReadinessBoard).not.toHaveBeenCalled();
  });
});
