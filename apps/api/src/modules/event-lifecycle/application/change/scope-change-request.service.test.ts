import { describe, expect, it, vi } from 'vitest';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { OpsUserRole } from '@prism/kernel/event-core';
import { EventAccessPolicyService, type AuditWriter, type ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { reviewScopeChangeRequestSchema, submitScopeChangeRequestSchema } from '@prism/types';
import { ScopeChangeRequestService } from './scope-change-request.service';

type Row = Record<string, any>;

const pmcm = { id: 'pmcm_1', role: OpsUserRole.PmcmAdmin, name: 'PMCM Admin', explicit: true, verified: true } satisfies ResolvedEventOpsActor;
const primaryClient = { id: 'client_1', role: OpsUserRole.Client, name: 'Client Contact', email: 'client@example.com', explicit: true, verified: true } satisfies ResolvedEventOpsActor;
const submission = submitScopeChangeRequestSchema.parse({ title: 'Add a sunset slot', description: 'Move the cocktail hour outside', category: 'schedule' });

function matches(row: Row, where: Record<string, any> = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (condition && typeof condition === 'object' && 'in' in condition) return (condition.in as unknown[]).includes(row[key]);
    if (condition && typeof condition === 'object' && 'not' in condition) return row[key] !== condition.not;
    return row[key] === condition;
  });
}

/** In-memory stand-in for the Prisma calls the scope change service makes, so the status and consumption rules are exercised. */
function fakeStore(options: { event?: Partial<Row>; exceptions?: Row[]; addenda?: Row[]; rows?: Row[] } = {}) {
  const event = { id: 'evt_1', eventName: 'Launch Gala', archived: false, freezeStatus: 'open', clientName: 'Client Contact', clientPortalStatus: 'unlocked', inquiry: { email: 'client@example.com' }, ...options.event };
  const rows = new Map<string, Row>((options.rows ?? []).map((row) => [row.id, row]));
  const exceptions = new Map<string, Row>((options.exceptions ?? []).map((row) => [row.id, { consumedAt: null, ...row }]));
  const addenda = options.addenda ?? [];
  let sequence = 0;
  const scopeChangeRequest = {
    create: vi.fn(async ({ data }: { data: Row }) => {
      const now = new Date(Date.UTC(2026, 9, 19, 9, sequence++));
      const row: Row = { decisionReason: null, clientResponse: null, billingImpact: false, supplierImpact: false, coordinatorImpact: false, floorplanImpact: false, impactReviewedAt: null, freezeExceptionId: null, addendumId: null, reviewedBy: null, decidedBy: null, submittedAt: now, decidedAt: null, withdrawnAt: null, createdAt: now, updatedAt: now, ...data };
      rows.set(row.id, row);
      return row;
    }),
    findFirst: vi.fn(async ({ where }: { where: Row }) => [...rows.values()].find((row) => matches(row, where)) ?? null),
    findMany: vi.fn(async ({ where }: { where?: Row } = {}) => [...rows.values()].filter((row) => matches(row, where))),
    findUniqueOrThrow: async ({ where }: { where: Row }) => rows.get(where.id)!,
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const hits = [...rows.values()].filter((row) => matches(row, where));
      for (const row of hits) Object.assign(row, data, { updatedAt: new Date(Date.UTC(2026, 9, 19, 12)) });
      return { count: hits.length };
    }),
  };
  const opsEventFreezeException = {
    updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
      const hits = [...exceptions.values()].filter((row) => matches(row, where));
      for (const row of hits) Object.assign(row, data);
      return { count: hits.length };
    }),
  };
  const prisma = {
    opsEvent: { findUnique: async () => event },
    opsAddendum: { findFirst: async ({ where }: { where: Row }) => addenda.find((row) => matches(row, where)) ?? null },
    opsScopeChangeRequest: scopeChangeRequest,
    opsEventFreezeException,
    $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback(prisma)),
  };
  const audit = { write: vi.fn(async () => undefined) } as unknown as AuditWriter & { write: ReturnType<typeof vi.fn> };
  const notifications = { write: vi.fn(async () => undefined) };
  const service = new ScopeChangeRequestService(
    prisma as unknown as PrismaService,
    new EventAccessPolicyService(audit),
    audit,
    notifications as never,
  );
  return { service, prisma, rows, exceptions, audit, notifications, scopeChangeRequest, opsEventFreezeException };
}

describe('ScopeChangeRequestService submission and withdrawal', () => {
  it('retries an aborted serializable review without hiding unrelated database failures', async () => {
    const { service, prisma } = fakeStore();
    const request = await service.submit('evt_1', submission, primaryClient);
    prisma.$transaction.mockRejectedValueOnce(Object.assign(new Error('serialization conflict'), { code: 'P2034' }));
    await expect(service.review('evt_1', request.id, { decision: 'start_review' }, pmcm)).resolves.toMatchObject({ status: 'under_review' });
    prisma.$transaction.mockRejectedValueOnce(new Error('database unavailable'));
    await expect(service.review('evt_1', request.id, { decision: 'reject', decisionReason: 'Cannot fulfil this request' }, pmcm)).rejects.toThrow('database unavailable');
  });
  it('lets the verified primary client submit for their own event and queues a PMCM alert', async () => {
    const { service, notifications, audit } = fakeStore();

    const request = await service.submit('evt_1', submission, primaryClient);

    expect(request).toMatchObject({ eventId: 'evt_1', requestedByRole: 'client', status: 'submitted', category: 'schedule', title: 'Add a sunset slot' });
    expect(notifications.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1', recipient: 'PMCM Admin', idempotencyKey: `scope-change-submitted:${request.id}` }), expect.anything());
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ eventId: 'evt_1', action: 'Submitted scope change request' }), expect.anything());
  });

  it('refuses submission from other events, non-primary clients, unverified sessions, and non-PMCM roles', async () => {
    const cases: Array<[string, ResolvedEventOpsActor, string?]> = [
      ['another client', { ...primaryClient, id: 'other', email: 'other@example.com' }],
      ['an unverified client identity', { ...primaryClient, verified: false }],
      ['a supplier', { id: 'sup_1', role: OpsUserRole.Supplier, name: 'Supplier', explicit: true, verified: true }],
      ['a coordinator', { id: 'coord_1', role: OpsUserRole.Coordinator, name: 'Coordinator', explicit: true, verified: true, eventId: 'evt_1' }],
      ['a guest', { id: 'guest_1', role: OpsUserRole.Guest, name: 'Guest', explicit: true, verified: true }],
    ];
    for (const [, actor] of cases) {
      const { service, scopeChangeRequest } = fakeStore();
      await expect(service.submit('evt_1', submission, actor)).rejects.toBeInstanceOf(ForbiddenException);
      expect(scopeChangeRequest.create).not.toHaveBeenCalled();
    }
  });

  it('refuses a client submission on an event that is not theirs, even when the email matches another client', async () => {
    const { service, scopeChangeRequest } = fakeStore({ event: { inquiry: { email: 'someone-else@example.com' } } });

    await expect(service.submit('evt_1', submission, primaryClient)).rejects.toBeInstanceOf(ForbiddenException);
    expect(scopeChangeRequest.create).not.toHaveBeenCalled();
  });

  it('lets PMCM log a request on the client behalf without queuing the client alert', async () => {
    const { service, notifications } = fakeStore();

    await expect(service.submit('evt_1', submission, pmcm)).resolves.toMatchObject({ requestedByRole: 'pmcm', requestedBy: 'PMCM Admin' });
    expect(notifications.write).not.toHaveBeenCalled();
  });

  it('lets the primary client withdraw only while the request is still submitted', async () => {
    const { service, audit } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);

    await expect(service.withdraw('evt_1', submitted.id, primaryClient)).resolves.toMatchObject({ status: 'withdrawn' });
    await expect(service.withdraw('evt_1', submitted.id, primaryClient)).rejects.toThrow('Only a submitted scope change request can be withdrawn');
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Withdrew scope change request' }), expect.anything());

    const underReview = await service.submit('evt_1', submission, primaryClient);
    await service.review('evt_1', underReview.id, { decision: 'start_review' }, pmcm);
    await expect(service.withdraw('evt_1', underReview.id, primaryClient)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps withdrawal away from other clients and from PMCM', async () => {
    const { service, rows } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);

    await expect(service.withdraw('evt_1', submitted.id, { ...primaryClient, email: 'other@example.com' })).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.withdraw('evt_1', submitted.id, pmcm)).rejects.toBeInstanceOf(ForbiddenException);
    expect(rows.get(submitted.id)?.status).toBe('submitted');
  });
});

describe('ScopeChangeRequestService PMCM review', () => {
  const approval = (overrides: Record<string, unknown> = {}) => reviewScopeChangeRequestSchema.parse({
    decision: 'approve',
    impacts: { billing: true, supplier: false, coordinator: false, floorplan: false },
    impactReviewAcknowledged: true,
    ...overrides,
  });

  it('approves a request after impact review and records the impact flags and linked addendum', async () => {
    const { service, rows } = fakeStore({ addenda: [{ id: 'addendum_1', eventId: 'evt_1' }] });
    const submitted = await service.submit('evt_1', submission, primaryClient);

    const decided = await service.review('evt_1', submitted.id, approval({ addendumId: 'addendum_1', clientResponse: 'Approved, see the addendum.' }), pmcm);

    expect(decided).toMatchObject({ status: 'approved', addendumId: 'addendum_1', impacts: { billing: true, supplier: false, coordinator: false, floorplan: false }, clientResponse: 'Approved, see the addendum.' });
    expect(rows.get(submitted.id)?.impactReviewedAt).toBeInstanceOf(Date);
  });

  it('rejects an approval that names an addendum from another event', async () => {
    const { service } = fakeStore({ addenda: [{ id: 'addendum_other', eventId: 'evt_other' }] });
    const submitted = await service.submit('evt_1', submission, primaryClient);

    await expect(service.review('evt_1', submitted.id, approval({ addendumId: 'addendum_other' }), pmcm)).rejects.toThrow('Addendum was not found for this event');
  });

  it('requires a PMCM reason to reject, which stays out of the client projection', async () => {
    const { service } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);
    expect(reviewScopeChangeRequestSchema.safeParse({ decision: 'reject', decisionReason: '  ' }).success).toBe(false);

    const rejected = await service.review('evt_1', submitted.id, reviewScopeChangeRequestSchema.parse({ decision: 'reject', decisionReason: 'Venue cannot take the extra hour' }), pmcm);

    expect(rejected).toMatchObject({ status: 'rejected', decisionReason: 'Venue cannot take the extra hour' });
  });

  it('decides a request only once, so a second decision is refused', async () => {
    const { service, audit } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);
    await service.review('evt_1', submitted.id, reviewScopeChangeRequestSchema.parse({ decision: 'reject', decisionReason: 'Out of scope' }), pmcm);

    await expect(service.review('evt_1', submitted.id, approval(), pmcm)).rejects.toThrow('Scope change request is already rejected');
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Rejected scope change request' }), expect.anything());
  });

  it('requires an approved, unused freeze exception to approve on a frozen event, and consumes it once', async () => {
    const { service, exceptions } = fakeStore({
      event: { freezeStatus: 'frozen' },
      exceptions: [{ id: 'freeze_ex_1', eventId: 'evt_1', status: 'approved' }],
    });
    const first = await service.submit('evt_1', submission, primaryClient);
    const second = await service.submit('evt_1', submission, primaryClient);

    await expect(service.review('evt_1', first.id, approval(), pmcm)).rejects.toThrow('Frozen events require an approved freeze exception');

    await expect(service.review('evt_1', first.id, approval({ freezeExceptionId: 'freeze_ex_1' }), pmcm)).resolves.toMatchObject({ status: 'approved', freezeExceptionId: 'freeze_ex_1' });
    expect(exceptions.get('freeze_ex_1')?.consumedAt).toBeInstanceOf(Date);
    await expect(service.review('evt_1', second.id, approval({ freezeExceptionId: 'freeze_ex_1' }), pmcm)).rejects.toThrow('Freeze exception is not an unused approval for this event');
  });

  it('leaves a freeze exception unused when the approval itself fails', async () => {
    const { service, exceptions } = fakeStore({
      event: { freezeStatus: 'frozen' },
      exceptions: [{ id: 'freeze_ex_1', eventId: 'evt_1', status: 'approved' }],
    });
    const submitted = await service.submit('evt_1', submission, primaryClient);

    await expect(service.review('evt_1', submitted.id, approval({ freezeExceptionId: 'freeze_ex_1', addendumId: 'addendum_missing' }), pmcm)).rejects.toThrow('Addendum was not found for this event');
    expect(exceptions.get('freeze_ex_1')?.consumedAt).toBeNull();
  });

  it('keeps the review and register away from clients, suppliers, coordinators, and guests, and audits PMCM decisions', async () => {
    const { service, rows, audit } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);
    const denied = [primaryClient, { id: 'coord_1', role: OpsUserRole.Coordinator, name: 'Coordinator', explicit: true, verified: true, eventId: 'evt_1' }, { id: 'sup_1', role: OpsUserRole.Supplier, name: 'Supplier', explicit: true, verified: true }, { id: 'guest_1', role: OpsUserRole.Guest, name: 'Guest', explicit: true, verified: true }] as ResolvedEventOpsActor[];

    for (const actor of denied) {
      await expect(service.review('evt_1', submitted.id, approval(), actor)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.listForPmcm('evt_1', actor)).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(rows.get(submitted.id)?.status).toBe('submitted');

    await service.review('evt_1', submitted.id, { decision: 'start_review' }, pmcm);
    expect(audit.write).toHaveBeenCalledWith(expect.objectContaining({ action: 'Started scope change review', eventId: 'evt_1' }), expect.anything());
  });
});

describe('ScopeChangeRequestService client projection', () => {
  it('shows the client only the title, category, neutral status, and PMCM client response', async () => {
    const { service } = fakeStore();
    const submitted = await service.submit('evt_1', submission, primaryClient);
    await service.review('evt_1', submitted.id, reviewScopeChangeRequestSchema.parse({ decision: 'reject', decisionReason: 'Insurance does not cover a sunset set', clientResponse: 'We cannot add the slot this season.' }), pmcm);

    const [visible] = await service.listClientRequests('evt_1', primaryClient);

    expect(visible).toEqual({
      id: submitted.id,
      source: 'scope_change',
      requestedChange: 'Add a sunset slot',
      category: 'schedule',
      status: 'not_approved',
      clientResponse: 'We cannot add the slot this season.',
      updatedAt: expect.any(String),
    });
    const serialized = JSON.stringify(visible);
    expect(serialized).not.toContain('Insurance does not cover');
    expect(serialized).not.toContain('PMCM Admin');
    expect(serialized).not.toContain('impact');
  });

  it('refuses the client projection to actors who cannot read the event', async () => {
    const { service } = fakeStore();
    await service.submit('evt_1', submission, primaryClient);

    await expect(service.listClientRequests('evt_1', { ...primaryClient, email: 'other@example.com' })).rejects.toBeInstanceOf(ForbiddenException);
  });
});
