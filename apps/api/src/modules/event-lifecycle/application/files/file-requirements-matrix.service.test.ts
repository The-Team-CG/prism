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
  const storedConforme: { id: string } | null = { id: 'obj_conforme' };
  const digitalConforme: { id: string } | null = null;
  const closeoutResponse: { id: string; rating: number; submittedAt: Date } | null = null;
  return {
    opsUrgentIssue: { findMany: vi.fn(async () => [] as Array<{ id: string; status: string; severity: string }>) },
    opsEvent: { findUnique: vi.fn(async () => event) },
    opsDocument: { findMany: vi.fn(async () => documents) },
    opsPostEventDocument: { findMany: vi.fn(async () => postEventDocuments) },
    opsBillingStatement: { findMany: vi.fn(async () => billingStatements) },
    opsPaymentMilestone: { findMany: vi.fn(async () => milestones) },
    opsSupplierReview: { findMany: vi.fn(async () => supplierReviews) },
    opsStoredObject: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => storedConforme) },
    opsConformeExecution: { findFirst: vi.fn(async (): Promise<{ id: string } | null> => digitalConforme) },
    opsClientCloseoutResponse: { findUnique: vi.fn(async (): Promise<{ id: string; rating: number; submittedAt: Date } | null> => closeoutResponse) },
    opsFileRequirement: { findMany: vi.fn(async () => [] as unknown[]) },
    opsLogisticsCompletion: { findUnique: vi.fn(async (): Promise<{ assetReturnsVerified: boolean; recordedAt: Date } | null> => logisticsRecord) },
  };
}

// Set per test: the PMCM logistics record feeding the logistics close gate.
let logisticsRecord: { assetReturnsVerified: boolean; recordedAt: Date } | null = null;

describe('logistics close gate', () => {
  it('stays blocked without a PMCM record and passes once asset returns are verified, without exposing notes', async () => {
    const missing = await new FileRequirementsMatrixService(createPrisma() as never).closeGates('evt_file');
    const missingLogistics = missing.gates.find((gate) => gate.key === 'logistics');
    expect(missingLogistics?.passed).toBe(false);
    expect(missing.missingKeys).toContain('logistics');

    logisticsRecord = { assetReturnsVerified: true, recordedAt: new Date('2026-10-18T09:00:00Z') };
    const recorded = await new FileRequirementsMatrixService(createPrisma() as never).closeGates('evt_file');
    expect(recorded.gates.find((gate) => gate.key === 'logistics')?.passed).toBe(true);
    expect(JSON.stringify(recorded)).not.toMatch(/privateNotes|completionSummary/);
    logisticsRecord = null;
  });
});

describe('FileRequirementsMatrixService', () => {
  it('builds matrix items and close gates from event-scoped records', async () => {
    const prisma = createPrisma();
    const service = new FileRequirementsMatrixService(prisma as never);

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
      'logistics',
      'issues',
    ]);
    expect(matrix.items.find((item) => item.key === 'supplier_reviews')?.visibleToRoles).toEqual(['pmcm-admin']);
    expect(closeGates.ready).toBe(false);
    expect(closeGates.missingKeys).toEqual(['logistics']);
    expect(closeGates.gates.map(gate => gate.key)).toEqual(['documents', 'billing', 'logistics', 'issues', 'feedback']);
    expect(prisma.opsDocument.findMany).toHaveBeenCalledWith({ where: { eventId: 'evt_file' } });
  });

  it('does not let a signed conforme or generic report clear pending tracked deliverables', async () => {
    const prisma = createPrisma();
    prisma.opsPostEventDocument.findMany.mockResolvedValue([
      { id: 'ped_report', eventId: 'evt_file', title: 'Completion report', status: 'pending' },
      { id: 'post_feedback', eventId: 'evt_file', title: 'Client feedback', status: 'submitted' },
    ]);
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).toContain('documents');
  });

  it('requires confirmed bytes for scanned conformes and accepts a completed digital execution without a file', async () => {
    const prisma = createPrisma();
    const service = new FileRequirementsMatrixService(prisma as never);
    prisma.opsStoredObject.findFirst.mockResolvedValue(null);
    const pending = (await service.buildForEvent('evt_file')).items.find(item => item.key === 'signed_conforme');
    expect(pending).toMatchObject({ status: 'pending', uploadedAssetId: undefined });

    prisma.opsConformeExecution.findFirst.mockResolvedValue({ id: 'cfx_completed' });
    const completed = (await service.buildForEvent('evt_file')).items.find(item => item.key === 'signed_conforme');
    expect(completed).toMatchObject({ status: 'approved', generatedDocumentId: 'cfx_completed' });
  });

  it('counts submitted client closeout feedback without substituting guest or supplier feedback', async () => {
    const prisma = createPrisma();
    prisma.opsDocument.findMany.mockResolvedValue([]);
    prisma.opsPostEventDocument.findMany.mockResolvedValue([]);
    prisma.opsClientCloseoutResponse.findUnique.mockResolvedValue({ id: 'response_client', rating: 5, submittedAt: new Date() });
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).not.toContain('feedback');
    expect(result.missingKeys).toContain('documents');
  });

  it('does not report an absent deliverables checklist as complete', async () => {
    const prisma = createPrisma();
    prisma.opsPostEventDocument.findMany.mockResolvedValue([]);
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).toContain('documents');
  });

  it('blocks unresolved urgent issues independently of supplier reviews', async () => {
    const prisma = createPrisma();
    prisma.opsUrgentIssue.findMany.mockResolvedValue([{ id: 'issue_1', status: 'open', severity: 'critical' }]);
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).toContain('issues');
    expect(prisma.opsUrgentIssue.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { eventId: 'evt_file', status: { not: 'resolved' } } }));
  });

  it('does not treat an empty payment schedule as fully paid', async () => {
    const prisma = createPrisma();
    prisma.opsPaymentMilestone.findMany.mockResolvedValue([]);
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).toContain('billing');
  });

  it('does not treat supplier feedback or a blank client form as client feedback', async () => {
    const prisma = createPrisma();
    prisma.opsPostEventDocument.findMany.mockResolvedValue([{ id: 'blank', eventId: 'evt_file', title: 'Client feedback', status: 'pending' }]);
    prisma.opsDocument.findMany.mockResolvedValue([{ id: 'supplier', eventId: 'evt_file', type: 'supplier_feedback', status: 'submitted' }]);
    const result = await new FileRequirementsMatrixService(prisma as never).closeGates('evt_file');
    expect(result.missingKeys).toContain('feedback');
  });
});
