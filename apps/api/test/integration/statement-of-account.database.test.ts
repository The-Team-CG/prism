import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { EventAccessPolicyService, type AuditWriter } from '@prism/kernel/access-control';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismVerifiedEventActor } from '@prism/types';
import { PaymentReceiptService } from '../../src/modules/commercial/application/billing/payment-receipt.service';
import { StatementOfAccountService } from '../../src/modules/commercial/application/billing/statement-of-account.service';
import { ClientPaymentSubmissionService } from '../../src/modules/commercial/application/billing/client-payment-submission.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!live)('client statement of account against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const id = (name: string) => `soa_${name}_${suffix}`;
  const finance = { id: `soa-actor-${suffix}`, name: `Statement Test ${suffix}`, role: 'pmcm-admin' };
  const clientEmail = `client-${suffix}@example.test`;
  const auditWriter: AuditWriter = { write: async () => undefined };
  const notices: Array<Record<string, unknown>> = [];
  const notifications = { write: async (input: object) => { notices.push(input as Record<string, unknown>); } };
  const policy = new EventAccessPolicyService(auditWriter);
  let prisma: PrismaService;
  let receipts: PaymentReceiptService;
  let service: StatementOfAccountService;
  let submissions: ClientPaymentSubmissionService;

  const actor = (role: string, email = 'someone@example.test'): PrismVerifiedEventActor => ({
    id: `user-${role}-${email}`, actorId: `user-${role}-${email}`, role, actorRole: role, email, actorEmail: email, name: 'Test', actorName: 'Test', expiresAt: '2099-01-01',
  } as PrismVerifiedEventActor);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    receipts = new PaymentReceiptService(prisma, auditWriter, undefined, notifications);
    service = new StatementOfAccountService(prisma, policy);
    submissions = new ClientPaymentSubmissionService(prisma, policy, service, auditWriter, undefined, notifications);

    for (const key of ['a', 'b', 'c']) {
      await prisma.opsInquiry.create({ data: {
        id: id(`inquiry_${key}`), clientName: 'Statement Client', email: clientEmail, normalizedEmail: `${key}-${clientEmail}`,
        eventName: `Statement Event ${key.toUpperCase()}`, eventDate: new Date('2031-04-18T09:00:00.000Z'), clientType: 'corporate',
      } });
      await prisma.opsEvent.create({ data: {
        id: id(`event_${key}`), inquiryId: id(`inquiry_${key}`), clientName: 'Statement Client', eventName: `Statement Event ${key.toUpperCase()}`,
        eventDate: new Date('2031-04-18T09:00:00.000Z'), clientPortalStatus: 'unlocked',
      } });
    }

    // Event A: a sent statement, a deposit paid in full, a balance owed, a payment that was undone, and some held money.
    await prisma.opsBillingStatement.create({ data: { id: id('statement_a'), eventId: id('event_a'), number: `SOA-${suffix}`, totalAmount: 150000, status: 'sent', sentAt: new Date('2026-10-01T00:00:00.000Z') } });
    await prisma.opsPaymentMilestone.createMany({ data: [
      { id: id('deposit'), eventId: id('event_a'), statementId: id('statement_a'), label: 'Deposit', amount: 100000, remainingBalance: 100000, dueDate: new Date('2026-10-15T00:00:00.000Z') },
      { id: id('balance'), eventId: id('event_a'), statementId: id('statement_a'), label: 'Balance', amount: 50000, remainingBalance: 50000, dueDate: new Date('2026-12-01T00:00:00.000Z') },
    ] });
    const paid = await receipts.recordReceipt({ amount: 100000, receivedDate: '2026-10-10', method: 'Bank Transfer', referenceNumber: `SOA-A-${suffix}`, payerName: 'Internal Payer Name', eventId: id('event_a') } as never, finance);
    await receipts.allocate(paid.id, { milestoneId: id('deposit'), amount: 100000 }, finance);
    const undone = await receipts.recordReceipt({ amount: 30000, receivedDate: '2026-10-12', method: 'Cheque', referenceNumber: `SOA-B-${suffix}`, eventId: id('event_a') } as never, finance);
    const slice = (await receipts.allocate(undone.id, { milestoneId: id('balance'), amount: 30000 }, finance)).allocations[0];
    await receipts.reverseAllocation(undone.id, slice.id, { reason: 'INTERNAL: cheque looked forged' }, finance);
    const held = await receipts.recordReceipt({ amount: 20000, receivedDate: '2026-10-14', method: 'GCash', referenceNumber: `SOA-C-${suffix}`, eventId: id('event_a') } as never, finance);
    await receipts.recordRefund(held.id, { amount: 5000, refundedDate: '2026-10-20', method: 'GCash', referenceNumber: `RF-${suffix}`, reason: 'INTERNAL: overpaid by mistake' }, finance);
    await receipts.verify(held.id, { notes: 'INTERNAL: matched wallet line' }, finance);

    // Event B: the billing statement exists but PMCM has not sent it.
    await prisma.opsBillingStatement.create({ data: { id: id('statement_b'), eventId: id('event_b'), number: `SOB-${suffix}`, totalAmount: 90000 } });
    await prisma.opsPaymentMilestone.create({ data: { id: id('milestone_b'), eventId: id('event_b'), statementId: id('statement_b'), label: 'Deposit', amount: 90000, remainingBalance: 90000, dueDate: new Date('2026-12-01T00:00:00.000Z') } });

    // Event C: a sent statement the client reports payments against.
    await prisma.opsBillingStatement.create({ data: { id: id('statement_c'), eventId: id('event_c'), number: `SOC-${suffix}`, totalAmount: 80000, status: 'sent', sentAt: new Date('2026-10-01T00:00:00.000Z') } });
    await prisma.opsPaymentMilestone.create({ data: { id: id('milestone_c'), eventId: id('event_c'), statementId: id('statement_c'), label: 'Downpayment', amount: 80000, remainingBalance: 80000, dueDate: new Date('2026-12-01T00:00:00.000Z') } });
  });

  afterAll(async () => {
    if (!live) return;
    const eventIds = [id('event_a'), id('event_b'), id('event_c')];
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId: { in: eventIds }, reversesRecordId: { not: null } } });
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsPaymentRefund.deleteMany({ where: { recordedBy: finance.name } });
    await prisma.opsPaymentReceipt.deleteMany({ where: { OR: [{ recordedBy: finance.name }, { eventId: { in: eventIds } }] } });
    await prisma.opsPaymentMilestone.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsBillingStatement.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: [id('inquiry_a'), id('inquiry_b'), id('inquiry_c')] } } });
    await prisma.$disconnect();
  });

  it('shows the client what they were billed, paid, were paid back, are owed, and what PMCM is holding for them', async () => {
    const statement = await service.statementFor(id('event_a'), actor(OpsUserRole.Client, clientEmail));

    // Checked money not yet applied is credit held; money PMCM has not checked is listed as being checked instead.
    expect(statement).toMatchObject({ eventId: id('event_a'), available: true, statementNumber: `SOA-${suffix}`, billed: 150000, received: 100000, refunded: 5000, balance: 50000, creditHeld: 15000 });
    // Every receipt PMCM has not verified is listed, newest first: the undone cheque holding 30,000, and the deposit
    // that is fully applied but not yet checked against the bank statement.
    expect(statement.submissions.map((submission) => [submission.state, submission.unapplied])).toEqual([['checking', 30000], ['checking', 0]]);
    expect(statement.milestones.map((milestone) => [milestone.label, milestone.remaining])).toEqual([['Deposit', 0], ['Balance', 50000]]);
    // A payment that was undone stays listed, marked, with no negative line, and never counts toward what was received.
    expect(statement.lines.map((line) => [line.kind, line.amount, line.reversed])).toEqual([
      ['payment', 100000, false],
      ['payment', 30000, true],
      ['refund', 5000, false],
    ]);
    expect(statement.lines[2]).toMatchObject({ method: 'GCash', reference: `RF-${suffix}` });
  });

  it('carries nothing internal to the client: no reason, note, payer or receipt identifier', async () => {
    const statement = await service.statementFor(id('event_a'), actor(OpsUserRole.Client, clientEmail));
    const text = JSON.stringify(statement);

    expect(text).not.toMatch(/INTERNAL|forged|overpaid|Internal Payer Name|prcp_|verifiedBy|recordedBy/i);
  });

  it('shows a client nothing for a statement PMCM has not sent, and shows PMCM the same event in full', async () => {
    const client = await service.statementFor(id('event_b'), actor(OpsUserRole.Client, clientEmail));
    const pmcm = await service.statementFor(id('event_b'), actor(OpsUserRole.PmcmAdmin, 'admin@example.test'));

    expect(client).toMatchObject({ available: false, billed: 0, balance: 0, milestones: [], lines: [] });
    expect(pmcm).toMatchObject({ available: true, statementNumber: `SOB-${suffix}`, billed: 90000, balance: 90000 });
  });

  it('refuses another client, and every role that is not the client, PMCM or the system', async () => {
    for (const verified of [
      actor(OpsUserRole.Client, `someone-else-${suffix}@example.test`),
      actor(OpsUserRole.Supplier),
      actor(OpsUserRole.Coordinator),
      actor(OpsUserRole.Guest),
    ]) {
      await expect(service.statementFor(id('event_a'), verified)).rejects.toThrow(ForbiddenException);
    }
    await expect(service.statementFor(id('event_a'), actor(OpsUserRole.System, 'system@example.test'))).resolves.toMatchObject({ available: true });
    await expect(service.statementFor(`missing_${suffix}`, actor(OpsUserRole.PmcmAdmin, 'admin@example.test'))).rejects.toThrow(/Event not found/);
  });

  it('lets the client report a payment, which waits for PMCM to check it and is never applied on its own', async () => {
    const client = actor(OpsUserRole.Client, clientEmail);
    const reported = await submissions.submit(id('event_c'), { amount: 40000, paidDate: '2026-11-10', method: 'GCash', referenceNumber: `GC-CLIENT-${suffix}`, milestoneId: id('milestone_c') }, client);

    expect(reported).toMatchObject({ state: 'checking', amount: 40000, forPayment: 'Downpayment', fromClient: true, hasProof: false, unapplied: 40000 });
    const statement = await service.statementFor(id('event_c'), client);
    expect(statement).toMatchObject({ received: 0, balance: 80000, creditHeld: 0 });
    expect(statement.submissions.map((submission) => submission.id)).toEqual([reported.id]);
    const stored = await prisma.opsPaymentReceipt.findUniqueOrThrow({ where: { id: reported.id } });
    expect(stored).toMatchObject({ source: 'client', status: 'recorded', intendedMilestoneId: id('milestone_c'), eventId: id('event_c') });
    // PMCM hears about it, with a link straight to the receipt.
    expect(notices).toContainEqual(expect.objectContaining({ recipient: 'PMCM Admin', action: { kind: 'payment_receipt', receiptId: reported.id } }));
  });

  it('tells the client when PMCM accepts a payment they reported, and why PMCM did not accept one', async () => {
    const client = actor(OpsUserRole.Client, clientEmail);
    const accepted = await submissions.submit(id('event_c'), { amount: 10000, paidDate: '2026-11-11', method: 'GCash', referenceNumber: `GC-OK-${suffix}` }, client);
    const refused = await submissions.submit(id('event_c'), { amount: 5000, paidDate: '2026-11-12', method: 'GCash', referenceNumber: `GC-NO-${suffix}` }, client);

    await receipts.verify(accepted.id, { notes: 'Matched the wallet history.' }, finance);
    await receipts.reject(refused.id, { reason: 'No matching credit; please send the transfer slip.' }, finance);

    const toClient = notices.filter((notice) => notice.recipient === 'Client' && notice.eventId === id('event_c'));
    expect(toClient).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringMatching(/^PMCM confirmed your ₱10,000 GCash payment/), action: { kind: 'event_section', eventId: id('event_c'), section: 'billing' } }),
      expect.objectContaining({ message: expect.stringContaining('No matching credit; please send the transfer slip.') }),
    ]));
    expect(JSON.stringify(toClient)).not.toContain('Matched the wallet history.');
  });

  it('refuses a payment report from anyone but the event client, before the statement is sent, or for a payment PMCM already has', async () => {
    const input = { amount: 1000, paidDate: '2026-11-10', method: 'Bank Transfer' as const, referenceNumber: `BT-${suffix}` };
    for (const verified of [actor(OpsUserRole.Client, `someone-else-${suffix}@example.test`), actor(OpsUserRole.Supplier), actor(OpsUserRole.PmcmAdmin, 'admin@example.test'), actor(OpsUserRole.Coordinator)]) {
      await expect(submissions.submit(id('event_c'), input, verified)).rejects.toThrow(ForbiddenException);
    }
    const client = actor(OpsUserRole.Client, clientEmail);
    await expect(submissions.submit(id('event_b'), input, client)).rejects.toThrow(ConflictException);
    await expect(submissions.submit(id('event_c'), { ...input, milestoneId: id('milestone_b') }, client)).rejects.toThrow(NotFoundException);
    await expect(submissions.submit(id('event_c'), { ...input, method: 'GCash', referenceNumber: `GC-CLIENT-${suffix}` }, client)).rejects.toThrow(/already has a payment/);
    await expect(submissions.attachProof(id('event_c'), `missing_${suffix}`, { objectId: 'obj' }, actor(OpsUserRole.Supplier))).rejects.toThrow(ForbiddenException);
  });
});
