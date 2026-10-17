import { createHash } from 'node:crypto';
import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import type { ResolvedEventOpsActor } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismGuestQrPassDeliveryStatus } from '@prism/types';
import { GuestQrPassService } from './guest-qr-pass.service';

const activeEvent = {
  id: 'evt_1234',
  eventName: 'Autumn Gala',
  clientName: 'Synthetic Client',
  eventDate: new Date('2026-11-01T00:00:00.000Z'),
  status: 'event_day',
  archived: false,
  actualEndedAt: null,
  walkInPolicy: 'closed',
  walkInThreshold: 200,
};

function rosterEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: 'gre_1',
    eventId: 'evt_1234',
    sourceKey: 'masterlist-1',
    guestName: 'Synthetic Guest',
    normalizedName: 'synthetic guest',
    email: ' Guest@Example.Test ',
    phone: '',
    category: 'VIP',
    table: 'A1',
    eligibility: 'eligible',
    verificationStatus: 'pending',
    source: 'masterlist',
    importBatchId: 'batch_1',
    checkedInAt: null,
    withdrawnAt: null,
    createdAt: new Date('2026-10-01T00:00:00.000Z'),
    updatedAt: new Date('2026-10-01T00:00:00.000Z'),
    ...overrides,
  };
}

function pass(overrides: Record<string, unknown> = {}) {
  const now = new Date('2026-10-17T00:00:00.000Z');
  return {
    id: 'pass_1',
    eventId: 'evt_1234',
    rosterEntryId: 'gre_1',
    tokenHash: createHash('sha256').update('never-return-this-token').digest('hex'),
    status: 'active',
    deliveryStatus: 'queued',
    notificationId: 'not_1',
    issuedById: 'user_pmcm',
    issuedAt: now,
    revokedById: null,
    revokedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function createHarness(options: {
  event?: Record<string, unknown> | null;
  roster?: Record<string, unknown>[];
  passes?: Record<string, unknown>[];
  demoEnabled?: boolean;
  origin?: unknown;
  notificationStatus?: PrismGuestQrPassDeliveryStatus;
} = {}) {
  const state = {
    event: options.event === undefined ? activeEvent : options.event,
    roster: options.roster ?? [rosterEntry()],
    passes: options.passes ?? [],
  };
  const sequence: string[] = [];
  const tx = {
    opsGuestRosterEntry: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; eventId?: string } }) =>
        state.roster.find((row) => (!where.id || row.id === where.id) && (!where.eventId || row.eventId === where.eventId)) ?? null),
      findMany: vi.fn(async ({ where = {} }: any = {}) => state.roster.filter((row) =>
        (!where.eventId || row.eventId === where.eventId)
        && (where.withdrawnAt !== null || row.withdrawnAt == null)
        && (!where.email || String(row.email).toLowerCase().includes(String(where.email.contains).toLowerCase())),
      )),
    },
    opsGuestQrPass: {
      findFirst: vi.fn(async ({ where }: { where: { id?: string; eventId?: string; rosterEntryId?: string; status?: string } }) =>
        state.passes.find((row) => (!where.id || row.id === where.id)
          && (!where.eventId || row.eventId === where.eventId)
          && (!where.rosterEntryId || row.rosterEntryId === where.rosterEntryId)
          && (!where.status || row.status === where.status)) ?? null),
      findMany: vi.fn(async ({ where }: { where?: { eventId?: string; id?: { in?: string[] }; rosterEntryId?: { in?: string[] }; status?: string } } = {}) => {
        const filter = where ?? {};
        return state.passes.filter((row) => (!filter.eventId || row.eventId === filter.eventId)
          && (!filter.status || row.status === filter.status)
          && (!filter.id?.in || filter.id.in.includes(String(row.id)))
          && (!filter.rosterEntryId?.in || filter.rosterEntryId.in.includes(String(row.rosterEntryId))));
      }),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        sequence.push('pass-create');
        const now = new Date();
        const saved = { ...data, createdAt: now, updatedAt: now };
        state.passes.push(saved);
        return saved;
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        sequence.push('pass-update');
        const row = state.passes.find((candidate) => candidate.id === where.id);
        if (!row) throw new Error('missing pass');
        Object.assign(row, data);
        return row;
      }),
      updateMany: vi.fn(async ({ where, data }: { where: { id?: string; eventId?: string; rosterEntryId?: { in: string[] }; status?: string }; data: Record<string, unknown> }) => {
        sequence.push('pass-revoke');
        const matches = state.passes.filter((row) => (!where.id || row.id === where.id)
          && (!where.eventId || row.eventId === where.eventId)
          && (!where.status || row.status === where.status)
          && (!where.rosterEntryId?.in || where.rosterEntryId.in.includes(String(row.rosterEntryId))));
        matches.forEach((row) => Object.assign(row, data));
        return { count: matches.length };
      }),
    },
  };
  const prisma = {
    $transaction: vi.fn(async (work: (client: typeof tx) => Promise<unknown>) => work(tx)),
    opsGuestQrPass: tx.opsGuestQrPass,
    opsGuestRosterEntry: tx.opsGuestRosterEntry,
  };
  const auditWriter = { write: vi.fn(async (_input: unknown, _context?: unknown) => undefined) };
  const notificationWriter = {
    writeGuestPassDelivery: vi.fn(async () => {
      sequence.push('notification-write');
      return { notificationId: `not_${state.passes.length + 1}`, status: 'queued' as const };
    }),
    retryGuestPassDelivery: vi.fn(async () => { sequence.push('notification-retry'); }),
    cancelGuestPassDelivery: vi.fn(async () => { sequence.push('notification-cancel'); }),
    cancelGuestPassDeliveriesForEvent: vi.fn(async () => { sequence.push('notification-cancel-event'); }),
  };
  const deliveryStatusReader = {
    getGuestPassDeliveryStatuses: vi.fn(async (_eventId: string, passIds: readonly string[]) =>
      new Map(passIds.map((id) => [id, options.notificationStatus ?? 'queued'] as const))),
  };
  const eventReferences = { findOperationsEvent: vi.fn(async () => state.event) };
  const config = { get: vi.fn((key: string) => key === 'GUEST_QR_PUBLIC_ORIGIN'
    ? (options.origin === undefined ? 'https://guest.prism.test' : options.origin)
    : undefined) };
  const demoPolicy = { isEnabledForEvent: vi.fn(() => options.demoEnabled ?? true) };
  const service = new GuestQrPassService(
    prisma as never,
    auditWriter as never,
    notificationWriter as never,
    deliveryStatusReader as never,
    eventReferences as never,
    config as never,
    demoPolicy as never,
  );
  const actor = (role: ResolvedEventOpsActor['role']): ResolvedEventOpsActor => ({ id: 'user_pmcm', name: 'PMCM Admin', email: 'admin@example.test', role, explicit: false });

  return { actor, auditWriter, config, demoPolicy, deliveryStatusReader, eventReferences, notificationWriter, prisma, sequence, service, state, tx };
}

describe('GuestQrPassService', () => {
  it.each([
    { role: OpsUserRole.Coordinator },
    { role: OpsUserRole.Client },
    { role: OpsUserRole.Supplier },
    { role: OpsUserRole.Guest },
  ])('denies $role from guest pass commands', async ({ role }) => {
    const harness = createHarness();

    await expect(harness.service.issue('evt_1234', 'gre_1', harness.actor(role) as never)).rejects.toBeInstanceOf(ForbiddenException);
    expect(harness.notificationWriter.writeGuestPassDelivery).not.toHaveBeenCalled();
  });

  it.each([
    { role: OpsUserRole.PmcmAdmin },
    { role: OpsUserRole.System },
  ])('allows $role to issue one-time guest QR data', async ({ role }) => {
    const harness = createHarness();

    const result = await harness.service.issue('evt_1234', 'gre_1', harness.actor(role) as never);
    const url = new URL(result.qrValue);
    const token = url.hash.slice(1);

    expect(url.origin).toBe('https://guest.prism.test');
    expect(url.pathname).toBe('/qr-check-in');
    expect(url.searchParams.get('accessCode')).toBe('AUTUMN-GALA-1234');
    expect([...url.searchParams.keys()]).toEqual(['accessCode']);
    expect(token).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    expect(harness.state.passes).toHaveLength(1);
    expect(harness.state.passes[0]).toMatchObject({
      eventId: 'evt_1234',
      rosterEntryId: 'gre_1',
      tokenHash: createHash('sha256').update(token).digest('hex'),
      status: 'active',
      deliveryStatus: 'queued',
    });
    expect(harness.state.passes[0]).not.toHaveProperty('token');
    expect(harness.notificationWriter.writeGuestPassDelivery).toHaveBeenCalledWith(expect.objectContaining({
      eventId: 'evt_1234',
      passId: harness.state.passes[0].id,
      recipient: 'guest@example.test',
      plaintextMessage: expect.stringContaining(result.qrValue),
    }), expect.objectContaining({ prisma: harness.tx }));
    const auditInput = harness.auditWriter.write.mock.calls[0]?.[0];
    expect(JSON.stringify(auditInput)).toContain('rosterEntryId');
    expect(JSON.stringify(auditInput)).not.toContain(token);
    expect(JSON.stringify(auditInput)).not.toContain('guest@example.test');
    expect(JSON.stringify(auditInput)).not.toContain(result.qrValue);
  });

  it.each([
    ['not imported', { importBatchId: null }],
    ['empty import source', { source: '   ' }],
    ['withdrawn', { withdrawnAt: new Date() }],
    ['ineligible', { eligibility: 'ineligible' }],
    ['review queue', { source: 'guest-review' }],
    ['walk-in', { source: 'coordinator-walk-in' }],
    ['rejected verification', { verificationStatus: 'rejected' }],
    ['missing email', { email: '  ' }],
  ])('rejects an %s roster row', async (_label, overrides) => {
    const harness = createHarness({ roster: [rosterEntry(overrides)] });

    await expect(harness.service.issue('evt_1234', 'gre_1', harness.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(BadRequestException);
    expect(harness.state.passes).toHaveLength(0);
    expect(harness.notificationWriter.writeGuestPassDelivery).not.toHaveBeenCalled();
  });

  it('rejects duplicate active roster emails after trimming and case normalization', async () => {
    const duplicate = rosterEntry({ id: 'gre_2', sourceKey: 'masterlist-2', email: 'guest@example.test' });
    const harness = createHarness({ roster: [rosterEntry(), duplicate] });

    await expect(harness.service.issue('evt_1234', 'gre_1', harness.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.state.passes).toHaveLength(0);
  });

  it.each([
    ['actual end', { actualEndedAt: new Date('2026-10-16T00:00:00.000Z') }],
    ['archive flag', { archived: true }],
    ['archived status', { status: 'archived' }],
  ])('rejects issue after event %s', async (_label, overrides) => {
    const harness = createHarness({ event: { ...activeEvent, ...overrides } });

    await expect(harness.service.issue('evt_1234', 'gre_1', harness.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.state.passes).toHaveLength(0);
  });

  it.each([
    ['actual end', { actualEndedAt: new Date('2026-10-16T00:00:00.000Z') }],
    ['archive flag', { archived: true }],
    ['archived status', { status: 'archived' }],
  ])('rejects reissue and retry after event %s', async (_label, overrides) => {
    const harness = createHarness({ event: { ...activeEvent, ...overrides }, passes: [pass()] });
    const actor = harness.actor('pmcm-admin') as never;

    await expect(harness.service.reissue('evt_1234', 'pass_1', actor)).rejects.toBeInstanceOf(ConflictException);
    await expect(harness.service.retry('evt_1234', 'pass_1', actor)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.notificationWriter.writeGuestPassDelivery).not.toHaveBeenCalled();
    expect(harness.notificationWriter.retryGuestPassDelivery).not.toHaveBeenCalled();
  });

  it('fails closed when the server demo policy or canonical HTTPS origin is unavailable', async () => {
    const disabled = createHarness({ demoEnabled: false });
    await expect(disabled.service.issue('evt_1234', 'gre_1', disabled.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(ServiceUnavailableException);

    const httpOrigin = createHarness({ origin: 'http://guest.prism.test' });
    await expect(httpOrigin.service.issue('evt_1234', 'gre_1', httpOrigin.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('retries only the existing encrypted delivery while the pass and event remain active', async () => {
    const harness = createHarness({ passes: [pass()] });

    const result = await harness.service.retry('evt_1234', 'pass_1', harness.actor('pmcm-admin') as never);

    expect(harness.notificationWriter.retryGuestPassDelivery).toHaveBeenCalledWith('not_1', expect.objectContaining({ prisma: harness.tx }));
    expect(result.deliveryStatus).toBe('queued');
    expect(JSON.stringify(result)).not.toContain('never-return-this-token');
    const auditInput = JSON.stringify(harness.auditWriter.write.mock.calls[0]?.[0]);
    expect(auditInput).toContain('retry');
    expect(auditInput).not.toMatch(/email|token|qrValue/i);
  });

  it('requires reissue after capture redaction instead of retrying a delivered pass', async () => {
    const harness = createHarness({ passes: [pass()], notificationStatus: 'captured' });

    await expect(harness.service.retry('evt_1234', 'pass_1', harness.actor('pmcm-admin') as never)).rejects.toBeInstanceOf(ConflictException);
    expect(harness.notificationWriter.retryGuestPassDelivery).not.toHaveBeenCalled();
  });

  it('reissues by revoking and canceling the old pass before creating a replacement', async () => {
    const harness = createHarness({ passes: [pass()] });

    const result = await harness.service.reissue('evt_1234', 'pass_1', harness.actor('pmcm-admin') as never);

    expect(harness.sequence.indexOf('pass-revoke')).toBeLessThan(harness.sequence.indexOf('notification-cancel'));
    expect(harness.sequence.indexOf('notification-cancel')).toBeLessThan(harness.sequence.indexOf('pass-create'));
    expect(harness.state.passes).toHaveLength(2);
    expect(harness.state.passes[0]).toMatchObject({ status: 'revoked', deliveryStatus: 'revoked' });
    expect(harness.state.passes[1]).toMatchObject({ status: 'active', rosterEntryId: 'gre_1' });
    expect(result.pass.id).toBe(harness.state.passes[1].id);
    const url = new URL(result.qrValue);
    expect(url.pathname).toBe('/qr-check-in');
    expect(url.searchParams.get('accessCode')).toBe('AUTUMN-GALA-1234');
    expect(url.hash.slice(1)).toMatch(/^[A-Za-z0-9_-]{40,}$/);
    const auditInput = JSON.stringify(harness.auditWriter.write.mock.calls[0]?.[0]);
    expect(auditInput).toContain('reissue');
    expect(auditInput).not.toMatch(/email|token|qrValue/i);
  });

  it('revokes idempotently and clears queued delivery', async () => {
    const harness = createHarness({ passes: [pass()] });

    const first = await harness.service.revoke('evt_1234', 'pass_1', harness.actor('pmcm-admin') as never);
    const second = await harness.service.revoke('evt_1234', 'pass_1', harness.actor('pmcm-admin') as never);

    expect(first).toMatchObject({ status: 'revoked', deliveryStatus: 'revoked' });
    expect(second).toMatchObject({ status: 'revoked', deliveryStatus: 'revoked' });
    expect(harness.notificationWriter.cancelGuestPassDelivery).toHaveBeenCalledTimes(1);
    expect(harness.auditWriter.write).toHaveBeenCalledTimes(1);
    const auditInput = JSON.stringify(harness.auditWriter.write.mock.calls[0]?.[0]);
    expect(auditInput).toContain('revoke');
    expect(auditInput).not.toMatch(/email|token|qrValue/i);
  });

  it('revokes active passes for changed or withdrawn roster rows in the supplied transaction', async () => {
    const harness = createHarness({ passes: [pass(), pass({ id: 'pass_other_event', eventId: 'evt_other' })] });
    const context = { prisma: harness.tx, correlationId: 'roster-import' };

    await harness.service.revokeForRosterEntries('evt_1234', ['gre_1', 'gre_1'], harness.actor('pmcm-admin') as never, context as never);

    expect(harness.state.passes.find((row) => row.id === 'pass_1')).toMatchObject({ status: 'revoked', deliveryStatus: 'revoked' });
    expect(harness.state.passes.find((row) => row.id === 'pass_other_event')?.status).toBe('active');
    expect(harness.notificationWriter.cancelGuestPassDelivery).toHaveBeenCalledTimes(1);
    expect(harness.notificationWriter.cancelGuestPassDelivery).toHaveBeenCalledWith('not_1', context);
    expect(harness.auditWriter.write).toHaveBeenCalledTimes(1);
    const auditInput = harness.auditWriter.write.mock.calls[0]?.[0];
    expect(JSON.stringify(auditInput)).not.toMatch(/token|email|qrValue/i);
  });

  it('returns only active pass status for the displayed roster IDs', async () => {
    const history = Array.from({ length: 1000 }, (_, index) => pass({
      id: `history_${index}`,
      rosterEntryId: `gre_history_${index}`,
      status: 'revoked',
      issuedAt: new Date('2026-10-17T00:00:00.000Z'),
    }));
    const harness = createHarness({ passes: [
      pass({ issuedAt: new Date('2024-01-01T00:00:00.000Z') }),
      ...history,
      pass({ id: 'old_revoked', status: 'revoked', rosterEntryId: 'gre_1' }),
      pass({ id: 'other_guest', rosterEntryId: 'gre_2' }),
    ], notificationStatus: 'captured' });

    const result = await harness.service.listForRoster('evt_1234', ['gre_1'], harness.actor('system'));

    expect(result).toMatchObject({ available: true, passes: [expect.objectContaining({
      id: 'pass_1',
      eventId: 'evt_1234',
      rosterEntryId: 'gre_1',
      status: 'active',
      deliveryStatus: 'captured',
    })] });
    expect(harness.tx.opsGuestQrPass.findMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1234', rosterEntryId: { in: ['gre_1'] }, status: 'active' },
    });
    expect(JSON.stringify(result)).not.toMatch(/tokenHash|token|email|qrValue|notificationId/i);
  });

  it('reports unavailable events without querying pass rows', async () => {
    const disabled = createHarness({ demoEnabled: false, passes: [pass()] });
    const ended = createHarness({ event: { ...activeEvent, actualEndedAt: new Date() }, passes: [pass()] });

    await expect(disabled.service.listForRoster('evt_1234', ['gre_1'], disabled.actor('system')))
      .resolves.toEqual({ available: false, passes: [] });
    await expect(ended.service.listForRoster('evt_1234', ['gre_1'], ended.actor('system')))
      .resolves.toEqual({ available: false, passes: [] });

    expect(disabled.tx.opsGuestQrPass.findMany).not.toHaveBeenCalled();
    expect(ended.tx.opsGuestQrPass.findMany).not.toHaveBeenCalled();
  });

  it('expires event passes with one set update and bulk-cancels queued deliveries in the supplied transaction', async () => {
    const harness = createHarness({ passes: [pass(), pass({ id: 'pass_2', notificationId: 'not_2', rosterEntryId: 'gre_2' })] });
    const context = { prisma: harness.tx, correlationId: 'event-end' };

    await harness.service.expireEventGuestQrPasses('evt_1234', 'event-ended', context as never);
    await harness.service.expireEventGuestQrPasses('evt_1234', 'event-ended', context as never);

    expect(harness.state.passes.every((row) => row.status === 'revoked' && row.deliveryStatus === 'revoked')).toBe(true);
    expect(harness.tx.opsGuestQrPass.findMany).not.toHaveBeenCalled();
    expect(harness.tx.opsGuestQrPass.updateMany).toHaveBeenCalledTimes(2);
    expect(harness.tx.opsGuestQrPass.updateMany).toHaveBeenCalledWith({
      where: { eventId: 'evt_1234', status: 'active' },
      data: expect.objectContaining({ status: 'revoked', deliveryStatus: 'revoked', revokedAt: expect.any(Date), revokedById: null }),
    });
    expect(harness.notificationWriter.cancelGuestPassDeliveriesForEvent).toHaveBeenCalledTimes(2);
    expect(harness.notificationWriter.cancelGuestPassDeliveriesForEvent).toHaveBeenCalledWith('evt_1234', context);
    expect(harness.notificationWriter.cancelGuestPassDelivery).not.toHaveBeenCalled();
  });
});
