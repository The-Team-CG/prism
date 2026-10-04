import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { PrismaService } from '@prism/kernel/database';
import { AuditService } from './audit.service';
import { PrivacyOperationsService } from './privacy-operations.service';
import { LifecyclePrivacyRedactorService } from '../../../event-lifecycle/application/onboarding/lifecycle-privacy-redactor.service';
import { CommercialPrivacyRedactorService } from '../../../commercial/application/suppliers/commercial-privacy-redactor.service';
import { OperationsPrivacyRedactorService } from '../../../operations/application/guest/operations-privacy-redactor.service';
import { IdentityPrivacyRedactorService } from '../../../identity-access/application/participants/identity-privacy-redactor.service';
import { normalizePrivacyLegalHoldScope } from './privacy-legal-hold.policy';

const databaseUrl = process.env.P0_TEST_DATABASE_URL;
const operator = {
  id: 'p0-test-operator',
  name: 'P0 database test operator',
  role: 'pmcm-admin' as const,
  email: 'p0-operator@privacy.test',
  explicit: true,
  verified: true,
};

// Opt-in, local, disposable database only. Cleanup uses exact IDs created by this suite.
describe.skipIf(!databaseUrl)('privacy execution against PostgreSQL', () => {
  let prisma: PrismaClient;
  let pool: Pool;
  let audit: AuditService;
  let service: PrivacyOperationsService;
  const inquiryIds: string[] = [];
  const requestIds: string[] = [];
  const legalHoldIds: string[] = [];
  const applicationIds: string[] = [];
  const id = () => `p0_priv_${randomUUID()}`;

  beforeAll(async () => {
    const url = new URL(databaseUrl!);
    if (url.hostname !== '127.0.0.1' || url.port !== '55437' || url.pathname !== '/prism_p0') {
      throw new Error('P0_TEST_DATABASE_URL must target the isolated 127.0.0.1:55437/prism_p0 database');
    }
    pool = new Pool({ connectionString: databaseUrl, ssl: false, max: 5 });
    prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
    await prisma.$connect();
    audit = new AuditService(prisma as PrismaService);
    service = new PrivacyOperationsService(
      prisma as PrismaService,
      audit,
      {
        findEventReference: async (id: string) => ({ id }),
        findPrivacyInventory: async () => ({ events: [], approvalRequests: [] }),
      } as never,
      new LifecyclePrivacyRedactorService(),
      new CommercialPrivacyRedactorService(),
      new OperationsPrivacyRedactorService(),
      new IdentityPrivacyRedactorService(),
    );
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    if (!prisma) return;
    await prisma.opsAuditLog.deleteMany({
      where: {
        affectedId: {
          in: requestIds.flatMap((requestId) => [
            requestId,
            `${requestId}:event-lifecycle`,
            `${requestId}:commercial`,
            `${requestId}:operations`,
            `${requestId}:identity-access`,
          ]).concat(legalHoldIds),
        },
      },
    });
    await prisma.opsPrivacyLegalHold.deleteMany({ where: { id: { in: legalHoldIds } } });
    await prisma.opsPrivacyRequest.deleteMany({ where: { id: { in: requestIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: inquiryIds } } });
    await prisma.opsSupplierApplication.deleteMany({ where: { id: { in: applicationIds } } });
    requestIds.length = legalHoldIds.length = inquiryIds.length = applicationIds.length = 0;
  });

  afterAll(async () => {
    await prisma?.$disconnect();
    await pool?.end();
  });

  async function createClient(normalizedEmail = '', emailOverride = '') {
    const inquiryId = id();
    inquiryIds.push(inquiryId);
    const email = emailOverride || `${inquiryId}@privacy.test`;
    const event = await prisma.opsEvent.create({ data: {
      id: id(), clientName: 'Identifiable client', eventName: 'P0 privacy fixture',
      eventDate: new Date('2026-09-01T00:00:00Z'),
      inquiry: { create: {
        id: inquiryId, clientName: 'Identifiable client', email: email.toUpperCase(),
        normalizedEmail, eventName: 'P0 privacy fixture', clientType: 'Private',
        eventDate: new Date('2026-09-01T00:00:00Z'),
      } },
    } });
    return { email, event, inquiryId };
  }

  async function request(subjectEmail: string, options: { eventId?: string; requestType?: string; subjectType?: string; subjectName?: string; status?: string } = {}) {
    const requestId = id();
    requestIds.push(requestId);
    return prisma.opsPrivacyRequest.create({ data: {
      id: requestId, subjectEmail, subjectName: options.subjectName ?? '',
      subjectType: options.subjectType ?? 'client', requestType: options.requestType ?? 'deletion',
      status: options.status ?? 'approved', eventId: options.eventId, createdBy: operator.name,
    } });
  }

  async function placeClientHold(subjectEmail: string, eventId?: string) {
    const hold = await service.createLegalHold({
      subjectType: 'client', subjectEmail, reason: 'Preserve records during legal review', ...(eventId ? { eventId } : {}),
    }, operator);
    legalHoldIds.push(hold.id);
    return hold;
  }

  it('redacts a legacy inquiry and linked event/billing copies without touching a supplier namesake', async () => {
    const fixture = await createClient();
    const billing = await prisma.opsBillingStatement.create({ data: {
      id: id(), number: id(), eventId: fixture.event.id, totalAmount: 100,
      clientName: 'Identifiable client', clientContact: fixture.email,
    } });
    const applicationId = id();
    applicationIds.push(applicationId);
    await prisma.opsSupplierApplication.create({ data: {
      id: applicationId, companyName: 'Supplier business', contactName: 'Supplier contact',
      email: fixture.email, normalizedEmail: fixture.email,
    } });
    const pending = await request(fixture.email, { subjectName: 'Shared name' });
    await service.executeRequest(pending.id, {}, operator);

    const inquiry = await prisma.opsInquiry.findUniqueOrThrow({ where: { id: fixture.inquiryId } });
    expect(inquiry.email).toBe(`redacted+privacy_${pending.id}@privacy.local`);
    expect(inquiry.normalizedEmail).toBe(inquiry.email);
    expect((await prisma.opsEvent.findUniqueOrThrow({ where: { id: fixture.event.id } })).clientName).toBe('Redacted data subject');
    expect(await prisma.opsBillingStatement.findUniqueOrThrow({ where: { id: billing.id } })).toMatchObject({
      clientName: 'Redacted data subject', clientContact: inquiry.email,
    });
    expect((await prisma.opsSupplierApplication.findUniqueOrThrow({ where: { id: applicationId } })).email).toBe(fixture.email);
    expect(await prisma.opsInquiry.count({ where: { OR: [
      { email: { equals: fixture.email, mode: 'insensitive' } }, { normalizedEmail: fixture.email },
    ] } })).toBe(0);
  });

  it('rolls back every redaction and the completion status when its audit cannot persist', async () => {
    const fixture = await createClient();
    const pending = await request(fixture.email);
    vi.spyOn(audit, 'audit').mockRejectedValueOnce(new Error('injected audit failure'));
    await expect(service.executeRequest(pending.id, {}, operator)).rejects.toThrow('injected audit failure');
    expect((await prisma.opsInquiry.findUniqueOrThrow({ where: { id: fixture.inquiryId } })).email).toBe(fixture.email.toUpperCase());
    expect((await prisma.opsEvent.findUniqueOrThrow({ where: { id: fixture.event.id } })).clientName).toBe('Identifiable client');
    expect((await prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('approved');
    expect(await prisma.opsAuditLog.count({ where: { affectedId: pending.id } })).toBe(0);
  });

  it('serializes concurrent execution and persists one completion audit', async () => {
    const fixture = await createClient();
    const pending = await request(fixture.email);
    const results = await Promise.allSettled([
      service.executeRequest(pending.id, {}, operator), service.executeRequest(pending.id, {}, operator),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect((await prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('executed');
    expect(await prisma.opsAuditLog.count({ where: { affectedId: pending.id } })).toBe(1);
  });

  it('applies event-limited holds only to that event and permits execution after release', async () => {
    const email = `${id()}@privacy.test`;
    const first = await createClient('', email);
    const second = await createClient('', email);
    const hold = await placeClientHold(email, second.event.id);
    const firstRequest = await request(email, { eventId: first.event.id });
    await expect(service.executeRequest(firstRequest.id, {}, operator)).resolves.toMatchObject({ status: 'executed' });

    const secondRequest = await request(email, { eventId: second.event.id });
    await expect(service.executeRequest(secondRequest.id, {}, operator)).rejects.toThrow('active legal hold');
    expect((await prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: secondRequest.id } })).status).toBe('approved');

    await service.releaseLegalHold(hold.id, { reason: 'Counsel confirmed release' }, operator);
    await expect(service.executeRequest(secondRequest.id, {}, operator)).resolves.toMatchObject({ status: 'executed' });
    expect(await prisma.opsAuditLog.count({ where: { affectedId: hold.id } })).toBe(2);
  });

  it('serializes a concurrent legal-hold placement before deletion execution checks the hold', async () => {
    const fixture = await createClient();
    const pending = await request(fixture.email, { eventId: fixture.event.id });
    let allowHoldCommitResolve!: () => void;
    const allowHoldCommit = new Promise<void>((resolve) => { allowHoldCommitResolve = resolve; });
    let holdAuditStartedResolve!: () => void;
    const holdAuditStarted = new Promise<void>((resolve) => { holdAuditStartedResolve = resolve; });
    const originalAudit = audit.audit.bind(audit);
    vi.spyOn(audit, 'audit').mockImplementation(async (...args) => {
      if (args[2] === 'Placed privacy legal hold') {
        const affectedId = args[3]?.affectedId;
        if (typeof affectedId === 'string') legalHoldIds.push(affectedId);
        holdAuditStartedResolve();
        await allowHoldCommit;
      }
      return originalAudit(...args);
    });

    const placement = service.createLegalHold({
      subjectType: 'client', subjectEmail: fixture.email, reason: 'Preserve records during legal review', eventId: fixture.event.id,
    }, operator);
    let execution: Promise<unknown> | undefined;
    try {
      await holdAuditStarted;
      execution = service.executeRequest(pending.id, {}, operator);
      const deadline = Date.now() + 5000;
      let waiting = false;
      while (!waiting && Date.now() < deadline) {
        const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`
          SELECT EXISTS (
            SELECT 1
            FROM pg_locks AS lock
            JOIN pg_stat_activity AS activity USING (pid)
            WHERE lock.locktype = 'advisory'
              AND NOT lock.granted
              AND activity.query LIKE '%pg_advisory_xact_lock%'
          ) AS waiting
        `;
        waiting = Boolean(rows[0]?.waiting);
        if (!waiting) await new Promise((resolve) => setTimeout(resolve, 10));
      }
      expect(waiting).toBe(true);
      allowHoldCommitResolve();
      const hold = await placement;
      legalHoldIds.push(hold.id);
      await expect(execution).rejects.toThrow('active legal hold');
      expect((await prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('approved');
    } finally {
      allowHoldCommitResolve();
      await placement.catch(() => undefined);
      await execution?.catch(() => undefined);
    }
  });

  it.each(['access', 'correction'])('keeps unsupported %s approved without a completion audit', async (requestType) => {
    const pending = await request(`${id()}@privacy.test`, { requestType });
    await expect(service.executeRequest(pending.id, {}, operator)).rejects.toThrow('not supported yet');
    expect((await prisma.opsPrivacyRequest.findUniqueOrThrow({ where: { id: pending.id } })).status).toBe('approved');
    expect(await prisma.opsAuditLog.count({ where: { affectedId: pending.id } })).toBe(0);
  });

  it('redacts only the selected event guest and keeps a namesake in another event', async () => {
    const first = await createClient();
    const second = await createClient();
    const guestName = `Guest ${id()}`;
    for (const event of [first.event, second.event]) {
      await prisma.opsGuestCheckIn.create({ data: { id: id(), eventId: event.id, guestName } });
      await prisma.opsGuestFeedback.create({ data: { id: id(), eventId: event.id, guestName, rating: 4, comment: 'personal', photoFileName: 'photo.jpg' } });
    }
    const pending = await request('', { subjectType: 'guest', subjectName: ` ${guestName.toLowerCase()} `, eventId: first.event.id });
    await service.executeRequest(pending.id, {}, operator);
    expect(await prisma.opsGuestFeedback.findFirstOrThrow({ where: { eventId: first.event.id } })).toMatchObject({
      guestName: 'Redacted guest', comment: '[redacted by privacy request]', photoFileName: null,
    });
    expect((await prisma.opsGuestFeedback.findFirstOrThrow({ where: { eventId: second.event.id } })).guestName).toBe(guestName);
    expect((await prisma.opsGuestCheckIn.findFirstOrThrow({ where: { eventId: second.event.id } })).guestName).toBe(guestName);
  });

  it('rejects a competing approval decision instead of overwriting a terminal review', async () => {
    const pending = await request(`${id()}@privacy.test`, { status: 'submitted' });
    const results = await Promise.allSettled([
      service.reviewRequest(pending.id, { status: 'approved' }, operator),
      service.reviewRequest(pending.id, { status: 'rejected' }, operator),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.opsAuditLog.count({ where: { affectedId: pending.id } })).toBe(1);
  });
});
