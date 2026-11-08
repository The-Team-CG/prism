import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { SupplierWorkflowService } from './supplier-workflow.service';

const supplierActor = { id: 'usr_sup', role: OpsUserRole.Supplier, name: 'SoundLine', email: 'ops@soundline.test', supplierId: 'sup_1', explicit: true, verified: true };
const checksum = 'a'.repeat(64);

function fixture(selectedQuoteAmount: number | null) {
  const contracts: Array<Record<string, unknown>> = [];
  const notes: Array<Record<string, unknown>> = [];
  const request = { id: 'qr_1', eventId: 'evt_1', supplierId: 'sup_1', supplierName: 'SoundLine', status: 'selected', assignmentStatus: 'confirmed' };
  const tx = {
    $queryRaw: vi.fn(async () => []),
    opsSupplierQuoteRequest: { findUnique: vi.fn(async () => request) },
    opsSupplierQuote: { findFirst: vi.fn(async () => (selectedQuoteAmount === null ? null : { amount: selectedQuoteAmount })) },
    opsSupplierContractVersion: {
      findUnique: vi.fn(async () => null),
      findFirst: vi.fn(async () => null),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { ...data, reviewReason: null, uploadedAt: new Date(), reviewedAt: null, reviewedBy: null };
        contracts.push(row);
        return row;
      }),
    },
    opsSupplierReliabilityNote: { upsert: vi.fn(async ({ create }: { create: Record<string, unknown> }) => { notes.push(create); return create; }) },
  };
  const prisma = {
    opsSupplier: { findUnique: vi.fn(async () => ({ id: 'sup_1', name: 'SoundLine' })) },
    opsSupplierQuoteRequest: { findUnique: vi.fn(async () => request) },
    $transaction: vi.fn(async (fn: (value: typeof tx) => unknown) => fn(tx)),
  };
  const policy = { requireActorRole: vi.fn(async () => undefined), recordForbiddenAccess: vi.fn() };
  const audit = { write: vi.fn(async () => undefined) };
  const events = { findOperationsEvent: vi.fn(async () => ({ id: 'evt_1', archived: false })) };
  const uploads = {
    findConfirmedSupplierUpload: vi.fn(async () => ({ id: 'obj_1', originalFileName: 'contract.pdf', contentType: 'application/pdf', declaredByteSize: 1200, checksumSha256: checksum })),
  };
  const service = new SupplierWorkflowService(prisma as never, policy as never, audit as never, events as never, uploads as never);
  return { service, notes, audit };
}

describe('FR-77 supplier contract mismatch', () => {
  it('flags a contract whose total differs from the selected quote and records one reliability note', async () => {
    const f = fixture(120_000);
    const contract = await f.service.bindContract('qr_1', { storedObjectId: 'obj_1', checksumSha256: checksum, contractTotal: 135_000 }, supplierActor as never);
    expect(contract).toMatchObject({ contractTotal: 135_000, quotedTotal: 120_000, quoteMismatch: true });
    expect(f.notes).toEqual([expect.objectContaining({ supplierId: 'sup_1', note: expect.stringContaining('Contract mismatch') })]);
    expect(f.audit.write).toHaveBeenCalledWith(expect.objectContaining({ severity: 'warning' }), expect.anything());
  });

  it('accepts a matching contract without a mismatch or note', async () => {
    const f = fixture(120_000);
    const contract = await f.service.bindContract('qr_1', { storedObjectId: 'obj_1', checksumSha256: checksum, contractTotal: 120_000 }, supplierActor as never);
    expect(contract.quoteMismatch).toBe(false);
    expect(f.notes).toHaveLength(0);
  });
});
