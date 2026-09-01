import { describe, expect, it, vi } from 'vitest';
import { CommercialWorkflowService } from './commercial-workflow.service';
import { WorkflowCommandService } from '@prism/kernel/event-core';

function createService() {
  const request = {
    id: 'qr_sample',
    eventId: 'evt_sample',
    accessToken: 'token-sample',
    status: 'open',
    dueDate: new Date('2026-01-01T00:00:00.000Z'),
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
  };
  const event = {
    id: 'evt_sample',
    eventName: 'Ayala Tech Summit',
    clientName: 'Ana Reyes',
  };
  const quote = {
    id: 'quote_sample',
    requestId: 'qr_sample',
    eventId: 'evt_sample',
    supplierName: 'Sonic Line Events',
  };
  const prisma = {
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async () => request),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
    },
    opsEvent: {
      findUnique: vi.fn(async () => event),
    },
    opsSupplierQuote: {
      findFirst: vi.fn(async () => quote),
    },
  };
  const service = new CommercialWorkflowService(
    prisma as any,
    {} as any,
    {} as any,
    new WorkflowCommandService(),
    {} as any,
  );
  return { service, prisma, request, event, quote };
}

describe('CommercialWorkflowService', () => {
  it('loads quote request detail by token and expires overdue open requests', async () => {
    const { service, prisma, event, quote } = createService();

    const result = await service.getQuoteRequestByToken('token-sample');

    expect(result.event).toBe(event);
    expect(result.quote).toBe(quote);
    expect(result.request.status).toBe('expired');
    expect(prisma.opsSupplierQuoteRequest.update).toHaveBeenCalledWith({
      where: { id: 'qr_sample' },
      data: { status: 'expired' },
    });
  });
  it('selects one quote, closes competing requests, and queues PMCM side effects', async () => {
    const quotes = [
      {
        id: 'quote_selected',
        eventId: 'evt_sample',
        requestId: 'qr_selected',
        supplierName: 'Sonic Line Events',
        category: 'Technicals',
        categoryId: 'cat_tech',
        status: 'received',
      },
      {
        id: 'quote_other',
        eventId: 'evt_sample',
        requestId: 'qr_other',
        supplierName: 'Backup AV',
        category: 'Technicals',
        categoryId: 'cat_tech',
        status: 'received',
      },
    ];
    const quoteRequests = [
      { id: 'qr_selected', eventId: 'evt_sample', categoryId: 'cat_tech', status: 'submitted' },
      { id: 'qr_other', eventId: 'evt_sample', categoryId: 'cat_tech', status: 'submitted' },
    ];
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_sample' })) },
      opsSupplierQuote: {
        findUnique: vi.fn(async ({ where }) => quotes.find((quote) => quote.id === where.id) ?? null),
        updateMany: vi.fn(async ({ where, data }) => {
          for (const quote of quotes) {
            if (quote.eventId === where.eventId && quote.category === where.category && quote.id !== where.id.not) {
              Object.assign(quote, data);
            }
          }
          return { count: 1 };
        }),
        update: vi.fn(async ({ where, data }) => {
          const quote = quotes.find((item) => item.id === where.id)!;
          Object.assign(quote, data);
          return quote;
        }),
      },
      opsSupplierQuoteRequest: {
        update: vi.fn(async ({ where, data }) => {
          const request = quoteRequests.find((item) => item.id === where.id)!;
          Object.assign(request, data);
          return request;
        }),
        updateMany: vi.fn(async ({ where, data }) => {
          for (const request of quoteRequests) {
            if (request.eventId === where.eventId && request.categoryId === where.categoryId && request.id !== where.id.not) {
              Object.assign(request, data);
            }
          }
          return { count: 1 };
        }),
      },
      $transaction: vi.fn(async (callback) => callback(prisma)),
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as any,
      auditWriter as any,
      notificationOutboxWriter as any,
      new WorkflowCommandService(),
      { resolveQuoteSupplier: vi.fn() } as any,
    );

    const selected = await service.selectSupplierQuote('evt_sample', 'quote_selected');

    expect(selected.status).toBe('selected');
    expect(quotes.find((quote) => quote.id === 'quote_other')?.status).toBe('not_selected');
    expect(quoteRequests.find((request) => request.id === 'qr_selected')?.status).toBe('selected');
    expect(quoteRequests.find((request) => request.id === 'qr_other')?.status).toBe('closed');
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: 'PMCM Admin',
        action: 'Selected supplier quote: Sonic Line Events',
        affectedType: 'supplier_quote',
      }),
      undefined,
    );
    expect(notificationOutboxWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        recipient: 'Sonic Line Events',
        message: 'Your supplier quote was selected',
      }),
      undefined,
    );
  });
});

type RevisionCapQuote = {
  id: string;
  requestId: string;
  status: string;
  revisionNumber: number;
  amount: number;
  acceptableMin: number | null;
  acceptableMax: number | null;
};

/**
 * Builds a token-portal scenario for the AC4 revision cap.
 *
 * Pass `null` to model a request that has no quote row yet (first submission);
 * pass a number to model an existing quote already at that revisionNumber.
 */
function createRevisionCapScenario(revisionNumber: number | null) {
  const request = {
    id: 'qr_sample',
    eventId: 'evt_sample',
    accessToken: 'token-sample',
    status: revisionNumber === null ? 'open' : 'revised',
    dueDate: null,
    categoryId: null,
    supplierId: null,
    supplierName: 'Sonic Line Events',
    category: 'Technicals',
  };
  const quote: RevisionCapQuote | null =
    revisionNumber === null
      ? null
      : {
          id: 'quote_sample',
          requestId: 'qr_sample',
          status: 'revised',
          revisionNumber,
          amount: 50000,
          acceptableMin: null,
          acceptableMax: null,
        };
  const created: Record<string, unknown>[] = [];
  const prisma = {
    opsSupplierQuoteRequest: {
      findUnique: vi.fn(async () => request),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => Object.assign(request, data)),
    },
    opsSupplierQuote: {
      findFirst: vi.fn(async () => quote),
      // Mirrors Prisma updateMany: the `where` predicate is re-evaluated at write
      // time, so a caller holding a stale read matches zero rows once the cap is
      // reached. This is what makes the concurrency assertion below meaningful.
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: { revisionNumber?: { lt: number } };
          data: Record<string, unknown> & { revisionNumber?: { increment: number } };
        }) => {
          if (!quote) return { count: 0 };
          const cap = where.revisionNumber?.lt;
          if (cap !== undefined && quote.revisionNumber >= cap) return { count: 0 };
          const { revisionNumber: bump, ...rest } = data;
          Object.assign(quote, rest);
          if (bump?.increment) quote.revisionNumber += bump.increment;
          return { count: 1 };
        },
      ),
      findUniqueOrThrow: vi.fn(async () => quote),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        created.push(data);
        return data;
      }),
    },
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
  };
  const auditWriter = { write: vi.fn(async () => undefined) };
  const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
  const service = new CommercialWorkflowService(
    prisma as any,
    auditWriter as any,
    notificationOutboxWriter as any,
    new WorkflowCommandService(),
    {} as any,
  );
  return { service, prisma, request, quote, created };
}

describe('CommercialWorkflowService revision cap (PA-268, EP-07-S02 AC4)', () => {
  it('allows a first submission when no quote row exists yet', async () => {
    const { service, prisma, created } = createRevisionCapScenario(null);

    const result = await service.submitSupplierQuoteByToken('token-sample', { amount: 50000 });

    expect(prisma.opsSupplierQuote.create).toHaveBeenCalledTimes(1);
    expect(created).toHaveLength(1);
    expect(created[0].revisionNumber).toBe(1);
    expect(result.revisionNumber).toBe(1);
    expect(lastRequestStatus(prisma)).toBe('submitted');
  });

  it('blocks a second revision via the revise-mode entry point once revisionNumber is already 2', async () => {
    const { service, quote } = createRevisionCapScenario(2);

    await expect(service.reviseSupplierQuoteByToken('token-sample', { amount: 60000 })).rejects.toThrow(
      'Quote has already been revised and cannot be revised again.',
    );
    expect(quote?.revisionNumber).toBe(2);
  });

  it('blocks a second revision via the submit-mode entry point once revisionNumber is already 2', async () => {
    const { service, quote } = createRevisionCapScenario(2);

    await expect(service.submitSupplierQuoteByToken('token-sample', { amount: 60000 })).rejects.toThrow(
      'Quote has already been revised and cannot be revised again.',
    );
    expect(quote?.revisionNumber).toBe(2);
  });

  it('still allows the first revision when revisionNumber is 1', async () => {
    const { service, quote } = createRevisionCapScenario(1);

    const result = await service.reviseSupplierQuoteByToken('token-sample', { amount: 60000 });

    expect(result.revisionNumber).toBe(2);
    expect(quote?.revisionNumber).toBe(2);
  });

  it('accepts only one of two concurrent revisions instead of letting the loser overwrite', async () => {
    const { service, prisma, quote } = createRevisionCapScenario(1);

    const outcomes = await Promise.allSettled([
      service.reviseSupplierQuoteByToken('token-sample', { amount: 60000 }),
      service.reviseSupplierQuoteByToken('token-sample', { amount: 70000 }),
    ]);

    const rejected = outcomes.filter((o) => o.status === 'rejected');
    expect(outcomes.filter((o) => o.status === 'fulfilled')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(quote?.revisionNumber).toBe(2);

    // Both callers cleared the validateState guard on a stale read (each saw
    // revisionNumber 1), so both reached the write. Proving updateMany ran twice
    // is what shows the compare-and-swap — not the earlier guard — rejected the
    // loser; without it this test would pass even with a plain update().
    expect(prisma.opsSupplierQuote.updateMany).toHaveBeenCalledTimes(2);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      message: 'Quote has already been revised and cannot be revised again.',
    });
  });
});

function lastRequestStatus(prisma: { opsSupplierQuoteRequest: { update: ReturnType<typeof vi.fn> } }) {
  const calls = prisma.opsSupplierQuoteRequest.update.mock.calls;
  return (calls[calls.length - 1]?.[0] as { data: { status: string } } | undefined)?.data.status;
}
