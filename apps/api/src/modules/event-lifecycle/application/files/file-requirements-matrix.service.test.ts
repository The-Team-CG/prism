import { describe, expect, it, vi } from 'vitest';
import { FileRequirementsMatrixService } from './file-requirements-matrix.service';

function createPrisma() {
  const event = {
    id: 'evt_file',
    floorPlanStatus: 'approved',
  };
  const documents = [
    { id: 'doc_conforme', eventId: 'evt_file', type: 'signed_conforme', status: 'approved' },
    { id: 'doc_report', eventId: 'evt_file', type: 'post_event_report', status: 'submitted' },
    { id: 'doc_feedback', eventId: 'evt_file', type: 'client_feedback', status: 'submitted' },
  ];
  const postEventDocuments = [{ id: 'post_feedback', eventId: 'evt_file', title: 'Client feedback', status: 'submitted' }];
  const billingStatements = [{ id: 'bill_1', eventId: 'evt_file' }];
  const milestones = [{ id: 'pay_1', eventId: 'evt_file', status: 'paid', remainingBalance: 0 }];
  const supplierReviews = [{ id: 'rev_1', eventId: 'evt_file' }];
  return {
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsDocument: { findMany: vi.fn(async () => documents) },
    opsPostEventDocument: { findMany: vi.fn(async () => postEventDocuments) },
    opsBillingStatement: { findMany: vi.fn(async () => billingStatements) },
    opsPaymentMilestone: { findMany: vi.fn(async () => milestones) },
    opsSupplierReview: { findMany: vi.fn(async () => supplierReviews) },
  };
}

describe('FileRequirementsMatrixService', () => {
  it('builds matrix items and close gates from event-scoped records', async () => {
    const prisma = createPrisma();
    const service = new FileRequirementsMatrixService(prisma as any);

    const matrix = await service.buildForEvent('evt_file');
    const closeGates = await service.closeGates('evt_file');

    expect(matrix.eventId).toBe('evt_file');
    expect(matrix.items.map((item) => item.key)).toEqual([
      'signed_conforme',
      'post_event_documents',
      'billing_statement',
      'official_floorplan',
      'supplier_reviews',
      'client_feedback',
    ]);
    expect(matrix.items.find((item) => item.key === 'supplier_reviews')?.visibleToRoles).toEqual(['pmcm-admin']);
    expect(closeGates.ready).toBe(true);
    expect(closeGates.missingKeys).toEqual([]);
    expect(prisma.opsDocument.findMany).toHaveBeenCalledWith({ where: { eventId: 'evt_file' } });
  });
});
