import 'reflect-metadata';
import { describe, expect, it, vi } from 'vitest';
import { OpsQuoteRequestsController } from './quote-requests.controller';

function controllerPath(controller: Function): string {
  return Reflect.getMetadata('path', controller);
}

describe('OpsQuoteRequestsController', () => {
  it('keeps the public quote request route base stable under commercial-ops ownership', () => {
    expect(controllerPath(OpsQuoteRequestsController)).toBe('quote-requests');
  });

  it('serves supplier quote token routes through CommercialWorkflowService with supplier-safe payloads', async () => {
    const now = new Date('2026-06-20T08:00:00.000Z');
    const quote = {
      id: 'quote_sample',
      eventId: 'evt_sample',
      requestId: 'qr_sample',
      supplierId: 'sup_sample',
      categoryId: 'supcat_technicals',
      supplierName: 'SonicLine Technicals',
      category: 'Technicals',
      amount: 180000,
      inclusions: ['Audio', 'Lights'],
      paymentTerms: '50% down',
      notes: 'Valid for 15 days',
      acceptableMin: 120000,
      acceptableMax: 180000,
      outsideAcceptableRange: false,
      status: 'received',
      revisionNumber: 1,
      revisedAt: null,
      selectedAt: null,
      lockedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    const {
      acceptableMin: _acceptableMin,
      acceptableMax: _acceptableMax,
      outsideAcceptableRange: _outsideAcceptableRange,
      ...supplierQuote
    } = {
      ...quote,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      revisedAt: null,
      lockedAt: null,
    };
    const commercialWorkflowService = {
      getQuoteRequestByToken: vi.fn(async () => ({
        request: {
          id: 'qr_sample',
          eventId: 'evt_sample',
          supplierId: 'sup_sample',
          categoryId: 'supcat_technicals',
          supplierName: 'SonicLine Technicals',
          category: 'Technicals',
          message: 'Ayala Tech Summit quote request.',
          dueDate: new Date('2026-06-25T00:00:00.000Z'),
          accessToken: 'token-sample',
          confidentialBid: false,
          status: 'open',
          createdAt: now,
        },
        event: {
          id: 'evt_sample',
          eventName: 'Ayala Tech Summit',
          clientName: 'Ana Reyes',
          eventDate: new Date('2026-07-10T00:00:00.000Z'),
        },
        quote,
      })),
      submitSupplierQuoteByToken: vi.fn(async () => supplierQuote),
      reviseSupplierQuoteByToken: vi.fn(async () => ({ ...supplierQuote, amount: 175000, status: 'revised' })),
    };
    const controller = new OpsQuoteRequestsController(commercialWorkflowService as any);

    await expect(controller.getRequest('token-sample')).resolves.toMatchObject({
      eventId: 'evt_sample',
      eventName: 'Ayala Tech Summit',
      clientName: 'Ana Reyes',
      eventDate: '2026-07-10',
      quote: {
        id: 'quote_sample',
        amount: 180000,
        inclusions: ['Audio', 'Lights'],
      },
    });
    const submitted = await controller.submitQuote('token-sample', { amount: 180000, inclusions: ['Audio'] });
    const revised = await controller.reviseQuote('token-sample', { amount: 175000 });

    expect(submitted).not.toHaveProperty('acceptableMin');
    expect(submitted).not.toHaveProperty('acceptableMax');
    expect(submitted).not.toHaveProperty('outsideAcceptableRange');
    expect(revised).toMatchObject({ amount: 175000, status: 'revised' });
    expect(commercialWorkflowService.getQuoteRequestByToken).toHaveBeenCalledWith('token-sample');
    expect(commercialWorkflowService.submitSupplierQuoteByToken).toHaveBeenCalledWith('token-sample', {
      amount: 180000,
      inclusions: ['Audio'],
    });
    expect(commercialWorkflowService.reviseSupplierQuoteByToken).toHaveBeenCalledWith('token-sample', { amount: 175000 });
  });
});
