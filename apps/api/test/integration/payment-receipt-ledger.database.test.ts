import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '@prism/kernel/database';
import { WorkflowCommandService } from '@prism/kernel/event-core';
import type { AuditWriter } from '@prism/kernel/access-control';
import { PaymentOperationsService } from '../../src/modules/commercial/application/billing/payment-operations.service';
import { PaymentReceiptService } from '../../src/modules/commercial/application/billing/payment-receipt.service';

const databaseUrl = process.env.P0_TEST_DATABASE_URL?.trim();
const live = Boolean(databaseUrl && /^postgresql:\/\/[^@]+@127\.0\.0\.1:55437\/prism_p0(?:\?|$)/.test(databaseUrl));

if (databaseUrl && !live) {
  throw new Error('P0_TEST_DATABASE_URL must target 127.0.0.1:55437/prism_p0');
}

describe.skipIf(!live)('payment receipt ledger against PostgreSQL', () => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 16);
  const actor = { id: `ledger-actor-${suffix}`, name: `Ledger Test ${suffix}`, role: 'pmcm-admin', email: 'ledger-test@example.test' };
  const ids = {
    inquiryA: `ledger_inquiry_a_${suffix}`, inquiryB: `ledger_inquiry_b_${suffix}`,
    eventA: `ledger_event_a_${suffix}`, eventB: `ledger_event_b_${suffix}`,
  };
  const auditWriter: AuditWriter = { write: async () => undefined };
  let prisma: PrismaService;
  let receipts: PaymentReceiptService;
  let payments: PaymentOperationsService;
  let sequence = 0;
  let milestoneSequence = 0;
  const ref = () => `LT-${suffix}-${(sequence += 1)}`;
  const today = '2026-11-10';

  // Every case builds the milestones it needs, so no case depends on what another left owed or paid.
  const newMilestone = async (eventId: string, label: string, amount: number) => {
    const id = `ledger_ms_${suffix}_${(milestoneSequence += 1)}`;
    await prisma.opsPaymentMilestone.create({ data: { id, eventId, label, amount, remainingBalance: amount, dueDate: new Date('2031-03-01T00:00:00.000Z') } });
    return id;
  };
  const milestone = (id: string) => prisma.opsPaymentMilestone.findUniqueOrThrow({ where: { id } });
  const record = (amount: number, extra: Record<string, unknown> = {}) =>
    receipts.recordReceipt({ amount, receivedDate: today, method: 'Bank Transfer', referenceNumber: ref(), ...extra } as never, actor);

  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    process.env.PRISMA_DATABASE_URL = databaseUrl!;
    process.env.DIRECT_URL = databaseUrl!;
    process.env.DB_SSL = 'false';
    prisma = new PrismaService();
    receipts = new PaymentReceiptService(prisma, auditWriter);
    payments = new PaymentOperationsService(prisma, auditWriter, { write: async () => undefined } as never, new WorkflowCommandService());

    for (const [inquiryId, eventId, name] of [[ids.inquiryA, ids.eventA, 'A'], [ids.inquiryB, ids.eventB, 'B']] as const) {
      await prisma.opsInquiry.create({ data: {
        id: inquiryId, clientName: `Ledger Client ${name}`, email: `${inquiryId}@example.test`, normalizedEmail: `${inquiryId}@example.test`,
        eventName: `Ledger Event ${name}`, eventDate: new Date('2031-04-18T09:00:00.000Z'), clientType: 'corporate',
      } });
      await prisma.opsEvent.create({ data: {
        id: eventId, inquiryId, clientName: `Ledger Client ${name}`, eventName: `Ledger Event ${name}`, eventDate: new Date('2031-04-18T09:00:00.000Z'),
      } });
    }
  });

  afterAll(async () => {
    if (!live) return;
    const eventIds = [ids.eventA, ids.eventB];
    // Reversals point at the payments they undo, so they go first; receipts go once nothing references them.
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId: { in: eventIds }, reversesRecordId: { not: null } } });
    await prisma.opsPaymentRecord.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsPaymentRefund.deleteMany({ where: { recordedBy: actor.name } });
    await prisma.opsPaymentReceipt.deleteMany({ where: { recordedBy: actor.name } });
    await prisma.opsPaymentMilestone.deleteMany({ where: { eventId: { in: eventIds } } });
    await prisma.opsEvent.deleteMany({ where: { id: { in: eventIds } } });
    await prisma.opsInquiry.deleteMany({ where: { id: { in: [ids.inquiryA, ids.inquiryB] } } });
    await prisma.$disconnect();
  });

  it('holds money unapplied, then splits it across milestones of different events, within what is unapplied and owed', async () => {
    const deposit = await newMilestone(ids.eventA, 'Deposit', 100000);
    const other = await newMilestone(ids.eventB, 'Deposit', 80000);
    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const receipt = await record(120000, { eventId: ids.eventA, payerName: 'Ana Reyes' });
    expect(receipt).toMatchObject({ status: 'recorded', applied: 0, unapplied: 120000, allocations: [] });
    expect((await receipts.listReceipts({ unapplied: true, eventId: ids.eventA })).map((entry) => entry.id)).toContain(receipt.id);

    const afterFirst = await receipts.allocate(receipt.id, { milestoneId: deposit, amount: 100000 }, actor);
    expect(afterFirst).toMatchObject({ applied: 100000, unapplied: 20000 });
    expect(await milestone(deposit)).toMatchObject({ amountPaid: 100000, remainingBalance: 0, status: 'paid' });

    // The client paid the wrong event: the rest of the money goes to the other event's milestone.
    const afterSecond = await receipts.allocate(receipt.id, { milestoneId: other, amount: 20000 }, actor);
    expect(afterSecond).toMatchObject({ applied: 120000, unapplied: 0 });
    expect(afterSecond.allocations.map((slice) => [slice.eventId, slice.milestoneLabel, slice.amount])).toEqual([
      [ids.eventA, 'Deposit', 100000],
      [ids.eventB, 'Deposit', 20000],
    ]);
    expect(await milestone(other)).toMatchObject({ amountPaid: 20000, remainingBalance: 60000, status: 'partially_paid' });
    expect((await receipts.listReceipts({ unapplied: true, eventId: ids.eventA })).map((entry) => entry.id)).not.toContain(receipt.id);

    const spare = await record(10000);
    await expect(receipts.allocate(spare.id, { milestoneId: balance, amount: 10001 }, actor)).rejects.toThrow(/Only PHP 10,000 of this receipt is unapplied/);
    await expect(receipts.allocate(spare.id, { milestoneId: deposit, amount: 1 }, actor)).rejects.toThrow(/milestone has only PHP 0 left/);
    expect(await milestone(balance)).toMatchObject({ amountPaid: 0, status: 'pending' });
  });

  it('lets only one of two concurrent allocations take money that cannot cover both', async () => {
    const first = await newMilestone(ids.eventA, 'Concurrent one', 50000);
    const second = await newMilestone(ids.eventB, 'Concurrent two', 80000);
    const receipt = await record(60000);
    const settled = await Promise.allSettled([
      receipts.allocate(receipt.id, { milestoneId: first, amount: 40000 }, actor),
      receipts.allocate(receipt.id, { milestoneId: second, amount: 40000 }, actor),
    ]);
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = settled.find((result) => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(ConflictException);
    const after = await receipts.getReceipt(receipt.id);
    expect(after).toMatchObject({ applied: 40000, unapplied: 20000 });
    expect(after.allocations.filter((slice) => !slice.reversed)).toHaveLength(1);
    // Exactly the milestone that won holds the money; the other was left untouched.
    const paid = [(await milestone(first)).amountPaid, (await milestone(second)).amountPaid].sort((a, b) => a - b);
    expect(paid).toEqual([0, 40000]);
  });

  it('refuses the same transfer twice however its reference is written, including two at once, until the first is reversed', async () => {
    const reference = `Dup-${suffix}`;
    const first = await receipts.recordReceipt({ amount: 5000, receivedDate: today, method: 'GCash', referenceNumber: reference } as never, actor);
    await expect(receipts.recordReceipt({ amount: 5000, receivedDate: today, method: 'GCash', referenceNumber: ` ${reference.toLowerCase().replace('-', ' ')} ` } as never, actor))
      .rejects.toThrow(/already recorded/);
    // Another channel's reference is a different transfer.
    await expect(receipts.recordReceipt({ amount: 5000, receivedDate: today, method: 'Bank Transfer', referenceNumber: reference } as never, actor)).resolves.toBeTruthy();

    const racing = `Race-${suffix}`;
    const settled = await Promise.allSettled([1, 2].map((turn) =>
      receipts.recordReceipt({ amount: 7000, receivedDate: today, method: 'GCash', referenceNumber: racing, idempotencyKey: `race-${turn}-${suffix}` } as never, actor)));
    expect(settled.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((settled.find((result) => result.status === 'rejected') as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);

    // The database refuses a receipt that stops counting while still holding its reference.
    await expect(prisma.opsPaymentReceipt.update({ where: { id: first.id }, data: { status: 'reversed' } })).rejects.toThrow();

    await receipts.reverseReceipt(first.id, { reason: 'Bounced; never arrived' }, actor);
    expect(await prisma.opsPaymentReceipt.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ status: 'reversed', referenceKey: null, referenceNumber: reference });
    await expect(receipts.recordReceipt({ amount: 5000, receivedDate: today, method: 'GCash', referenceNumber: reference } as never, actor)).resolves.toMatchObject({ status: 'recorded' });
  });

  it('undoes a payment with a negative record exactly once, restoring the milestone and the unapplied money', async () => {
    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const receipt = await record(30000);
    const applied = await receipts.allocate(receipt.id, { milestoneId: balance, amount: 30000 }, actor);
    const slice = applied.allocations[0];
    expect(await milestone(balance)).toMatchObject({ amountPaid: 30000, status: 'partially_paid' });

    const reversed = await receipts.reverseAllocation(receipt.id, slice.id, { reason: 'Applied to the wrong milestone' }, actor);
    expect(reversed).toMatchObject({ applied: 0, unapplied: 30000 });
    expect(reversed.allocations[0]).toMatchObject({ reversed: true, reversalReason: 'Applied to the wrong milestone' });
    expect(await milestone(balance)).toMatchObject({ amountPaid: 0, remainingBalance: 50000, status: 'pending' });
    const reversalRecord = await prisma.opsPaymentRecord.findUniqueOrThrow({ where: { id: reversed.allocations[0].reversalId! } });
    expect(reversalRecord).toMatchObject({ amountReceived: -30000, reversesRecordId: slice.id, receiptId: receipt.id });

    await expect(receipts.reverseAllocation(receipt.id, slice.id, { reason: 'Again' }, actor)).rejects.toThrow(/already reversed/);
    await expect(receipts.reverseAllocation(receipt.id, reversalRecord.id, { reason: 'Undo the undo' }, actor)).rejects.toThrow(/not a reversal/);
    // The database itself refuses a second reversal of the same payment and a payment with a negative amount.
    await expect(prisma.opsPaymentRecord.create({ data: {
      id: `payrec_dup_${suffix}`, eventId: ids.eventA, milestoneId: balance, amountReceived: -30000, paymentDate: new Date(), paymentMethod: 'Bank Transfer',
      receiptId: receipt.id, reversesRecordId: slice.id,
    } })).rejects.toThrow();
    await expect(prisma.opsPaymentRecord.create({ data: {
      id: `payrec_neg_${suffix}`, eventId: ids.eventA, milestoneId: balance, amountReceived: -1, paymentDate: new Date(), paymentMethod: 'Bank Transfer', receiptId: receipt.id,
    } })).rejects.toThrow();
  });

  it('pays back only unapplied money, and a receipt that was partly paid back cannot be said never to have arrived', async () => {
    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const receipt = await record(50000);
    await receipts.allocate(receipt.id, { milestoneId: balance, amount: 30000 }, actor);
    await expect(receipts.recordRefund(receipt.id, { amount: 25000, refundedDate: today, method: 'Bank Transfer', reason: 'Overpaid' }, actor)).rejects.toThrow(/Only PHP 20,000 is unapplied/);

    const refunded = await receipts.recordRefund(receipt.id, { amount: 20000, refundedDate: today, method: 'Bank Transfer', reason: 'Overpaid', referenceNumber: ref() }, actor);
    expect(refunded).toMatchObject({ applied: 30000, refunded: 20000, unapplied: 0 });
    expect(refunded.refunds).toHaveLength(1);
    await expect(receipts.reverseReceipt(receipt.id, { reason: 'Bounced' }, actor)).rejects.toThrow(/refunds/);
    await expect(receipts.recordRefund(receipt.id, { amount: 1, refundedDate: today, method: 'Bank Transfer', reason: 'More' }, actor)).rejects.toThrow(/Only PHP 0 is unapplied/);
  });

  it('reverses a bounced receipt together with everything applied from it, and stops counting it', async () => {
    const other = await newMilestone(ids.eventB, 'Deposit', 80000);
    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const receipt = await record(80000);
    await receipts.allocate(receipt.id, { milestoneId: other, amount: 30000 }, actor);
    await receipts.allocate(receipt.id, { milestoneId: balance, amount: 20000 }, actor);
    expect(await milestone(other)).toMatchObject({ amountPaid: 30000 });

    await expect(receipts.reject(receipt.id, { reason: 'Not real' }, actor)).rejects.toThrow(/Reverse its allocations/);
    const reversed = await receipts.reverseReceipt(receipt.id, { reason: 'Cheque bounced' }, actor);
    expect(reversed).toMatchObject({ status: 'reversed', applied: 0, unapplied: 0, reversalReason: 'Cheque bounced' });
    expect(reversed.allocations).toHaveLength(2);
    expect(reversed.allocations.every((slice) => slice.reversed)).toBe(true);
    expect(await milestone(other)).toMatchObject({ amountPaid: 0, remainingBalance: 80000, status: 'pending' });
    expect(await milestone(balance)).toMatchObject({ amountPaid: 0, remainingBalance: 50000, status: 'pending' });
    expect((await receipts.listReceipts({ unapplied: true })).map((entry) => entry.id)).not.toContain(receipt.id);
    await expect(receipts.allocate(receipt.id, { milestoneId: balance, amount: 1 }, actor)).rejects.toThrow(/reversed receipt cannot be applied/);
  });

  it('verifies once and rejects only an unverified, unapplied receipt', async () => {
    const toVerify = await record(1000);
    const verified = await receipts.verify(toVerify.id, { notes: 'Matches the BDO statement line of 10 Nov' }, actor);
    expect(verified).toMatchObject({ status: 'verified', verifiedBy: actor.name, verificationNotes: 'Matches the BDO statement line of 10 Nov' });
    await expect(receipts.verify(toVerify.id, { notes: 'Again' }, actor)).rejects.toThrow(/already verified/);
    await expect(receipts.reject(toVerify.id, { reason: 'Changed my mind' }, actor)).rejects.toThrow(/reverse it instead/);

    const toReject = await record(1000);
    expect(await receipts.reject(toReject.id, { reason: 'No such transfer on the statement' }, actor)).toMatchObject({ status: 'rejected', unapplied: 0, rejectionReason: 'No such transfer on the statement' });
  });

  it('replays a retried request by its key, refuses the key reused for different content, and flags a likely duplicate without blocking it', async () => {
    const key = `replay-${suffix}`;
    const input = { amount: 4000, receivedDate: today, method: 'Cheque', referenceNumber: ref(), idempotencyKey: key } as never;
    const first = await receipts.recordReceipt(input, actor);
    const second = await receipts.recordReceipt(input, actor);
    expect(second.id).toBe(first.id);
    expect(await prisma.opsPaymentReceipt.count({ where: { idempotencyKey: key } })).toBe(1);
    await expect(receipts.recordReceipt({ amount: 4001, receivedDate: today, method: 'Cheque', referenceNumber: ref(), idempotencyKey: key } as never, actor)).rejects.toThrow(/reused for different content/);

    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const allocationKey = `alloc-${suffix}`;
    const funded = await record(9000);
    await receipts.allocate(funded.id, { milestoneId: balance, amount: 9000, idempotencyKey: allocationKey }, actor);
    const replayed = await receipts.allocate(funded.id, { milestoneId: balance, amount: 9000, idempotencyKey: allocationKey }, actor);
    expect(replayed.allocations).toHaveLength(1);
    expect(replayed.applied).toBe(9000);
    expect(await milestone(balance)).toMatchObject({ amountPaid: 9000 });

    const original = await receipts.recordReceipt({ amount: 15500, receivedDate: today, method: 'GCash', payerName: 'Ben Cruz' } as never, actor);
    const repeat = await receipts.recordReceipt({ amount: 15500, receivedDate: today, method: 'GCash', payerName: ' ben cruz ' } as never, actor);
    expect(repeat.id).not.toBe(original.id);
    expect(repeat.possibleDuplicateOfId).toBe(original.id);
    expect(original.possibleDuplicateOfId).toBeNull();
  });

  it('records money against a milestone through the existing payment path as a receipt applied in one step, and refuses its reference elsewhere', async () => {
    const balance = await newMilestone(ids.eventA, 'Balance', 50000);
    const other = await newMilestone(ids.eventB, 'Deposit', 80000);
    const reference = ref();
    const result = await payments.recordPayment(ids.eventA, balance, { amountReceived: 2000, paymentDate: today, paymentMethod: 'Bank Transfer', referenceNumber: reference }, actor);
    const history = result.history.filter((entry) => entry.referenceNumber === reference);
    expect(history).toHaveLength(1);
    expect(history[0].receiptId).toBeTruthy();
    const linked = await receipts.getReceipt(history[0].receiptId!);
    expect(linked).toMatchObject({ amount: 2000, applied: 2000, unapplied: 0, eventId: ids.eventA, legacy: false });

    await expect(payments.recordPayment(ids.eventB, other, { amountReceived: 2000, paymentDate: today, paymentMethod: 'Bank Transfer', referenceNumber: reference }, actor))
      .rejects.toThrow(/already recorded/);
    expect(await milestone(other)).toMatchObject({ amountPaid: 0 });
  });
});
