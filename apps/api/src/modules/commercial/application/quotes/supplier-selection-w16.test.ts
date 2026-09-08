import { BadRequestException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommercialWorkflowService } from './commercial-workflow.service';

function service() {
  const prisma = {
    opsSupplierQuoteRound: { findFirst: vi.fn(async () => ({ id: 'round_1', eventId: 'evt_1', roundNumber: 1, status: 'open', category: { name: 'Technicals' }, requests: [{ quotes: [{ id: 'q_1', supplierId: 's_1', supplierName: 'Supplier One', amount: 1000, inclusions: [], paymentTerms: '', notes: '', outsideAcceptableRange: false, status: 'received' }] }] })) },
  };
  return { service: new CommercialWorkflowService(prisma as any, {} as any, {} as any, {} as any, {} as any), prisma };
}

describe('W16 supplier selection visibility', () => {
  it('denies supplier access to the PMCM comparison read model', async () => {
    const { service: workflow, prisma } = service();
    await expect(workflow.getQuoteRoundComparison('evt_1', 'round_1', 'supplier')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsSupplierQuoteRound.findFirst).not.toHaveBeenCalled();
  });

  it('returns comparison context without fabricating bid totals', async () => {
    const { service: workflow } = service();
    await expect(workflow.getQuoteRoundComparison('evt_1', 'round_1', 'pmcm-admin')).resolves.toMatchObject({
      id: 'round_1', category: 'Technicals', bids: [{ supplierName: 'Supplier One', amount: 1000 }],
    });
  });
});
