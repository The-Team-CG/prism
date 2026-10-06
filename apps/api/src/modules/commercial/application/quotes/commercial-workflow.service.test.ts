import { ForbiddenException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { CommercialWorkflowService } from './commercial-workflow.service';
import { OpsUserRole, WorkflowCommandService } from '@prism/kernel/event-core';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';

function verifiedAdminActor(): ResolvedEventOpsActor {
  return {
    id: 'user_mara',
    role: OpsUserRole.PmcmAdmin,
    email: 'mara@pmcm.test',
    name: 'Mara Santos',
    explicit: true,
    verified: true,
  };
}

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
  it.each([
    ['expired', { accessTokenExpiresAt: new Date('2000-01-01T00:00:00.000Z') }],
    ['revoked', { accessTokenRevokedAt: new Date('2026-01-01T00:00:00.000Z') }],
  ])('denies a %s quote link for viewing and for submitting or revising a quote', async (_label, window) => {
    const { service, request } = createService();
    Object.assign(request, window);

    await expect(service.getQuoteRequestByToken('token-sample')).rejects.toThrow('Quote request not found');
    await expect(service.submitSupplierQuoteByToken('token-sample', { amount: 50000 })).rejects.toThrow('Quote request not found');
    await expect(service.reviseSupplierQuoteByToken('token-sample', { amount: 60000 })).rejects.toThrow('Quote request not found');
  });

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

  it('creates requests for multiple suppliers with one bulk write and keeps supplier order', async () => {
    const suppliers = [
      { id: 'sup_a', name: 'Alpha', email: 'alpha@example.test', phone: '111', categoryId: 'cat_tech' },
      { id: 'sup_b', name: 'Bravo', email: 'bravo@example.test', phone: '222', categoryId: 'cat_tech' },
    ];
    const tx = {
      opsSupplierQuoteRound: {
        findFirst: vi.fn(async () => null),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, status: 'open' })),
      },
      opsSupplierQuoteRequest: {
        createManyAndReturn: vi.fn(async ({ data }: { data: Array<Record<string, unknown>> }) =>
          [...data].reverse().map((row) => ({ ...row, createdAt: new Date('2026-06-20T08:00:00.000Z') })),
        ),
      },
    };
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ eventName: 'Summit', clientName: 'Client' })) },
      opsSupplierCategory: { findUnique: vi.fn(async () => ({ id: 'cat_tech', name: 'Technicals' })) },
      opsSupplier: { findMany: vi.fn(async () => suppliers) },
      opsSupplierQuoteRequest: { findMany: vi.fn(async () => []) },
      $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)),
    };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as never,
      auditWriter as never,
      notificationOutboxWriter as never,
      new WorkflowCommandService(),
      {} as never,
    );

    const actor = verifiedAdminActor();
    const created = await service.requestSupplierQuotes('evt_1', { categoryId: 'cat_tech' }, actor);

    expect(tx.opsSupplierQuoteRequest.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(tx.opsSupplierQuoteRequest.createManyAndReturn.mock.calls[0][0].data).toHaveLength(2);
    expect(tx.opsSupplierQuoteRound.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ eventId: 'evt_1', categoryId: 'cat_tech', roundNumber: 1 }),
    });
    expect(created.map(({ supplierId }) => supplierId)).toEqual(['sup_a', 'sup_b']);
    expect(notificationOutboxWriter.write).toHaveBeenCalledTimes(4);
    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actor: actor.name,
      actorRole: actor.role,
      actorEmail: actor.email,
      metadata: expect.objectContaining({ actorId: actor.id }),
    }), undefined);
  });

  it('attributes manually entered supplier quotes to the verified PMCM actor', async () => {
    const actor = verifiedAdminActor();
    const auditWriter = { write: vi.fn(async () => undefined) };
    const notificationOutboxWriter = { write: vi.fn(async () => undefined) };
    const createdAt = new Date('2026-06-20T08:00:00.000Z');
    const quote = {
      id: 'quote_1',
      eventId: 'evt_1',
      requestId: null,
      supplierId: 'sup_1',
      categoryId: null,
      supplierName: 'Sonic Line Events',
      category: 'Technicals',
      amount: 1200,
      inclusions: [],
      paymentTerms: '',
      notes: '',
      acceptableMin: null,
      acceptableMax: null,
      outsideAcceptableRange: false,
      status: 'received',
      selectedAt: null,
      createdAt,
      updatedAt: createdAt,
    };
    const prisma = {
      opsEvent: { findUnique: vi.fn(async () => ({ id: 'evt_1' })) },
      opsSupplierCategory: { findUnique: vi.fn(async () => null) },
      opsSupplierQuote: { create: vi.fn(async () => quote) },
    };
    const service = new CommercialWorkflowService(
      prisma as never,
      auditWriter as never,
      notificationOutboxWriter as never,
      new WorkflowCommandService(),
      { resolveQuoteSupplier: vi.fn(async () => ({ id: 'sup_1', name: quote.supplierName, categoryId: null, category: { name: 'Technicals' } })) } as never,
    );

    await service.addSupplierQuote('evt_1', { supplierId: 'sup_1', amount: 1200 }, actor);

    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1',
      actor: actor.name,
      actorRole: actor.role,
      actorEmail: actor.email,
      metadata: expect.objectContaining({ actorId: actor.id }),
    }), undefined);
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
        createdAt: new Date('2026-06-20T08:00:00.000Z'),
        updatedAt: new Date('2026-06-20T08:00:00.000Z'),
      },
      {
        id: 'quote_other',
        eventId: 'evt_sample',
        requestId: 'qr_other',
        supplierName: 'Backup AV',
        category: 'Technicals',
        categoryId: 'cat_tech',
        status: 'received',
        createdAt: new Date('2026-06-20T08:00:00.000Z'),
        updatedAt: new Date('2026-06-20T08:00:00.000Z'),
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
      opsSupplierAvailability: {
        findUnique: vi.fn(async () => null),
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

    const actor = verifiedAdminActor();
    const selected = await service.selectSupplierQuote('evt_sample', 'quote_selected', actor);

    expect(selected.status).toBe('selected');
    expect(quotes.find((quote) => quote.id === 'quote_other')?.status).toBe('not_selected');
    expect(quoteRequests.find((request) => request.id === 'qr_selected')?.status).toBe('selected');
    expect(quoteRequests.find((request) => request.id === 'qr_other')?.status).toBe('closed');
    expect(auditWriter.write).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'evt_sample',
        actor: actor.name,
        actorRole: actor.role,
        actorEmail: actor.email,
        action: 'Selected supplier quote: Sonic Line Events',
        affectedType: 'supplier_quote',
        metadata: expect.objectContaining({ actorId: actor.id }),
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

  it.each([
    ['missing actor', undefined],
    ['unverified actor', { ...verifiedAdminActor(), verified: false }],
    ['actor without an ID', { ...verifiedAdminActor(), id: ' ' }],
    ['PMCM actor without an email', { ...verifiedAdminActor(), email: ' ' }],
    ['non-admin actor', { ...verifiedAdminActor(), role: OpsUserRole.Client }],
  ])('rejects commercial quote and availability writes for a %s before database access', async (_label, actor) => {
    const prisma = {
      opsEvent: { findUnique: vi.fn() },
      opsSupplierCategory: { findUnique: vi.fn() },
      opsSupplier: { findMany: vi.fn() },
      opsSupplierQuoteRequest: { findMany: vi.fn() },
      opsSupplierQuote: { findUnique: vi.fn() },
      opsSupplierAvailability: { upsert: vi.fn() },
      $transaction: vi.fn(),
    };
    const service = new CommercialWorkflowService(
      prisma as never,
      {} as never,
      {} as never,
      new WorkflowCommandService(),
      {} as never,
    );

    await expect(service.requestSupplierQuotes('evt_1', { categoryId: 'cat_tech' }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.addSupplierQuote('evt_1', { supplierName: 'Sonic Line Events', category: 'Technicals' }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.selectSupplierQuote('evt_1', 'quote_1', actor as never)).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.setSupplierAvailability('sup_1', { availableOn: '2026-10-01', capacity: 1 }, actor as never)).rejects.toBeInstanceOf(ForbiddenException);

    expect(prisma.opsEvent.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsSupplierCategory.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsSupplier.findMany).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuoteRequest.findMany).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.findUnique).not.toHaveBeenCalled();
    expect(prisma.opsSupplierAvailability.upsert).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('records the verified supplier availability actor ID and role in the audit', async () => {
    const actor = verifiedAdminActor();
    const result = { id: 'availability_1' };
    const tx = { opsSupplierAvailability: { upsert: vi.fn(async () => result) } };
    const prisma = { $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)) };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as never,
      auditWriter as never,
      {} as never,
      new WorkflowCommandService(),
      {} as never,
    );

    await service.setSupplierAvailability('sup_1', { availableOn: '2026-10-01', capacity: 2 }, actor);

    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      actor: actor.name,
      actorRole: actor.role,
      actorEmail: actor.email,
      metadata: expect.objectContaining({ actorId: actor.id }),
    }), expect.objectContaining({ prisma: tx, actorId: actor.id }));
  });

  it('records a verified system actor without inventing a personal email', async () => {
    const actor = { ...verifiedAdminActor(), id: 'system:commercial', name: 'Commercial System', role: OpsUserRole.System, email: undefined };
    const tx = { opsSupplierAvailability: { upsert: vi.fn(async () => ({ id: 'availability_2' })) } };
    const prisma = { $transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)) };
    const auditWriter = { write: vi.fn(async () => undefined) };
    const service = new CommercialWorkflowService(
      prisma as never,
      auditWriter as never,
      {} as never,
      new WorkflowCommandService(),
      {} as never,
    );

    await service.setSupplierAvailability('sup_1', { availableOn: '2026-10-01', capacity: 2 }, actor);

    expect(auditWriter.write).toHaveBeenCalledWith(expect.objectContaining({
      actor: actor.name,
      actorRole: OpsUserRole.System,
      actorEmail: undefined,
      metadata: expect.objectContaining({ actorId: actor.id }),
    }), expect.objectContaining({ actorId: actor.id }));
  });
});

type RevisionCapQuote = {
  id: string;
  eventId: string;
  requestId: string;
  supplierId: string | null;
  categoryId: string | null;
  supplierName: string;
  category: string;
  inclusions: string[];
  paymentTerms: string;
  notes: string;
  outsideAcceptableRange: boolean;
  status: string;
  revisionNumber: number;
  amount: number;
  acceptableMin: number | null;
  acceptableMax: number | null;
  selectedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
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
          eventId: 'evt_sample',
          supplierId: 'sup_sample',
          categoryId: 'cat_sample',
          supplierName: 'Sample Supplier',
          category: 'Technicals',
          inclusions: [],
          paymentTerms: '',
          notes: '',
          outsideAcceptableRange: false,
          selectedAt: null,
          createdAt: new Date('2026-06-20T08:00:00.000Z'),
          updatedAt: new Date('2026-06-20T08:00:00.000Z'),
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
        const timestamp = new Date('2026-06-20T08:00:00.000Z');
        return { ...data, createdAt: timestamp, updatedAt: timestamp };
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

  it('rejects revise when the quote is already selected or locked', async () => {
    const { service, quote } = createRevisionCapScenario(1);
    if (quote) quote.status = 'selected';

    await expect(service.reviseSupplierQuoteByToken('token-sample', { amount: 60000 })).rejects.toThrow(
      'Supplier quote is already locked',
    );
    expect(quote?.revisionNumber).toBe(1);
  });
});

function lastRequestStatus(prisma: { opsSupplierQuoteRequest: { update: ReturnType<typeof vi.fn> } }) {
  const calls = prisma.opsSupplierQuoteRequest.update.mock.calls;
  return (calls[calls.length - 1]?.[0] as { data: { status: string } } | undefined)?.data.status;
}
