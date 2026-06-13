import { describe, expect, it, vi } from 'vitest';
import { CommercialWorkflowService } from './commercial-workflow.service';
import { WorkflowCommandService } from './workflow-command.service';

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
});
