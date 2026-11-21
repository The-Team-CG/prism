import { ConflictException } from '@nestjs/common';
import type { Prisma, OpsPaymentMilestone, OpsPaymentReceipt } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { normalizeReference, withdrawCarriedCredit } from '../../domain/payment-receipt.policy';

export function paymentStatus(amountPaid: number, amount: number) {
  if (amountPaid === amount) return 'paid';
  if (amountPaid > 0) return 'partially_paid';
  return 'pending';
}

export async function lockPaymentMilestone(tx: Prisma.TransactionClient, milestoneId: string) {
  if (tx.$queryRaw) {
    // QUERY_AUDIT_RAW_SQL: lock the milestone row before applying a payment mutation.
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "commercial"."payment_milestones" WHERE "id" = ${milestoneId} FOR UPDATE`;
  }
  return tx.opsPaymentMilestone.findUnique({ where: { id: milestoneId } });
}

export async function lockPaymentReceipt(tx: Prisma.TransactionClient, receiptId: string) {
  // QUERY_AUDIT_RAW_SQL: serialize every change to one receipt so its balance is checked against what is committed.
  await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "commercial"."payment_receipts" WHERE "id" = ${receiptId} FOR UPDATE`;
}

/** What a milestone still owes: its amount less credit applied and every record against it, reversals included. */
export async function milestoneRemaining(tx: Prisma.TransactionClient, milestone: OpsPaymentMilestone) {
  const records = await tx.opsPaymentRecord.findMany({ where: { milestoneId: milestone.id }, select: { amountReceived: true } });
  return milestone.amount - milestone.creditApplied - records.reduce((sum, record) => sum + record.amountReceived, 0);
}

/**
 * Recompute a milestone's paid amount, balance and status from its credit and records. The milestone must already be
 * locked. A superseded milestone stays superseded: a corrected statement replaced it whatever its records now add up to.
 */
export async function refreshPaymentMilestone(tx: Prisma.TransactionClient, milestone: OpsPaymentMilestone) {
  const records = await tx.opsPaymentRecord.findMany({ where: { milestoneId: milestone.id }, select: { amountReceived: true } });
  const amountPaid = milestone.creditApplied + records.reduce((sum, record) => sum + record.amountReceived, 0);
  return tx.opsPaymentMilestone.update({
    where: { id: milestone.id },
    data: {
      creditApplied: milestone.creditApplied,
      amountPaid,
      remainingBalance: Math.max(0, milestone.amount - amountPaid),
      status: milestone.supersededAt ? 'superseded' : paymentStatus(amountPaid, milestone.amount),
    },
  });
}

/** Statements an event can chain through corrections; far more than any event will ever have. */
const MAX_CORRECTION_CHAIN = 50;

/**
 * Undoing a payment on a superseded milestone undoes the credit a corrected statement carried from it, so money that
 * never arrived stops counting. The credit followed every later correction, so it is taken from the statement in force.
 */
export async function withdrawCreditCarriedFrom(tx: Prisma.TransactionClient, superseded: OpsPaymentMilestone, amount: number) {
  if (!superseded.supersededAt || amount <= 0) return;
  // Milestones without a statement predate statement links; only an event's single statement could have replaced them.
  let statementId = superseded.statementId ?? (await tx.opsBillingStatement.findFirst({
    where: { eventId: superseded.eventId, supersedesStatementId: null, status: 'superseded' },
    orderBy: [{ generatedAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  }))?.id;
  let replacement: string | undefined;
  // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: one hop per correction of this invoice, capped by MAX_CORRECTION_CHAIN.
  for (let hop = 0; statementId && hop < MAX_CORRECTION_CHAIN; hop += 1) {
    const next = await tx.opsBillingStatement.findFirst({ where: { eventId: superseded.eventId, supersedesStatementId: statementId }, select: { id: true } });
    if (!next) break;
    replacement = statementId = next.id;
  }
  if (!replacement) throw creditNotFound();
  // QUERY_AUDIT_RAW_SQL: lock the corrected statement's milestones, in the order a correction locks them, before moving credit.
  await tx.$queryRaw`SELECT "id" FROM "commercial"."payment_milestones" WHERE "event_id" = ${superseded.eventId} AND "statement_id" = ${replacement} ORDER BY "id" FOR UPDATE`;
  const carriers = await tx.opsPaymentMilestone.findMany({
    where: { eventId: superseded.eventId, statementId: replacement, supersededAt: null },
    orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
  });
  const changes = withdrawCarriedCredit(carriers, amount);
  if (!changes) throw creditNotFound();
  // QUERY_AUDIT_ALLOW_BOUNDED_LOOP: bounded by the corrected statement's milestones; each refresh reads that milestone's own records.
  for (const change of changes) await refreshPaymentMilestone(tx, { ...change.milestone, creditApplied: change.creditApplied });
}

function creditNotFound() {
  return new ConflictException('This payment was carried as credit to a corrected statement, but that credit could not be found. Check the statement before reversing the payment.');
}

/** The receipt holding this reference. Only a receipt that still counts holds its key, so a reversed one never matches. */
export function findLiveReferenceReceipt(tx: Prisma.TransactionClient, method: string, referenceKey: string) {
  return tx.opsPaymentReceipt.findFirst({ where: { method, referenceKey } });
}

/**
 * The money behind a payment recorded straight against a milestone: refuse a reference another receipt already holds
 * (that transfer is to be allocated from its receipt, not recorded again), then keep it as a receipt.
 */
export async function recordReceiptForPayment(tx: Prisma.TransactionClient, input: {
  eventId: string;
  amount: number;
  receivedDate: Date;
  method: string;
  referenceNumber?: string;
  recordedBy: string;
  recordedById: string;
}) {
  const referenceNumber = input.referenceNumber?.trim() ?? '';
  const referenceKey = normalizeReference(referenceNumber);
  const existing = referenceKey ? await findLiveReferenceReceipt(tx, input.method, referenceKey) : null;
  if (existing) throw referenceInUse(existing);
  return tx.opsPaymentReceipt.create({
    data: {
      id: `prcp_${randomUUID()}`,
      amount: input.amount,
      receivedDate: input.receivedDate,
      method: input.method,
      referenceNumber,
      referenceKey,
      eventId: input.eventId,
      recordedBy: input.recordedBy,
      recordedById: input.recordedById,
    },
  });
}

/** One bank reference identifies one transfer: a second entry is refused and points at the receipt already holding it. */
export function referenceInUse(existing: Pick<OpsPaymentReceipt, 'id' | 'method' | 'referenceNumber' | 'amount' | 'receivedDate'>) {
  const received = existing.receivedDate.toISOString().slice(0, 10);
  return new ConflictException(
    `A ${existing.method} receipt with reference "${existing.referenceNumber}" is already recorded (PHP ${existing.amount.toLocaleString('en-PH')} on ${received}, ${existing.id}). `
      + 'Allocate that receipt instead of recording the same transfer again.',
  );
}
