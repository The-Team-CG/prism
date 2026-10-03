import { BadRequestException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { describe, expect, it, vi } from 'vitest';
import { CommercialAddendumImpactService } from './commercial-addendum-impact.service';

function createService() {
  const source = {
    id: 'billing_source_1',
    eventId: 'evt_addendum',
    status: 'approved',
    totalAmount: 100_000,
    lineItems: [{ label: 'Package', amount: 100_000 }],
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
  };
  const quote = { id: 'quote_1', eventId: 'evt_addendum', status: 'selected', amount: 25_000 };
  const prisma = {
    opsBillingSource: {
      findFirst: vi.fn(async () => ({ ...source, lineItems: [...source.lineItems] })),
      update: vi.fn(async ({ data }) => {
        Object.assign(source, data);
        return { ...source, lineItems: [...source.lineItems] };
      }),
    },
    opsSupplierQuote: {
      findFirst: vi.fn(async ({ where }) => where.id === quote.id ? { ...quote } : null),
      update: vi.fn(async ({ data }) => Object.assign(quote, data) && { ...quote }),
    },
  };
  const service = new CommercialAddendumImpactService();
  const transaction = { prisma, correlationId: 'addendum_1' } as unknown as PrismTransactionContext;
  return { service, source, quote, prisma, transaction };
}

describe('CommercialAddendumImpactService', () => {
  it('owns the billing-source and selected-quote writes and returns Lifecycle impact facts', async () => {
    const { service, source, quote, prisma, transaction } = createService();

    const impacts = await service.apply({
      eventId: 'evt_addendum',
      versionNumber: 2,
      financialDelta: 5_000,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 30_000 }],
    }, transaction);

    expect(source).toMatchObject({ totalAmount: 105_000 });
    expect(source.lineItems).toEqual([
      { label: 'Package', amount: 100_000 },
      { label: 'Addendum v2 scope change', amount: 5_000 },
    ]);
    expect(quote.amount).toBe(30_000);
    expect(prisma.opsBillingSource.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt_addendum', status: 'approved' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    expect(impacts).toEqual([
      {
        targetType: 'billing_source',
        targetId: 'billing_source_1',
        beforeValue: { totalAmount: 100_000, lineItems: [{ label: 'Package', amount: 100_000 }] },
        afterValue: { totalAmount: 105_000, lineItems: source.lineItems },
        deltaAmount: 5_000,
      },
      {
        targetType: 'supplier_quote',
        targetId: 'quote_1',
        beforeValue: { amount: 25_000, status: 'selected' },
        afterValue: { amount: 30_000, status: 'selected' },
        deltaAmount: 5_000,
      },
    ]);
  });

  it('rejects a financial addendum when no approved source exists', async () => {
    const { service, prisma, transaction } = createService();
    prisma.opsBillingSource.findFirst.mockResolvedValue(null as never);

    await expect(service.apply({
      eventId: 'evt_addendum',
      versionNumber: 1,
      financialDelta: 1,
      quotePriceChanges: [],
    }, transaction)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
  });

  it('skips missing and unchanged quote prices when there is no financial delta', async () => {
    const { service, prisma, transaction } = createService();

    const impacts = await service.apply({
      eventId: 'evt_addendum',
      versionNumber: 1,
      financialDelta: 0,
      quotePriceChanges: [
        { quoteId: 'quote_missing', amount: 40_000 },
        { quoteId: 'quote_1', amount: 25_000 },
      ],
    }, transaction);

    expect(impacts).toEqual([]);
    expect(prisma.opsBillingSource.findFirst).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.update).not.toHaveBeenCalled();
  });
});
