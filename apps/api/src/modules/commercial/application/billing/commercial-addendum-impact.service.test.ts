import { BadRequestException, ConflictException } from '@nestjs/common';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import type { AddendumPlannedImpacts } from '@prism/types';
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
      findFirst: vi.fn(async ({ where }: { where: { id?: string; eventId: string; status: string } }) =>
        (where.id === undefined || where.id === source.id) && where.eventId === source.eventId && where.status === source.status
          ? { ...source, lineItems: [...source.lineItems] }
          : null),
      update: vi.fn(async ({ data }) => {
        Object.assign(source, data);
        return { ...source, lineItems: [...source.lineItems] };
      }),
    },
    opsSupplierQuote: {
      findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string; status: string } }) =>
        where.id === quote.id && where.eventId === quote.eventId && where.status === quote.status
          ? { ...quote }
          : null,
      ),
      update: vi.fn(async ({ data }) => Object.assign(quote, data) && { ...quote }),
    },
  };
  const service = new CommercialAddendumImpactService();
  const transaction = { prisma, correlationId: 'addendum_1' } as unknown as PrismTransactionContext;
  return { service, source, quote, prisma, transaction };
}

const plan: AddendumPlannedImpacts = {
  financialDelta: 5_000,
  billing: {
    billingSourceId: 'billing_source_1',
    baselineTotalAmount: 100_000,
    baselineLineItems: [{ label: 'Package', amount: 100_000 }],
  },
  quotes: [{ quoteId: 'quote_1', baselineAmount: 25_000, targetAmount: 30_000 }],
};

describe('CommercialAddendumImpactService preview', () => {
  it('plans the approved billing source and selected quote baselines without writing anything', async () => {
    const { service, source, quote, prisma, transaction } = createService();

    const planned = await service.preview({
      eventId: 'evt_addendum',
      financialDelta: 5_000,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 30_000 }],
    }, transaction);

    expect(planned).toEqual(plan);
    expect(prisma.opsBillingSource.findFirst).toHaveBeenCalledWith({
      where: { eventId: 'evt_addendum', status: 'approved' },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    });
    expect(source).toMatchObject({ totalAmount: 100_000 });
    expect(quote.amount).toBe(25_000);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.update).not.toHaveBeenCalled();
  });

  it('rejects a financial addendum when no approved source exists', async () => {
    const { service, prisma, transaction } = createService();
    prisma.opsBillingSource.findFirst.mockResolvedValue(null as never);

    await expect(service.preview({
      eventId: 'evt_addendum',
      financialDelta: 1,
      quotePriceChanges: [],
    }, transaction)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('plans no billing and skips missing or unchanged quotes when there is no financial delta', async () => {
    const { service, prisma, transaction } = createService();

    const planned = await service.preview({
      eventId: 'evt_addendum',
      financialDelta: 0,
      quotePriceChanges: [
        { quoteId: 'quote_missing', amount: 40_000 },
        { quoteId: 'quote_1', amount: 25_000 },
      ],
    }, transaction);

    expect(planned).toEqual({ financialDelta: 0, billing: null, quotes: [] });
    expect(prisma.opsBillingSource.findFirst).not.toHaveBeenCalled();
  });

  it('does not plan a quote from another event or with a non-selected status', async () => {
    const { service, quote, transaction } = createService();
    quote.eventId = 'evt_other';
    quote.status = 'submitted';

    const planned = await service.preview({
      eventId: 'evt_addendum',
      financialDelta: 0,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 30_000 }],
    }, transaction);

    expect(planned.quotes).toEqual([]);
  });
});

describe('CommercialAddendumImpactService apply', () => {
  it('writes the stored plan once: billing total and line, selected quote amount, and returned impacts', async () => {
    const { service, source, quote, transaction } = createService();

    const impacts = await service.apply({ eventId: 'evt_addendum', addendumId: 'addendum_1', versionNumber: 2, plan }, transaction);

    expect(source).toMatchObject({ totalAmount: 105_000 });
    expect(source.lineItems).toEqual([
      { label: 'Package', amount: 100_000 },
      { label: 'Addendum v2 scope change', amount: 5_000, addendumId: 'addendum_1' },
    ]);
    expect(quote.amount).toBe(30_000);
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

  it('writes nothing and conflicts when billing changed after the plan was issued', async () => {
    const { service, source, quote, prisma, transaction } = createService();
    source.totalAmount = 110_000;

    await expect(service.apply({ eventId: 'evt_addendum', addendumId: 'addendum_1', versionNumber: 2, plan }, transaction)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.update).not.toHaveBeenCalled();
    expect(quote.amount).toBe(25_000);
  });

  it('writes nothing and conflicts when the billing source is no longer approved', async () => {
    const { service, source, prisma, transaction } = createService();
    source.status = 'draft';

    await expect(service.apply({ eventId: 'evt_addendum', addendumId: 'addendum_1', versionNumber: 2, plan }, transaction)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
  });

  it('writes nothing and conflicts when a planned selected quote changed after the plan was issued', async () => {
    const { service, source, quote, prisma, transaction } = createService();
    quote.amount = 26_000;

    await expect(service.apply({ eventId: 'evt_addendum', addendumId: 'addendum_1', versionNumber: 2, plan }, transaction)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.update).not.toHaveBeenCalled();
    expect(source.totalAmount).toBe(100_000);
  });
});

describe('CommercialAddendumImpactService conforme trace', () => {
  const digest = 'a'.repeat(64);
  const executed = {
    eventId: 'evt_addendum',
    addendumId: 'addendum_1',
    billingSourceId: 'billing_source_1',
    versionNumber: 2,
    executionId: 'acx_1',
    documentSha256: digest,
    executedAt: '2026-10-19T09:00:00.000Z',
  };

  function tracedService(lineItems: unknown[]) {
    const source = { id: 'billing_source_1', eventId: 'evt_addendum', totalAmount: 105_000, lineItems, updatedAt: new Date() };
    const prisma = {
      opsBillingSource: {
        findFirst: vi.fn(async ({ where }: { where: { id: string; eventId: string } }) =>
          where.id === source.id && where.eventId === source.eventId ? { ...source } : null),
        update: vi.fn(async ({ data }) => Object.assign(source, data)),
      },
    };
    const transaction = { prisma, correlationId: 'addendum_1' } as unknown as PrismTransactionContext;
    return { service: new CommercialAddendumImpactService(), source, prisma, transaction };
  }

  it('stamps only the line carrying this addendum id, leaves amounts alone, and treats a replay as a no-op', async () => {
    const { service, source, prisma, transaction } = tracedService([
      { label: 'Package', amount: 100_000 },
      { label: 'Addendum v2 scope change', amount: 5_000, addendumId: 'addendum_1' },
      // Same label, different addendum: a label match would wrongly stamp this line too.
      { label: 'Addendum v2 scope change', amount: 1_000, addendumId: 'addendum_2' },
    ]);

    await expect(service.recordConformeExecution(executed, transaction)).resolves.toEqual({ billingSourceId: 'billing_source_1' });
    await service.recordConformeExecution(executed, transaction);

    expect(source.totalAmount).toBe(105_000);
    expect(source.lineItems).toEqual([
      { label: 'Package', amount: 100_000 },
      {
        label: 'Addendum v2 scope change',
        amount: 5_000,
        addendumId: 'addendum_1',
        addendumConforme: { executionId: 'acx_1', addendumId: 'addendum_1', versionNumber: 2, documentSha256: digest, executedAt: '2026-10-19T09:00:00.000Z' },
      },
      { label: 'Addendum v2 scope change', amount: 1_000, addendumId: 'addendum_2' },
    ]);
    expect(prisma.opsBillingSource.update).toHaveBeenCalledTimes(1);
  });

  it('refuses to rebind a line already traced to a different execution', async () => {
    const { service, prisma, transaction } = tracedService([
      {
        label: 'Addendum v2 scope change',
        amount: 5_000,
        addendumId: 'addendum_1',
        addendumConforme: { executionId: 'acx_old', addendumId: 'addendum_1', versionNumber: 2, documentSha256: digest, executedAt: '2026-10-18T09:00:00.000Z' },
      },
    ]);

    await expect(service.recordConformeExecution(executed, transaction)).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
  });

  it('does not trace label-only lines or a billing source that belongs to another event', async () => {
    const legacy = tracedService([{ label: 'Addendum v2 scope change', amount: 5_000 }]);
    await expect(legacy.service.recordConformeExecution(executed, legacy.transaction)).resolves.toBeNull();

    const traced = tracedService([{ label: 'Addendum v2 scope change', amount: 5_000, addendumId: 'addendum_1' }]);
    await expect(traced.service.recordConformeExecution({ ...executed, eventId: 'evt_other' }, traced.transaction)).resolves.toBeNull();

    expect(legacy.prisma.opsBillingSource.update).not.toHaveBeenCalled();
    expect(traced.prisma.opsBillingSource.update).not.toHaveBeenCalled();
  });
});
