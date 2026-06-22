import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsSupplierWorkspaceReadsController } from './supplier-workspace.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
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
    };
    const controller = new OpsSupplierWorkspaceReadsController(
      eventReadModelsService as any,
      eventAccessPolicyService as any,
    );
    const actorQuery = { actorRole: OpsUserRole.Supplier, actorName: 'SonicLine Technicals', supplierId: 'sup_sonic' };

    const workspace = await controller.getSupplierWorkspace(actorQuery);
    const board = await controller.readinessBoard(actorQuery);

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
  });
});
