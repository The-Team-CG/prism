import { describe, expect, it, vi } from 'vitest';
import { OpsUserRole } from '../ops.constants';
import { EventAccessPolicyService } from './event-access-policy.service';
import { EventReadModelsService } from './event-read-models.service';

function createSupplierWorkspaceService() {
  const requests = [
    {
      id: 'qr_visible',
      eventId: 'evt_visible',
      supplierId: 'sup_sonicline',
      supplierName: 'Sonic Line Events',
      dueDate: null,
      status: 'open',
    },
    {
      id: 'qr_archived',
      eventId: 'evt_archived',
      supplierId: 'sup_sonicline',
      supplierName: 'Sonic Line Events',
      dueDate: null,
      status: 'open',
    },
  ];
  const quotes = [
    { id: 'quote_visible', eventId: 'evt_visible', supplierId: 'sup_sonicline' },
    { id: 'quote_archived', eventId: 'evt_archived', supplierId: 'sup_sonicline' },
  ];
  const prisma = {
    opsSupplierQuoteRequest: {
      findMany: vi.fn(async () => requests),
    },
    opsSupplierQuote: {
      findMany: vi.fn(async () => quotes),
    },
    opsEvent: {
      findMany: vi.fn(async () => [
        { id: 'evt_visible', clientName: 'Ana Reyes', clientPortalStatus: 'unlocked', archived: false },
      ]),
    },
  };
  const policy = new EventAccessPolicyService({ audit: vi.fn() } as any);
  const suppliersService = {
    listSuppliers: vi.fn(async () => [
      {
        id: 'sup_sonicline',
        name: 'Sonic Line Events',
        email: 'supplier@example.com',
        reviews: [],
        reliabilityNotes: [],
        performanceNotes: '',
        aggregateRating: null,
        lastEventDate: null,
        pastEvents: [],
      },
    ]),
  };
  const service = new EventReadModelsService(prisma as any, policy, suppliersService as any);
  return { service, prisma, policy };
}

describe('EventReadModelsService', () => {
  it('filters supplier workspace records through event visibility policy', async () => {
    const { service, policy, prisma } = createSupplierWorkspaceService();
    const actor = policy.resolveActor({
      actorRole: OpsUserRole.Supplier,
      supplierId: 'sup_sonicline',
      actorEmail: 'supplier@example.com',
    });

    const workspace = await service.supplierWorkspace(actor, {
      mapSupplierQuoteRequest: (request) => ({ id: request.id, eventId: request.eventId }),
      mapSupplierQuoteForSupplier: (quote) => ({ id: quote.id, eventId: quote.eventId }),
    });

    expect((workspace as any).quoteRequests).toEqual([{ id: 'qr_visible', eventId: 'evt_visible' }]);
    expect((workspace as any).supplierQuotes).toEqual([{ id: 'quote_visible', eventId: 'evt_visible' }]);
    expect(prisma.opsEvent.findMany).toHaveBeenCalledWith({
      where: { id: { in: ['evt_visible', 'evt_archived'] }, archived: false },
    });
  });
});
