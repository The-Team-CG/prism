import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import type { AuditWriter } from '@prism/kernel/access-control';
import { EventFinancialsService } from '../../src/modules/commercial/application/billing/event-financials.service';
import { PaymentReceiptService } from '../../src/modules/commercial/application/billing/payment-receipt.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!live)('event financial summary against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const actor = { id: `fin-actor-${suffix}`, name: `Financials Test ${suffix}`, role: 'pmcm-admin' };
  const id = (name: string) => `fin_${name}_${suffix}`;
  const auditWriter: AuditWriter = { write: async () => undefined };
  let prisma: PrismaService;
  let receipts: PaymentReceiptService;
  const eventId = id('event');

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    receipts = new PaymentReceiptService(prisma, auditWriter);

    await prisma.opsInquiry.create({ data: {
      id: id('inquiry'), clientName: 'Financials Client', email: `${id('inquiry')}@example.test`, normalizedEmail: `${id('inquiry')}@example.test`,
      eventName: 'Financials Event', eventDate: new Date('2031-04-18T09:00:00.000Z'), clientType: 'corporate',
    } });
    await prisma.opsEvent.create({ data: { id: eventId, inquiryId: id('inquiry'), clientName: 'Financials Client', eventName: 'Financials Event', eventDate: new Date('2031-04-18T09:00:00.000Z') } });

    // Price: an approved estimate of 140,000 in two categories, and a statement of 150,000.
    await prisma.opsCostEstimate.create({ data: { id: id('estimate'), eventId, budgetAmount: 200000, totalAmount: 140000, status: 'approved' } });
    await prisma.opsCostEstimateLine.createMany({ data: [
      { id: id('line1'), estimateId: id('estimate'), category: 'Catering', description: 'Buffet', quantity: 1, unitAmount: 90000, totalAmount: 90000 },
      { id: id('line2'), estimateId: id('estimate'), category: 'Sound', description: 'PA system', quantity: 1, unitAmount: 50000, totalAmount: 50000 },
    ] });
    await prisma.opsBillingStatement.create({ data: { id: id('statement'), eventId, number: `BS-${suffix}`, totalAmount: 150000 } });

    // Milestones: two active, and one replaced that still carries an old payment which must not count.
    const due = new Date('2031-03-01T00:00:00.000Z');
    await prisma.opsPaymentMilestone.createMany({ data: [
      { id: id('deposit'), eventId, label: 'Deposit', amount: 100000, remainingBalance: 100000, dueDate: due },
      { id: id('balance'), eventId, label: 'Balance', amount: 50000, remainingBalance: 50000, dueDate: new Date('2026-10-01T00:00:00.000Z') },
      { id: id('old'), eventId, label: 'Replaced deposit', amount: 70000, remainingBalance: 70000, dueDate: due, supersededAt: new Date() },
    ] });
    // Money: 60,000 verified and 30,000 not yet checked go to the deposit; 5,000 of the unchecked is undone; 12,000 is held unapplied.
    const checked = await receipts.recordReceipt({ amount: 60000, receivedDate: '2026-11-01', method: 'Bank Transfer', referenceNumber: `FIN-A-${suffix}`, eventId } as never, actor);
    await receipts.allocate(checked.id, { milestoneId: id('deposit'), amount: 60000 }, actor);
    await receipts.verify(checked.id, { notes: 'Matches the statement' }, actor);
    const unchecked = await receipts.recordReceipt({ amount: 30000, receivedDate: '2026-11-02', method: 'GCash', referenceNumber: `FIN-B-${suffix}`, eventId } as never, actor);
    const slice = (await receipts.allocate(unchecked.id, { milestoneId: id('deposit'), amount: 30000 }, actor)).allocations[0];
    await receipts.reverseAllocation(unchecked.id, slice.id, { reason: 'Wrong milestone' }, actor);
    await receipts.allocate(unchecked.id, { milestoneId: id('deposit'), amount: 25000 }, actor);
    await receipts.recordReceipt({ amount: 12000, receivedDate: '2026-11-03', method: 'Cheque', referenceNumber: `FIN-C-${suffix}`, eventId } as never, actor);
    const stale = await receipts.recordReceipt({ amount: 70000, receivedDate: '2026-10-01', method: 'Bank Transfer', referenceNumber: `FIN-D-${suffix}`, eventId } as never, actor);
    await prisma.opsPaymentRecord.create({ data: {
      id: id('staleRecord'), eventId, milestoneId: id('old'), amountReceived: 70000, paymentDate: new Date('2026-10-01'), paymentMethod: 'Bank Transfer', receiptId: stale.id,
    } });

    // Supplier side: a selected Catering quote (60,000) and a locked Sound quote (30,000); a received quote is not committed.
    await prisma.opsSupplierCategory.create({ data: { id: id('category'), slug: `${id('category')}-slug`, name: 'Financials Category' } });
    await prisma.opsSupplier.create({ data: { id: id('supplier'), categoryId: id('category'), name: 'Financials Supplier', email: `${id('supplier')}@example.test` } });
    for (const [key, category, amount, status] of [['q1', 'Catering', 60000, 'selected'], ['q2', 'Sound', 30000, 'locked'], ['q3', 'Catering', 99000, 'received']] as const) {
      await prisma.opsSupplierQuoteRequest.create({ data: {
        id: id(`${key}req`), eventId, supplierId: id('supplier'), categoryId: id('category'), supplierName: 'Financials Supplier', category, accessToken: `${id(key)}-token`,
        status: 'selected', assignmentStatus: 'confirmed',
      } });
      await prisma.opsSupplierQuote.create({ data: {
        id: id(key), eventId, requestId: id(`${key}req`), supplierId: id('supplier'), categoryId: id('category'), supplierName: 'Financials Supplier', category, amount, status,
      } });
    }
    await prisma.opsSupplierPayableMilestone.create({ data: { id: id('payable'), eventId, requestId: id('q1req'), quoteId: id('q1'), supplierId: id('supplier'), label: 'Catering deposit', amount: 60000, createdBy: actor.name } });
    const payout = (key: string, kind: string, amount: number, extra: Record<string, unknown> = {}) => prisma.opsSupplierPayoutRecord.create({ data: {
      id: id(key), eventId, milestoneId: id('payable'), requestId: id('q1req'), quoteId: id('q1'), supplierId: id('supplier'), kind, amount,
      paymentDate: new Date('2026-11-05'), method: 'bank transfer', referenceNumber: key, recordedBy: actor.name, ...extra,
    } });
    await payout('release1', 'release', 40000);
    await payout('reversal1', 'reversal', 5000, { reversesRecordId: id('release1') });
  });

  afterAll(async () => {
    if (!live) return;
    await prisma.opsSupplierPayoutRecord.deleteMany({ where: { eventId, reversesRecordId: { not: null } } });
    await prisma.opsSupplierPayoutRecord.deleteMany({ where: { eventId } });
    await prisma.opsSupplierPayableMilestone.deleteMany({ where: { eventId } });
    await prisma.opsSupplierQuote.deleteMany({ where: { eventId } });
    await prisma.opsSupplierQuoteRequest.deleteMany({ where: { eventId } });
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId, reversesRecordId: { not: null } } });
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId } });
    await prisma.opsPaymentRefund.deleteMany({ where: { recordedBy: actor.name } });
    await prisma.opsPaymentReceipt.deleteMany({ where: { recordedBy: actor.name } });
    await prisma.opsPaymentMilestone.deleteMany({ where: { eventId } });
    await prisma.opsBillingStatement.deleteMany({ where: { eventId } });
    await prisma.opsCostEstimateLine.deleteMany({ where: { estimateId: id('estimate') } });
    await prisma.opsCostEstimate.deleteMany({ where: { eventId } });
    await prisma.opsSupplier.deleteMany({ where: { id: id('supplier') } });
    await prisma.opsSupplierCategory.deleteMany({ where: { id: id('category') } });
    await prisma.opsEvent.deleteMany({ where: { id: eventId } });
    await prisma.opsInquiry.deleteMany({ where: { id: id('inquiry') } });
    await prisma.$disconnect();
  });

  it('reports price, collections, supplier cost and margin from what is actually recorded', async () => {
    const summary = await new EventFinancialsService(prisma).getSummary(eventId);

    expect(summary).toMatchObject({ eventId, eventName: 'Financials Event' });
    expect(summary.price).toEqual({ estimated: 140000, estimateStatus: 'approved', billed: 150000, statementNumber: `BS-${suffix}` });
    // The replaced milestone and its 70,000 payment are not part of what this statement collects. Only the past-due balance is overdue;
    // unapplied is the 12,000 cheque plus the 5,000 left of the receipt whose payment was undone and re-applied in part.
    expect(summary.collections).toEqual({
      scheduled: 150000, received: 85000, credit: 0, outstanding: 65000, overdue: 50000, verifiedReceived: 60000, unverifiedReceived: 25000, unapplied: 12000 + 5000,
    });
    // Only selected and locked quotes commit PMCM; the received quote does not. A reversal takes money back out.
    expect(summary.costs).toEqual({ committed: 90000, scheduled: 60000, actual: 35000, toPay: 55000 });
    expect(summary.margin).toEqual({ expected: 60000, basis: 'statement', cashToDate: 50000 });
    expect(summary.categories).toEqual([
      { category: 'Catering', estimatedPrice: 90000, committedCost: 60000, actualCost: 35000, expectedMargin: 30000 },
      { category: 'Sound', estimatedPrice: 50000, committedCost: 30000, actualCost: 0, expectedMargin: 20000 },
    ]);
    expect(summary.notes).toEqual(expect.arrayContaining([
      'PHP 25,000 of the money received comes from receipts not yet verified against a bank or wallet statement.',
      'PHP 30,000 of committed supplier cost has no payment schedule yet.',
    ]));
  });

  it('refuses an event that does not exist', async () => {
    await expect(new EventFinancialsService(prisma).getSummary(`missing_${suffix}`)).rejects.toThrow(/Event not found/);
  });
});
