import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/modules/event-core';
import { OpsSupplierWorkspaceCommandsController } from './supplier-workspace-commands.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

function createRequest(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('OpsSupplierWorkspaceCommandsController', () => {
  it('keeps supplier portal command routes under the supplier route base', () => {
    expect(controllerPath(OpsSupplierWorkspaceCommandsController)).toBe('supplier');
  });

  it('serves supplier assignment, readiness, and contract commands through SupplierOps', async () => {
    const supplierNetworkWorkflowService = {
      confirmSupplierAssignment: vi.fn(async () => createRequest()),
      confirmSupplierReadiness: vi.fn(async () => createRequest({ readinessNotes: 'Ingress confirmed' })),
      uploadSupplierContract: vi.fn(async () => createRequest({ contractDocumentId: 'doc_uploaded' })),
    };
    const actor = { role: OpsUserRole.Supplier, name: 'SonicLine Technicals', supplierId: 'sup_sonic' };
    const eventAccessPolicyService = {
      resolveActor: vi.fn(() => actor),
    };
    const controller = new OpsSupplierWorkspaceCommandsController(
      supplierNetworkWorkflowService as any,
      eventAccessPolicyService as any,
    );
    const actorQuery = { actorRole: OpsUserRole.Supplier, actorName: 'SonicLine Technicals', supplierId: 'sup_sonic' };

    await expect(controller.confirmAssignment('qr_sonic', actorQuery)).resolves.toMatchObject({
      id: 'qr_sonic',
      assignmentStatus: 'confirmed',
      assignmentConfirmedAt: '2026-06-20T08:00:00.000Z',
    });
    await expect(controller.confirmReadiness('qr_sonic', { notes: 'Ingress confirmed' }, actorQuery)).resolves.toMatchObject({
      id: 'qr_sonic',
      readinessNotes: 'Ingress confirmed',
    });
    await expect(
      controller.uploadContract(
        'qr_sonic',
        { fileName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 2048 },
        actorQuery,
      ),
    ).resolves.toMatchObject({ id: 'qr_sonic', contractDocumentId: 'doc_uploaded' });

    expect(eventAccessPolicyService.resolveActor).toHaveBeenCalledTimes(3);
    expect(supplierNetworkWorkflowService.confirmSupplierAssignment).toHaveBeenCalledWith('qr_sonic', actor);
    expect(supplierNetworkWorkflowService.confirmSupplierReadiness).toHaveBeenCalledWith(
      'qr_sonic',
      { notes: 'Ingress confirmed' },
      actor,
    );
    expect(supplierNetworkWorkflowService.uploadSupplierContract).toHaveBeenCalledWith(
      'qr_sonic',
      { fileName: 'contract.pdf', mimeType: 'application/pdf', sizeBytes: 2048 },
      actor,
    );
  });
});