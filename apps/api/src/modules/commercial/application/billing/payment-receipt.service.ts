import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException, Optional, ServiceUnavailableException } from '@nestjs/common';
import { Prisma, type OpsPaymentReceipt } from '@prisma/client';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@prism/kernel/database';
import type { PrismTransactionContext } from '@prism/kernel/shared-kernel';
import { AuditActionType, AuditCategory } from '@prism/kernel/event-core';
import { AUDIT_WRITER, type AuditWriter, writeAudit } from '@prism/kernel/access-control';
import { STORED_RECEIPT_EVIDENCE_READER, type StoredReceiptEvidenceReader } from '@prism/contexts/platform-ops';
import type {
  AllocatePaymentReceiptInput,
  AttachPaymentReceiptEvidenceInput,
  EarmarkPaymentReceiptInput,
  ListPaymentReceiptsQuery,
  PrismPaymentAllocationTarget,
  PrismPaymentReceipt,
  RecordPaymentReceiptInput,
  RecordPaymentRefundInput,
  RejectPaymentReceiptInput,
  ReversePaymentAllocationInput,
  ReversePaymentReceiptInput,
  VerifyPaymentReceiptInput,
} from '@prism/types';
import {
  LIVE_RECEIPT_STATUSES,
  allocationStates,
  checkAllocation,
  checkAttachEvidence,
  checkEarmark,
  checkRefund,
  checkReject,
  checkReverseAllocation,
  checkReverseReceipt,
  checkVerify,
  findPossibleDuplicate,
  normalizeReference,
  receiptBalance,
  type RuleResult,
} from '../../domain/payment-receipt.policy';
import type { BillingActor } from '../../contracts/billing-operations.types';
import { auditMetadata, isoDate, parseDate, requireBillingActor } from './billing-operations.utils';
import {
  findLiveReferenceReceipt,
  lockPaymentMilestone,
  lockPaymentReceipt,
  milestoneRemaining,
  refreshPaymentMilestone,
  referenceInUse,
} from './payment-ledger.store';
import { mapPaymentReceipt, receiptStatus, type ReceiptWithLedger } from './payment-receipt.mappers';

const DEFAULT_LIST_LIMIT = 50;
/** Receipts read to filter by unapplied money, which is computed from records and refunds rather than stored. */
const UNAPPLIED_SCAN_LIMIT = 500;
const POSSIBLE_DUPLICATE_SCAN_LIMIT = 20;
/** An event never has anywhere near this many open milestones; the cap only keeps the read bounded. */
const MAX_ALLOCATION_TARGETS = 50;

const hashOf = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

function enforce(result: RuleResult) {
  if (result.ok) return;
  throw result.kind === 'invalid' ? new BadRequestException(result.message) : new ConflictException(result.message);
}

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

type Tx = Prisma.TransactionClient;

/**
 * The receipt ledger: money that arrived outside P.R.I.S.M, how it was applied to milestones, and how it was undone or
 * paid back. Every change locks the receipt first and any milestone second, commits with its audit entry, and is
 * replayable by idempotency key.
 */
@Injectable()
export class PaymentReceiptService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_WRITER) private readonly auditWriter: AuditWriter,
    @Optional() @Inject(STORED_RECEIPT_EVIDENCE_READER) private readonly evidenceReader?: StoredReceiptEvidenceReader,
  ) {}

  async recordReceipt(input: RecordPaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    const receivedDate = parseDate(input.receivedDate);
    const referenceNumber = input.referenceNumber?.trim() ?? '';
    const referenceKey = normalizeReference(referenceNumber);
    const payloadHash = hashOf(input);
    try {
      const receiptId = await this.inTransaction(actor, `payment-receipt:${input.idempotencyKey ?? 'new'}`, async (tx, context) => {
        if (input.idempotencyKey) {
          const keyed = await tx.opsPaymentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
          if (keyed) return this.replayKeyed(keyed, payloadHash, 'Receipt');
        }
        if (input.eventId) await this.requireEvent(tx, input.eventId);
        if (referenceKey) {
          const existing = await findLiveReferenceReceipt(tx, input.method, referenceKey);
          if (existing) throw referenceInUse(existing);
        }
        const possibleDuplicateOfId = referenceKey ? null : await this.possibleDuplicate(tx, input, receivedDate);
        const created = await tx.opsPaymentReceipt.create({
          data: {
            id: `prcp_${randomUUID()}`,
            amount: input.amount,
            receivedDate,
            method: input.method,
            referenceNumber,
            referenceKey,
            payerName: input.payerName?.trim() ?? '',
            eventId: input.eventId ?? null,
            notes: input.notes?.trim() ?? '',
            possibleDuplicateOfId,
            recordedBy: actor.name,
            recordedById: actor.id,
            idempotencyKey: input.idempotencyKey ?? null,
            payloadHash,
          },
        });
        await writeAudit(this.auditWriter, created.eventId ?? undefined, actor.name, `Recorded ${created.method} receipt of PHP ${created.amount.toLocaleString('en-PH')}`, {
          actorRole: actor.role,
          actorEmail: actor.email,
          category: AuditCategory.Finance,
          actionType: AuditActionType.Create,
          affectedType: 'payment_receipt',
          affectedId: created.id,
          affectedLabel: referenceNumber || created.method,
          metadata: auditMetadata(actor, { amount: created.amount, referenceNumber, possibleDuplicateOfId }),
        }, context);
        if (input.allocation) {
          const locked = await this.lockedReceipt(tx, created.id);
          await this.applyAllocation(tx, context, locked, input.allocation.milestoneId, input.allocation.amount ?? input.amount, actor);
        }
        return created.id;
      });
      return await this.getReceipt(receiptId);
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      return this.resolveRecordRace(input, payloadHash, referenceKey);
    }
  }

  async listReceipts(query: ListPaymentReceiptsQuery): Promise<PrismPaymentReceipt[]> {
    const limit = query.limit ?? DEFAULT_LIST_LIMIT;
    const where: Prisma.OpsPaymentReceiptWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.unapplied ? { status: { in: [...LIVE_RECEIPT_STATUSES] } } : {}),
      ...(query.eventId ? { OR: [{ eventId: query.eventId }, { records: { some: { eventId: query.eventId } } }] } : {}),
    };
    const receipts = await this.loadReceipts(this.prisma, where, query.unapplied ? UNAPPLIED_SCAN_LIMIT : limit);
    const mapped = await this.mapAll(this.prisma, receipts);
    return (query.unapplied ? mapped.filter((receipt) => receipt.unapplied > 0) : mapped).slice(0, limit);
  }

  /** What a receipt can be applied to for one event: milestones still owed, never a superseded one. */
  async listAllocationTargets(eventId: string): Promise<PrismPaymentAllocationTarget[]> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, eventName: true } });
    if (!event) throw new NotFoundException('Event not found');
    const milestones = await this.prisma.opsPaymentMilestone.findMany({
      where: { eventId, supersededAt: null, remainingBalance: { gt: 0 } },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      take: MAX_ALLOCATION_TARGETS,
    });
    return milestones.map((milestone) => ({
      milestoneId: milestone.id,
      eventId,
      eventName: event.eventName,
      label: milestone.label,
      amount: milestone.amount,
      remainingBalance: milestone.remainingBalance,
      dueDate: isoDate(milestone.dueDate),
      status: milestone.status,
    }));
  }

  async getReceipt(receiptId: string): Promise<PrismPaymentReceipt> {
    const [receipt] = await this.loadReceipts(this.prisma, { id: receiptId }, 1);
    if (!receipt) throw new NotFoundException('Payment receipt not found');
    return (await this.mapAll(this.prisma, [receipt]))[0];
  }

  async allocate(receiptId: string, input: AllocatePaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    const payloadHash = hashOf({ receiptId, ...input });
    await this.inTransaction(actor, `payment-allocation:${receiptId}`, async (tx, context) => {
      if (input.idempotencyKey) {
        const keyed = await tx.opsPaymentRecord.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (keyed) {
          if (keyed.receiptId !== receiptId || (keyed.payloadHash && keyed.payloadHash !== payloadHash)) {
            throw new BadRequestException('Allocation idempotency key was reused for different content');
          }
          return;
        }
      }
      const receipt = await this.lockedReceipt(tx, receiptId);
      await this.applyAllocation(tx, context, receipt, input.milestoneId, input.amount, actor, { idempotencyKey: input.idempotencyKey, payloadHash });
    });
    return this.getReceipt(receiptId);
  }

  /**
   * Bind an uploaded, confirmed proof of payment to a receipt. The file must have been uploaded as evidence for this exact
   * receipt of its event, so a file cannot be pointed at a receipt it was never uploaded for. Attaching another replaces the
   * link and leaves the earlier file in storage.
   */
  async attachEvidence(receiptId: string, input: AttachPaymentReceiptEvidenceInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    const reader = this.evidenceReader;
    if (!reader) throw new ServiceUnavailableException('Evidence storage is unavailable');
    await this.inTransaction(actor, `payment-receipt-evidence:${receiptId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      enforce(checkAttachEvidence({ status: receiptStatus(receipt.status), hasEvent: Boolean(receipt.eventId) }));
      const evidence = await reader.findConfirmedReceiptEvidence({ eventId: receipt.eventId!, receiptId, objectId: input.objectId });
      if (!evidence) throw new BadRequestException('That file was not uploaded as evidence for this receipt, or it has not finished uploading');
      await tx.opsPaymentReceipt.update({ where: { id: receiptId }, data: { evidenceObjectId: input.objectId } });
      await this.audit(context, actor, receipt, AuditActionType.Update, `Attached evidence to receipt ${receipt.referenceNumber || receipt.id}`, { objectId: input.objectId, fileName: evidence.fileName });
    });
    return this.getReceipt(receiptId);
  }

  /** Say which event money held with no event was meant for. It then shows on that client's statement and can take evidence. */
  async earmark(receiptId: string, input: EarmarkPaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    await this.inTransaction(actor, `payment-receipt-earmark:${receiptId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      enforce(checkEarmark({ status: receiptStatus(receipt.status), hasEvent: Boolean(receipt.eventId) }));
      await this.requireEvent(tx, input.eventId);
      await tx.opsPaymentReceipt.update({ where: { id: receiptId }, data: { eventId: input.eventId } });
      await this.audit(context, actor, { ...receipt, eventId: input.eventId }, AuditActionType.Update, `Assigned receipt ${receipt.referenceNumber || receipt.id} to an event`, { eventId: input.eventId });
    });
    return this.getReceipt(receiptId);
  }

  async verify(receiptId: string, input: VerifyPaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    await this.inTransaction(actor, `payment-receipt-verify:${receiptId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      enforce(checkVerify(receiptStatus(receipt.status)));
      await tx.opsPaymentReceipt.update({
        where: { id: receiptId },
        data: { status: 'verified', verifiedAt: new Date(), verifiedBy: actor.name, verificationNotes: input.notes.trim() },
      });
      await this.audit(context, actor, receipt, AuditActionType.Update, `Verified receipt ${receipt.referenceNumber || receipt.id}`, { notes: input.notes.trim() });
    });
    return this.getReceipt(receiptId);
  }

  async reject(receiptId: string, input: RejectPaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    await this.inTransaction(actor, `payment-receipt-reject:${receiptId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      const active = [...allocationStates(receipt.records).values()].filter((state) => !state.reversed).length;
      enforce(checkReject({ status: receiptStatus(receipt.status), activeAllocations: active }));
      await tx.opsPaymentReceipt.update({
        where: { id: receiptId },
        // A receipt that stops counting gives up its reference key, so the same transfer can be entered correctly.
        data: { status: 'rejected', referenceKey: null, rejectedAt: new Date(), rejectedBy: actor.name, rejectionReason: input.reason.trim() },
      });
      await this.audit(context, actor, receipt, AuditActionType.Update, `Rejected receipt ${receipt.referenceNumber || receipt.id}`, { reason: input.reason.trim() });
    });
    return this.getReceipt(receiptId);
  }

  /** The money never arrived (a bounced cheque): every payment applied from it is reversed and the receipt stops counting. */
  async reverseReceipt(receiptId: string, input: ReversePaymentReceiptInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    await this.inTransaction(actor, `payment-receipt-reverse:${receiptId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      const balance = receiptBalance(receipt.amount, receipt.records, receipt.refunds);
      enforce(checkReverseReceipt({ status: receiptStatus(receipt.status), refunded: balance.refunded }));
      const states = allocationStates(receipt.records);
      for (const record of receipt.records.filter((candidate) => states.get(candidate.id)?.reversed === false)) {
        await this.reverseRecord(tx, context, receipt, record.id, input.reason.trim(), actor);
      }
      await tx.opsPaymentReceipt.update({
        where: { id: receiptId },
        data: { status: 'reversed', referenceKey: null, reversedAt: new Date(), reversedBy: actor.name, reversalReason: input.reason.trim() },
      });
      await this.audit(context, actor, receipt, AuditActionType.Update, `Reversed receipt ${receipt.referenceNumber || receipt.id}`, { reason: input.reason.trim() });
    });
    return this.getReceipt(receiptId);
  }

  async reverseAllocation(receiptId: string, recordId: string, input: ReversePaymentAllocationInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    await this.inTransaction(actor, `payment-allocation-reverse:${recordId}`, async (tx, context) => {
      const receipt = await this.lockedReceipt(tx, receiptId);
      const record = receipt.records.find((candidate) => candidate.id === recordId);
      if (!record) throw new NotFoundException('Payment allocation not found on this receipt');
      enforce(checkReverseAllocation(record, allocationStates(receipt.records).get(recordId)?.reversed ?? false));
      await this.reverseRecord(tx, context, receipt, recordId, input.reason.trim(), actor);
    });
    return this.getReceipt(receiptId);
  }

  /** A refund of unapplied money that was paid back outside P.R.I.S.M. It only keeps the receipt balance true. */
  async recordRefund(receiptId: string, input: RecordPaymentRefundInput, actor: BillingActor): Promise<PrismPaymentReceipt> {
    actor = requireBillingActor(actor);
    const refundedDate = parseDate(input.refundedDate);
    const payloadHash = hashOf({ receiptId, ...input });
    await this.inTransaction(actor, `payment-refund:${receiptId}`, async (tx, context) => {
      if (input.idempotencyKey) {
        const keyed = await tx.opsPaymentRefund.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
        if (keyed) {
          if (keyed.receiptId !== receiptId || (keyed.payloadHash && keyed.payloadHash !== payloadHash)) {
            throw new BadRequestException('Refund idempotency key was reused for different content');
          }
          return;
        }
      }
      const receipt = await this.lockedReceipt(tx, receiptId);
      const balance = receiptBalance(receipt.amount, receipt.records, receipt.refunds);
      enforce(checkRefund({ status: receiptStatus(receipt.status), unapplied: balance.unapplied, amount: input.amount }));
      await tx.opsPaymentRefund.create({
        data: {
          id: `prfd_${randomUUID()}`,
          receiptId,
          amount: input.amount,
          refundedDate,
          method: input.method,
          referenceNumber: input.referenceNumber?.trim() ?? '',
          reason: input.reason.trim(),
          recordedBy: actor.name,
          recordedById: actor.id,
          idempotencyKey: input.idempotencyKey ?? null,
          payloadHash,
        },
      });
      await this.audit(context, actor, receipt, AuditActionType.Create, `Recorded refund of PHP ${input.amount.toLocaleString('en-PH')} for receipt ${receipt.referenceNumber || receipt.id}`, {
        amount: input.amount,
        reason: input.reason.trim(),
        refundReference: input.referenceNumber?.trim() ?? '',
      });
    });
    return this.getReceipt(receiptId);
  }

  private async applyAllocation(
    tx: Tx,
    context: PrismTransactionContext,
    receipt: ReceiptWithLedger,
    milestoneId: string,
    amount: number,
    actor: BillingActor,
    replay: { idempotencyKey?: string; payloadHash?: string } = {},
  ) {
    const milestone = await lockPaymentMilestone(tx, milestoneId);
    if (!milestone) throw new NotFoundException('Payment milestone not found');
    if (milestone.supersededAt) throw new BadRequestException('A superseded milestone cannot receive a payment');
    const balance = receiptBalance(receipt.amount, receipt.records, receipt.refunds);
    enforce(checkAllocation({
      status: receiptStatus(receipt.status),
      unapplied: balance.unapplied,
      milestoneRemaining: await milestoneRemaining(tx, milestone),
      amount,
    }));
    const record = await tx.opsPaymentRecord.create({
      data: {
        id: `payrec_${randomUUID()}`,
        eventId: milestone.eventId,
        milestoneId,
        amountReceived: amount,
        paymentDate: receipt.receivedDate,
        paymentMethod: receipt.method,
        referenceNumber: receipt.referenceNumber,
        receiptId: receipt.id,
        recordedBy: actor.name,
        idempotencyKey: replay.idempotencyKey ?? null,
        payloadHash: replay.payloadHash ?? null,
      },
    });
    await refreshPaymentMilestone(tx, milestone);
    await writeAudit(this.auditWriter, milestone.eventId, actor.name, `Applied PHP ${amount.toLocaleString('en-PH')} from receipt ${receipt.referenceNumber || receipt.id} to ${milestone.label}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Finance,
      actionType: AuditActionType.Create,
      affectedType: 'payment_milestone',
      affectedId: milestoneId,
      affectedLabel: milestone.label,
      metadata: auditMetadata(actor, { receiptId: receipt.id, recordId: record.id, amount }),
    }, context);
  }

  /** Write the negative record that undoes one payment, then bring its milestone back in line. */
  private async reverseRecord(tx: Tx, context: PrismTransactionContext, receipt: ReceiptWithLedger, recordId: string, reason: string, actor: BillingActor) {
    const original = receipt.records.find((candidate) => candidate.id === recordId);
    if (!original) throw new NotFoundException('Payment allocation not found on this receipt');
    const milestone = await lockPaymentMilestone(tx, original.milestoneId);
    if (!milestone) throw new NotFoundException('Payment milestone not found');
    await tx.opsPaymentRecord.create({
      data: {
        id: `payrec_${randomUUID()}`,
        eventId: original.eventId,
        milestoneId: original.milestoneId,
        amountReceived: -original.amountReceived,
        paymentDate: new Date(),
        paymentMethod: original.paymentMethod,
        referenceNumber: original.referenceNumber,
        receiptId: receipt.id,
        reversesRecordId: original.id,
        reversalReason: reason,
        recordedBy: actor.name,
      },
    });
    await refreshPaymentMilestone(tx, milestone);
    await writeAudit(this.auditWriter, original.eventId, actor.name, `Reversed PHP ${original.amountReceived.toLocaleString('en-PH')} applied to ${milestone.label}`, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Finance,
      actionType: AuditActionType.Update,
      affectedType: 'payment_milestone',
      affectedId: milestone.id,
      affectedLabel: milestone.label,
      metadata: auditMetadata(actor, { receiptId: receipt.id, reversedRecordId: original.id, reason }),
    }, context);
  }

  private audit(context: PrismTransactionContext, actor: BillingActor, receipt: OpsPaymentReceipt, actionType: string, action: string, metadata: Record<string, unknown>) {
    return writeAudit(this.auditWriter, receipt.eventId ?? undefined, actor.name, action, {
      actorRole: actor.role,
      actorEmail: actor.email,
      category: AuditCategory.Finance,
      actionType,
      affectedType: 'payment_receipt',
      affectedId: receipt.id,
      affectedLabel: receipt.referenceNumber || receipt.method,
      metadata: auditMetadata(actor, { receiptId: receipt.id, ...metadata }),
    }, context);
  }

  private inTransaction<T>(actor: BillingActor, correlationId: string, work: (tx: Tx, context: PrismTransactionContext) => Promise<T>) {
    return this.prisma.$transaction((tx) => work(tx, { prisma: tx, actorId: actor.id, correlationId }));
  }

  private async lockedReceipt(tx: Tx, receiptId: string): Promise<ReceiptWithLedger> {
    await lockPaymentReceipt(tx, receiptId);
    const [receipt] = await this.loadReceipts(tx, { id: receiptId }, 1);
    if (!receipt) throw new NotFoundException('Payment receipt not found');
    return receipt;
  }

  private loadReceipts(db: Tx | PrismaService, where: Prisma.OpsPaymentReceiptWhereInput, take: number): Promise<ReceiptWithLedger[]> {
    return db.opsPaymentReceipt.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      // QUERY_AUDIT_ALLOW_BOUNDED_TAKE: callers pass 1, the request limit (at most 100) or UNAPPLIED_SCAN_LIMIT (500).
      take,
      include: { records: { orderBy: [{ recordedAt: 'asc' }, { id: 'asc' }] }, refunds: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });
  }

  private async mapAll(db: Tx | PrismaService, receipts: ReceiptWithLedger[]): Promise<PrismPaymentReceipt[]> {
    const milestoneIds = [...new Set(receipts.flatMap((receipt) => [...receipt.records.map((record) => record.milestoneId), ...(receipt.intendedMilestoneId ? [receipt.intendedMilestoneId] : [])]))];
    const milestones = milestoneIds.length === 0
      ? []
      : await db.opsPaymentMilestone.findMany({ where: { id: { in: milestoneIds } }, select: { id: true, label: true } });
    const labels = new Map(milestones.map((milestone) => [milestone.id, milestone.label]));
    const evidence = await this.evidenceReader?.describeReceiptEvidence(receipts.flatMap((receipt) => (receipt.evidenceObjectId ? [receipt.evidenceObjectId] : [])));
    return receipts.map((receipt) => mapPaymentReceipt(receipt, labels, evidence));
  }

  private async requireEvent(tx: Tx, eventId: string) {
    const event = await tx.opsEvent.findUnique({ where: { id: eventId }, select: { id: true } });
    if (!event) throw new NotFoundException('Event not found');
  }

  /** Same amount, method, day and payer as a live receipt with no bank reference to tell them apart: flag, never block. */
  private async possibleDuplicate(tx: Tx, input: RecordPaymentReceiptInput, receivedDate: Date): Promise<string | null> {
    const payerName = input.payerName?.trim() ?? '';
    if (!payerName) return null;
    const dayStart = new Date(isoDate(receivedDate));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
    const candidates = await tx.opsPaymentReceipt.findMany({
      where: { method: input.method, amount: input.amount, receivedDate: { gte: dayStart, lt: dayEnd }, status: { in: [...LIVE_RECEIPT_STATUSES] } },
      select: { id: true, amount: true, method: true, receivedDate: true, payerName: true },
      orderBy: { createdAt: 'desc' },
      take: POSSIBLE_DUPLICATE_SCAN_LIMIT,
    });
    const match = findPossibleDuplicate(
      candidates.map((candidate) => ({ ...candidate, receivedDate: isoDate(candidate.receivedDate) })),
      { amount: input.amount, method: input.method, receivedDate: isoDate(receivedDate), payerName },
    );
    return match?.id ?? null;
  }

  private replayKeyed(keyed: Pick<OpsPaymentReceipt, 'id' | 'payloadHash'>, payloadHash: string, label: string) {
    if (keyed.payloadHash && keyed.payloadHash !== payloadHash) throw new BadRequestException(`${label} idempotency key was reused for different content`);
    return keyed.id;
  }

  /** A concurrent identical request or a concurrent entry of the same reference won the race: answer as the loser should. */
  private async resolveRecordRace(input: RecordPaymentReceiptInput, payloadHash: string, referenceKey: string | null): Promise<PrismPaymentReceipt> {
    if (input.idempotencyKey) {
      const keyed = await this.prisma.opsPaymentReceipt.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
      if (keyed) return this.getReceipt(this.replayKeyed(keyed, payloadHash, 'Receipt'));
    }
    if (referenceKey) {
      const existing = await findLiveReferenceReceipt(this.prisma, input.method, referenceKey);
      if (existing) throw referenceInUse(existing);
    }
    throw new ConflictException('This receipt was recorded at the same moment by another request. Refresh and check before recording it again.');
  }
}
