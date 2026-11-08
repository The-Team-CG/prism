import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '@prism/kernel/event-core';
import { PareReplacementDispatchService } from './pare-replacement-dispatch.service';

const actor = { id: 'usr-pmcm', role: OpsUserRole.PmcmAdmin, name: 'Maxine', email: 'maxine@pmcm.test', explicit: true, verified: true };

function fixture(pareResult: unknown) {
  const record = { id: 'aip_1', eventId: 'evt_1', requestId: 'qr_withdrawn', status: 'approved', pareResult };
  const supplierWorkflow = { pareApprove: vi.fn(async () => record) };
  const commercialWorkflow = { requestSupplierQuotes: vi.fn(async () => [{ id: 'qr_new' }]) };
  const outbox = { write: vi.fn(async () => undefined) };
  const prisma = {
    opsSupplierQuoteRequest: { findUnique: vi.fn(async () => ({ categoryId: 'cat_av' })) },
    opsSupplier: { findUnique: vi.fn(async () => ({ email: 'ops@soundline.test' })) },
  };
  const service = new PareReplacementDispatchService(prisma as never, supplierWorkflow as never, commercialWorkflow as never, outbox as never);
  return { service, supplierWorkflow, commercialWorkflow, outbox };
}

describe('PareReplacementDispatchService', () => {
  it('requests a quote from the approved replacement and sends it the reviewed PARE notice once', async () => {
    const f = fixture({
      budgetAnalysis: { selectedCandidate: { supplierId: 'sup_sound', supplierName: 'SoundLine' } },
      drafts: { supplierNotification: 'Hello [Supplier name], [Client name] needs audio for the gala.', clientReassurance: 'x' },
    });
    await expect(f.service.approve('aip_1', actor)).resolves.toMatchObject({ replacementRequested: true });
    expect(f.supplierWorkflow.pareApprove).toHaveBeenCalledWith('aip_1', 'Maxine');
    expect(f.commercialWorkflow.requestSupplierQuotes).toHaveBeenCalledWith('evt_1', { categoryId: 'cat_av', supplierIds: ['sup_sound'] }, actor);
    expect(f.outbox.write).toHaveBeenCalledWith(
      expect.objectContaining({ recipient: 'ops@soundline.test', message: 'Hello SoundLine, our client needs audio for the gala.', idempotencyKey: 'pare-supplier-notice:aip_1' }),
      undefined,
    );
  });

  it('records the approval without contacting anyone when PARE named no replacement', async () => {
    const f = fixture({ budgetAnalysis: {}, drafts: {} });
    await expect(f.service.approve('aip_1', actor)).resolves.toMatchObject({ replacementRequested: false });
    expect(f.commercialWorkflow.requestSupplierQuotes).not.toHaveBeenCalled();
    expect(f.outbox.write).not.toHaveBeenCalled();
  });
});
