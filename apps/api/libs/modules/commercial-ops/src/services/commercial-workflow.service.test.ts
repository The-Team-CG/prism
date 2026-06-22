import { describe, expect, it, vi } from 'vitest';
import { CommercialWorkflowService } from './commercial-workflow.service';
import { WorkflowCommandService } from '@prism/modules/event-core';

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
    const auditService = { audit: vi.fn(async () => undefined) };
    const notificationOutboxService = { queue: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as any,
      auditService as any,
      notificationOutboxService as any,
      new WorkflowCommandService(),
      { resolveQuoteSupplier: vi.fn() } as any,
    );

    const selected = await service.selectSupplierQuote('evt_sample', 'quote_selected');

    expect(selected.status).toBe('selected');
    expect(quotes.find((quote) => quote.id === 'quote_other')?.status).toBe('not_selected');
    expect(quoteRequests.find((request) => request.id === 'qr_selected')?.status).toBe('selected');
    expect(quoteRequests.find((request) => request.id === 'qr_other')?.status).toBe('closed');
    expect(auditService.audit).toHaveBeenCalledWith(
      'evt_sample',
      'PMCM Admin',
      'Selected supplier quote: Sonic Line Events',
      expect.objectContaining({ affectedType: 'supplier_quote' }),
    );
    expect(notificationOutboxService.queue).toHaveBeenCalledWith(
      'evt_sample',
      'Sonic Line Events',
      'Your supplier quote was selected',
    );
  });
});
