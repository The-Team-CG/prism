import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { issueAddendumSchema } from '@prism/types';
import type { CommercialAddendumImpactWriter } from '@prism/contexts/commercial';
import { ChangeManagementService, compareSnapshots } from './change-management.service';

describe('W26 deterministic snapshot comparison', () => {
  it('sorts keys and ignores object property order', () => {
    expect(compareSnapshots([{ id: 'quote-1', amount: 100, note: 'same' }], [{ note: 'same', amount: 125, id: 'quote-1' }])).toEqual([
      { key: 'quote-1', before: { id: 'quote-1', amount: 100, note: 'same' }, after: { note: 'same', amount: 125, id: 'quote-1' } },
    ]);
  });

  it('records additions and removals in deterministic key order', () => {
    expect(compareSnapshots([{ id: 'b', amount: 20 }, { id: 'a', amount: 10 }], [{ id: 'c', amount: 30 }])).toEqual([
      { key: 'a', before: { id: 'a', amount: 10 }, after: null },
      { key: 'b', before: { id: 'b', amount: 20 }, after: null },
      { key: 'c', before: null, after: { id: 'c', amount: 30 } },
    ]);
  });
});

describe('ChangeManagementService Commercial ownership', () => {
  it('delegates billing and selected-quote writes while Lifecycle records returned impact history', async () => {
    const impacts = [
      {
        targetType: 'billing_source' as const,
        targetId: 'billing_source_1',
        beforeValue: { totalAmount: 100, lineItems: [] },
        afterValue: { totalAmount: 110, lineItems: [{ label: 'Addendum v1 scope change', amount: 10 }] },
        deltaAmount: 10,
      },
      {
        targetType: 'supplier_quote' as const,
        targetId: 'quote_1',
        beforeValue: { amount: 20, status: 'selected' },
        afterValue: { amount: 25, status: 'selected' },
        deltaAmount: 5,
      },
    ];
    const prisma = {
      opsEvent: { findUnique: async () => ({ id: 'evt_addendum', archived: false, freezeStatus: 'open' }) },
      opsDocument: { findFirst: async () => ({ id: 'doc_addendum', eventId: 'evt_addendum' }) },
      opsEventFreezeException: { findFirst: async () => null },
      opsAddendum: {
        findFirst: async () => null,
        create: async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          documentState: 'pending',
          signatureMethod: 'scanned_document',
          issuedAt: new Date('2026-10-04T00:00:00.000Z'),
        }),
      },
      opsAddendumImpact: { createMany: vi.fn(async ({ data }: { data: Record<string, unknown>[] }) => ({ count: data.length })) },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const commercialWriter: CommercialAddendumImpactWriter = { apply: vi.fn(async () => impacts) };
    const access = { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined };
    const audit = { write: async () => undefined };
    const service = new ChangeManagementService(
      prisma as unknown as PrismaService,
      access as unknown as EventAccessPolicyService,
      audit as unknown as AuditWriter,
      commercialWriter,
    );
    const input = issueAddendumSchema.parse({
      title: 'Revised scope',
      documentId: 'doc_addendum',
      contractSnapshot: [],
      quoteSnapshot: [{ id: 'quote_1', amount: 25 }],
      financialDelta: 10,
    });
    const actor = { id: 'user_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor;

    const result = await service.issueAddendum('evt_addendum', input, actor);

    expect(result).toMatchObject({ eventId: 'evt_addendum', versionNumber: 1, financialDelta: 10 });
    expect(commercialWriter.apply).toHaveBeenCalledWith({
      eventId: 'evt_addendum',
      versionNumber: 1,
      financialDelta: 10,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 25 }],
    }, expect.objectContaining({ correlationId: result.id, prisma: expect.anything() }));
    expect(prisma.opsAddendumImpact.createMany).toHaveBeenCalledTimes(1);
    expect(prisma.opsAddendumImpact.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ targetType: 'billing_source', targetId: 'billing_source_1', deltaAmount: 10 }),
        expect.objectContaining({ targetType: 'supplier_quote', targetId: 'quote_1', deltaAmount: 5 }),
      ]),
    });
  });
});

describe('ChangeManagementService freeze exception register', () => {
  const pmcm = { id: 'user_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor;

  function registerService(role: 'allowed' | 'denied') {
    const findMany = vi.fn(async () => [{
      id: 'freeze_ex_1', eventId: 'evt_1', requestedChange: 'Add stage lighting', reason: 'Client request', status: 'pending',
      requestedBy: 'PMCM Admin', decidedBy: null, decisionNote: null, requestedAt: new Date('2026-10-10T00:00:00.000Z'), decidedAt: null,
    }]);
    const prisma = {
      opsEvent: { findUnique: async () => ({ id: 'evt_1' }) },
      opsEventFreezeException: { findMany },
    };
    const access = {
      requireActorRole: vi.fn(async () => {
        if (role === 'denied') throw new ForbiddenException();
      }),
      requireCanReadEvent: async () => undefined,
    };
    const service = new ChangeManagementService(
      prisma as unknown as PrismaService,
      access as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );
    return { service, findMany, access };
  }

  it('returns the exception register to PMCM actors with reasons and decision state', async () => {
    const { service, access } = registerService('allowed');

    await expect(service.listFreezeExceptions('evt_1', pmcm)).resolves.toEqual([
      expect.objectContaining({ id: 'freeze_ex_1', status: 'pending', reason: 'Client request', requestedAt: '2026-10-10T00:00:00.000Z' }),
    ]);
    expect(access.requireActorRole).toHaveBeenCalledWith(pmcm, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'freeze exception register', 'evt_1');
  });

  it('keeps the register away from client and coordinator actors without reading exceptions', async () => {
    const { service, findMany } = registerService('denied');

    await expect(service.listFreezeExceptions('evt_1', { ...pmcm, role: OpsUserRole.Client } as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});

describe('ChangeManagementService approval single-use', () => {
  const pmcm = { id: 'user_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor;

  it('rejects a second addendum that reuses an approved freeze exception', async () => {
    // Stateful exception row: the first conditional consume wins, every later one matches nothing.
    const exception = { id: 'freeze_ex_1', eventId: 'evt_addendum', status: 'approved', consumedAt: null as Date | null };
    const prisma = {
      opsEvent: { findUnique: async () => ({ id: 'evt_addendum', archived: false, freezeStatus: 'frozen' }) },
      opsDocument: { findFirst: async () => ({ id: 'doc_addendum', eventId: 'evt_addendum' }) },
      opsEventFreezeException: {
        updateMany: vi.fn(async ({ where }: { where: { id: string; eventId: string; status: string; consumedAt: null } }) => {
          if (where.id !== exception.id || where.eventId !== exception.eventId || where.status !== exception.status || exception.consumedAt) return { count: 0 };
          exception.consumedAt = new Date('2026-10-18T00:00:00.000Z');
          return { count: 1 };
        }),
      },
      opsAddendum: {
        findFirst: async () => null,
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data, documentState: 'pending', signatureMethod: 'scanned_document', issuedAt: new Date('2026-10-18T00:00:00.000Z') })),
      },
      opsAddendumImpact: { createMany: vi.fn(async () => ({ count: 0 })) },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const service = new ChangeManagementService(
      prisma as unknown as PrismaService,
      { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined } as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );
    const input = issueAddendumSchema.parse({ title: 'Scope change', documentId: 'doc_addendum', contractSnapshot: [], quoteSnapshot: [], freezeExceptionId: 'freeze_ex_1' });

    await expect(service.issueAddendum('evt_addendum', input, pmcm)).resolves.toMatchObject({ versionNumber: 1 });
    await expect(service.issueAddendum('evt_addendum', input, pmcm)).rejects.toThrow('Freeze exception is not an unused approval for this event');
    expect(prisma.opsAddendum.create).toHaveBeenCalledTimes(1);
  });
});

describe('ChangeManagementService client change requests', () => {
  const client = { id: 'user_client', role: OpsUserRole.Client, name: 'Client Contact', explicit: true } satisfies ResolvedEventOpsActor;
  const row = {
    id: 'freeze_ex_1', eventId: 'evt_1', requestedChange: 'Add stage lighting', reason: 'Internal: venue cost overrun', status: 'rejected',
    requestedBy: 'PMCM Admin', decidedBy: 'PMCM Admin', decisionNote: 'Internal: insurance not covered', requestedAt: new Date('2026-10-10T00:00:00.000Z'), decidedAt: new Date('2026-10-12T00:00:00.000Z'), consumedAt: null,
  };

  it('shows clients only the requested change, a neutral status, and an update time', async () => {
    const service = new ChangeManagementService(
      { opsEvent: { findUniqueOrThrow: async () => ({ id: 'evt_1' }) }, opsEventFreezeException: { findMany: async () => [row] } } as unknown as PrismaService,
      { requireCanReadEvent: async () => undefined } as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );

    const requests = await service.listClientChangeRequests('evt_1', client);

    expect(requests).toEqual([{ id: 'freeze_ex_1', requestedChange: 'Add stage lighting', status: 'not_approved', updatedAt: '2026-10-12T00:00:00.000Z' }]);
    // Redaction: no internal reason, decision note, or PMCM actor identity may appear anywhere in the client payload.
    const serialized = JSON.stringify(requests);
    expect(serialized).not.toContain('venue cost overrun');
    expect(serialized).not.toContain('insurance not covered');
    expect(serialized).not.toContain('PMCM Admin');
  });

  it('denies change request status to actors who cannot read the event, before reading any exception', async () => {
    const findMany = vi.fn(async () => [row]);
    const service = new ChangeManagementService(
      { opsEvent: { findUniqueOrThrow: async () => ({ id: 'evt_other' }) }, opsEventFreezeException: { findMany } } as unknown as PrismaService,
      { requireCanReadEvent: async () => { throw new ForbiddenException(); } } as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );

    await expect(service.listClientChangeRequests('evt_1', { ...client, id: 'other_client' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(findMany).not.toHaveBeenCalled();
  });
});
