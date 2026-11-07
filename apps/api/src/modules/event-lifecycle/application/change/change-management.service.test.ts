import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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

describe('ChangeManagementService automatic freeze', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T00:00:00.000Z'));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const event = (overrides: Record<string, unknown>) => ({
    id: 'evt_a',
    eventDate: new Date('2026-10-10T00:00:00.000Z'),
    freezeStatus: 'open',
    archived: false,
    actualEndedAt: null,
    ...overrides,
  });

  function setup(events: Array<ReturnType<typeof event>>, updateCount = 1) {
    const updateMany = vi.fn(async () => ({ count: updateCount }));
    const audit = vi.fn(async () => undefined);
    const prisma = {
      opsEvent: { findMany: vi.fn(async () => events), updateMany },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const service = new ChangeManagementService(prisma as never, {} as never, { write: audit } as unknown as AuditWriter, {} as never);
    return { service, updateMany, audit };
  }

  it('freezes only events that reached five days before the event day and audits it as the system', async () => {
    const { service, updateMany, audit } = setup([
      event({ id: 'evt_due' }),
      event({ id: 'evt_early', eventDate: new Date('2026-10-20T00:00:00.000Z') }),
    ]);

    await expect(service.freezeEventsDue(new Date('2026-10-06T00:00:00.000Z'))).resolves.toEqual({ frozen: 1 });

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'evt_due', freezeStatus: 'open', archived: false },
      data: expect.objectContaining({ freezeStatus: 'frozen', freezeReason: 'Automatic scope freeze 5 days before the event' }),
    }));
    expect(audit).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'evt_due', actor: 'System', actorRole: OpsUserRole.System, metadata: expect.objectContaining({ automatic: true }) }),
      expect.anything(),
    );
  });

  it('does not freeze an event before Manila midnight five days ahead', async () => {
    const { service, updateMany } = setup([event({ id: 'evt_edge' })]);

    await expect(service.freezeEventsDue(new Date('2026-10-04T15:59:00.000Z'))).resolves.toEqual({ frozen: 0 });
    expect(updateMany).not.toHaveBeenCalled();
    await expect(service.freezeEventsDue(new Date('2026-10-04T16:00:00.000Z'))).resolves.toEqual({ frozen: 1 });
  });

  it('writes no audit and counts nothing when a manual freeze got there first', async () => {
    const { service, audit } = setup([event({ id: 'evt_due' })], 0);

    await expect(service.freezeEventsDue(new Date('2026-10-06T00:00:00.000Z'))).resolves.toEqual({ frozen: 0 });
    expect(audit).not.toHaveBeenCalled();
  });
});

describe('ChangeManagementService Commercial ownership', () => {
  it('issues a pending addendum that stores its planned effect and touches no billing or quote row', async () => {
    const plan = {
      financialDelta: 10,
      billing: { billingSourceId: 'billing_source_1', baselineTotalAmount: 100, baselineLineItems: [] },
      quotes: [{ quoteId: 'quote_1', baselineAmount: 20, targetAmount: 25 }],
    };
    const prisma = {
      opsEvent: { findUnique: async () => ({ id: 'evt_addendum', archived: false, freezeStatus: 'open' }) },
      opsDocument: { findFirst: async () => ({ id: 'doc_addendum', eventId: 'evt_addendum' }) },
      opsEventFreezeException: { findFirst: async () => null, updateMany: vi.fn() },
      opsAddendum: {
        findFirst: async () => null,
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...data,
          documentState: 'pending',
          issuedAt: new Date('2026-10-04T00:00:00.000Z'),
          effectiveAt: null,
          withdrawnAt: null,
          withdrawalReason: null,
          plannedImpacts: data.plannedImpacts,
        })),
      },
      opsBillingSource: { findFirst: vi.fn(), update: vi.fn() },
      opsSupplierQuote: { findFirst: vi.fn(), update: vi.fn() },
      opsAddendumImpact: { createMany: vi.fn(async () => ({ count: 0 })) },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const commercialWriter: CommercialAddendumImpactWriter = {
      preview: vi.fn(async () => plan),
      apply: vi.fn(async () => []),
      recordConformeExecution: vi.fn(async () => null),
    };
    const access = { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined };
    const auditWrite = vi.fn(async () => undefined);
    const audit = { write: auditWrite };
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

    expect(result).toMatchObject({ eventId: 'evt_addendum', versionNumber: 1, financialDelta: 10, status: 'pending', effectiveAt: null, plannedImpacts: plan });
    // Issuing only plans: the commercial writer is asked to preview, never to apply, and no impact row exists yet.
    expect(commercialWriter.preview).toHaveBeenCalledWith({
      eventId: 'evt_addendum',
      financialDelta: 10,
      quotePriceChanges: [{ quoteId: 'quote_1', amount: 25 }],
    }, expect.objectContaining({ correlationId: 'evt_addendum', prisma: expect.anything() }));
    expect(commercialWriter.apply).not.toHaveBeenCalled();
    expect(prisma.opsBillingSource.update).not.toHaveBeenCalled();
    expect(prisma.opsSupplierQuote.update).not.toHaveBeenCalled();
    expect(prisma.opsAddendumImpact.createMany).not.toHaveBeenCalled();
    // The issuance audit entry is readable through client workspaces, so it records supplier quote counts, never quote lines or amounts.
    expect(auditWrite).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'Issued immutable addendum', metadata: expect.objectContaining({ comparison: { contract: [], quoteChangeCount: 1 }, commercialEffect: 'pending_countersignature' }) }),
      expect.anything(),
    );
    expect(JSON.stringify(auditWrite.mock.calls)).not.toContain('quote_1');
  });

  it('refuses a second addendum while one is pending, before consuming any freeze exception', async () => {
    const prisma = {
      opsEvent: { findUnique: async () => ({ id: 'evt_addendum', archived: false, freezeStatus: 'frozen' }) },
      opsDocument: { findFirst: async () => ({ id: 'doc_addendum', eventId: 'evt_addendum' }) },
      opsEventFreezeException: { updateMany: vi.fn(async () => ({ count: 1 })) },
      opsAddendum: {
        findFirst: vi.fn(async ({ where }: { where: { status?: string } }) => (where.status === 'pending' ? { versionNumber: 1 } : null)),
        create: vi.fn(),
      },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const service = new ChangeManagementService(
      prisma as unknown as PrismaService,
      { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined } as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { preview: vi.fn(), apply: vi.fn(), recordConformeExecution: vi.fn() } as unknown as CommercialAddendumImpactWriter,
    );
    const input = issueAddendumSchema.parse({ title: 'Scope change', documentId: 'doc_addendum', contractSnapshot: [], quoteSnapshot: [], freezeExceptionId: 'freeze_ex_2' });

    await expect(service.issueAddendum('evt_addendum', input, { id: 'user_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor))
      .rejects.toThrow('Addendum v1 is still pending countersignature');
    expect(prisma.opsEventFreezeException.updateMany).not.toHaveBeenCalled();
    expect(prisma.opsAddendum.create).not.toHaveBeenCalled();
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

  it('rejects a second addendum that reuses an approved freeze exception once the first is withdrawn', async () => {
    // Stateful exception row: the first conditional consume wins, every later one matches nothing.
    const exception = { id: 'freeze_ex_1', eventId: 'evt_addendum', status: 'approved', consumedAt: null as Date | null };
    // Stateful addenda: the first one is pending until it is withdrawn, which frees the pending slot but not the approval.
    const addenda: Array<{ id: string; status: string; versionNumber: number }> = [];
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
        findFirst: vi.fn(async ({ where, orderBy }: { where?: { status?: string }; orderBy?: unknown }) => {
          const matches = addenda.filter((row) => where?.status === undefined || row.status === where.status);
          if (matches.length === 0) return null;
          return orderBy ? matches.reduce((latest, row) => (row.versionNumber > latest.versionNumber ? row : latest)) : matches[0]!;
        }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
          addenda.push({ id: String(data.id), status: String(data.status), versionNumber: Number(data.versionNumber) });
          return { ...data, documentState: 'pending', issuedAt: new Date('2026-10-18T00:00:00.000Z'), effectiveAt: null, withdrawnAt: null, withdrawalReason: null, plannedImpacts: data.plannedImpacts };
        }),
      },
      $transaction: async (callback: (transaction: unknown) => Promise<unknown>) => callback(prisma),
    };
    const service = new ChangeManagementService(
      prisma as unknown as PrismaService,
      { requireActorRole: async () => undefined, requireCanReadEvent: async () => undefined } as unknown as EventAccessPolicyService,
      { write: async () => undefined } as unknown as AuditWriter,
      { preview: vi.fn(async () => ({ financialDelta: 0, billing: null, quotes: [] })), apply: vi.fn(async () => []), recordConformeExecution: vi.fn(async () => null) } as unknown as CommercialAddendumImpactWriter,
    );
    const input = issueAddendumSchema.parse({ title: 'Scope change', documentId: 'doc_addendum', contractSnapshot: [], quoteSnapshot: [], freezeExceptionId: 'freeze_ex_1' });

    await expect(service.issueAddendum('evt_addendum', input, pmcm)).resolves.toMatchObject({ versionNumber: 1, status: 'pending' });
    addenda[0]!.status = 'withdrawn';
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

    expect(requests).toEqual([{ id: 'freeze_ex_1', source: 'freeze_exception', requestedChange: 'Add stage lighting', category: null, status: 'not_approved', clientResponse: null, updatedAt: '2026-10-12T00:00:00.000Z' }]);
    // Redaction: no internal reason, decision note, or PMCM actor identity may appear anywhere in the client payload.
    const serialized = JSON.stringify(requests);
    expect(serialized).not.toContain('venue cost overrun');
    expect(serialized).not.toContain('insurance not covered');
    expect(serialized).not.toContain('PMCM Admin');
  });

  it('lets the client who owns the event through its inquiry email read change requests and addenda', async () => {
    // The event has no client email of its own, as in fixtures and older records; ownership falls back to the inquiry email.
    const event = { id: 'evt_1', clientPortalStatus: 'unlocked', clientEmail: null, clientName: 'Ana Reyes' };
    const findUniqueOrThrow = vi.fn(async (args: { include?: { inquiry?: unknown } }) =>
      args.include?.inquiry ? { ...event, inquiry: { email: 'ana@ayala.test' } } : event);
    const service = new ChangeManagementService(
      { opsEvent: { findUniqueOrThrow }, opsEventFreezeException: { findMany: async () => [] }, opsAddendum: { findMany: async () => [] } } as unknown as PrismaService,
      new EventAccessPolicyService({ write: async () => undefined } as unknown as AuditWriter),
      { write: async () => undefined } as unknown as AuditWriter,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );
    const owner = { ...client, email: 'ANA@ayala.test', verified: true } satisfies ResolvedEventOpsActor;

    await expect(service.listClientChangeRequests('evt_1', owner)).resolves.toEqual([]);
    await expect(service.listAddenda('evt_1', owner)).resolves.toEqual([]);
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

describe('ChangeManagementService addendum comparison visibility', () => {
  const comparison = {
    contract: [{ key: 'stage', before: null, after: { id: 'stage', label: 'Stage rig' } }],
    quotes: [{ key: 'quote_1', before: { id: 'quote_1', amount: 20_000 }, after: { id: 'quote_1', amount: 25_000 } }],
  };
  const addendumRow = {
    id: 'addendum_1', eventId: 'evt_1', versionNumber: 2, title: 'Add stage lighting', summary: 'Extra rig', status: 'pending',
    documentId: 'doc_1', documentState: 'pending', signatureMethod: 'scanned_document', comparison, financialDelta: 15_000,
    issuedAt: new Date('2026-10-19T09:00:00.000Z'), effectiveAt: null, withdrawnAt: null, withdrawalReason: null,
    plannedImpacts: { financialDelta: 15_000, billing: { billingSourceId: 'billing_1', baselineTotalAmount: 100_000, baselineLineItems: [] }, quotes: [{ quoteId: 'quote_1', baselineAmount: 20_000, targetAmount: 25_000 }] },
    conformeExecution: null,
  };
  const clientActor = { id: 'client_primary', role: OpsUserRole.Client, email: 'client@example.test', name: 'Client', explicit: true, verified: true } satisfies ResolvedEventOpsActor;
  const pmcmActor = { id: 'user_pmcm', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true } satisfies ResolvedEventOpsActor;

  function listingService() {
    const prisma = {
      opsEvent: { findUniqueOrThrow: async () => ({ id: 'evt_1', clientPortalStatus: 'unlocked', archived: false, inquiry: { email: 'client@example.test' } }) },
      opsAddendum: { findMany: vi.fn(async () => [addendumRow]) },
    };
    const audit = { write: async () => undefined } as unknown as AuditWriter;
    return new ChangeManagementService(
      prisma as unknown as PrismaService,
      new EventAccessPolicyService(audit),
      audit,
      { apply: vi.fn(async () => []) } as unknown as CommercialAddendumImpactWriter,
    );
  }

  it('shows contract-level changes to the client and keeps supplier quote lines for PMCM only', async () => {
    const service = listingService();

    const forClient = await service.listAddenda('evt_1', clientActor);
    const forPmcm = await service.listAddenda('evt_1', pmcmActor);

    expect(forClient[0]).toMatchObject({ versionNumber: 2, financialDelta: 15_000, status: 'pending', comparison: { contract: comparison.contract, quotes: [] }, plannedImpacts: null });
    expect(JSON.stringify(forClient)).not.toContain('quote_1');
    expect(JSON.stringify(forClient)).not.toContain('billing_1');
    expect(forPmcm[0]!.comparison).toEqual(comparison);
    expect(forPmcm[0]!.plannedImpacts).toMatchObject({ financialDelta: 15_000, quotes: [{ quoteId: 'quote_1', targetAmount: 25_000 }] });
  });

  it('shows the withdrawal reason to the client and leaves the planned effect out of a withdrawn addendum', async () => {
    const withdrawn = { ...addendumRow, status: 'withdrawn', plannedImpacts: null, withdrawnAt: new Date('2026-10-20T09:00:00.000Z'), withdrawalReason: 'Venue cannot take the rig' };
    const prisma = {
      opsEvent: { findUniqueOrThrow: async () => ({ id: 'evt_1', clientPortalStatus: 'unlocked', archived: false, inquiry: { email: 'client@example.test' } }) },
      opsAddendum: { findMany: vi.fn(async () => [withdrawn]) },
    };
    const audit = { write: async () => undefined } as unknown as AuditWriter;
    const service = new ChangeManagementService(prisma as unknown as PrismaService, new EventAccessPolicyService(audit), audit, { preview: vi.fn(), apply: vi.fn(), recordConformeExecution: vi.fn() } as unknown as CommercialAddendumImpactWriter);

    const [forClient] = await service.listAddenda('evt_1', clientActor);

    expect(forClient).toMatchObject({ status: 'withdrawn', withdrawnAt: '2026-10-20T09:00:00.000Z', withdrawalReason: 'Venue cannot take the rig', effectiveAt: null });
  });
});
