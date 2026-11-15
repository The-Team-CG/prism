import { Injectable } from '@nestjs/common';
import { EventAccessPolicyService } from '@prism/kernel/access-control';
import { PrismaService } from '@prism/kernel/database';
import { OpsUserRole } from '@prism/kernel/event-core';
import type { PrismFinanceDesk, PrismFinanceDeskPayout, PrismVerifiedEventActor } from '@prism/types';
import { buildFinanceDesk, type FinanceDeskFacts } from '../../domain/finance-desk.policy';
import { LIVE_RECEIPT_STATUSES, receiptBalance } from '../../domain/payment-receipt.policy';
import { buildStatementOfAccount } from '../../domain/statement-of-account.policy';

/** Active events and the money rows around them stay in the hundreds; the caps only keep every read finite. */
const MAX_EVENTS = 500;
const MAX_ROWS = 5000;

const isoDate = (value: Date) => value.toISOString().slice(0, 10);
const manilaToday = (now: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila' }).format(now);

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(key(row), [...(groups.get(key(row)) ?? []), row]);
  return groups;
}

/**
 * PMCM finance across every active event, in one read: what is overdue, what money to check or apply, disputes and
 * corrections to answer, supplier payouts due, and each event's statement and payments.
 */
@Injectable()
export class FinanceDeskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly policy: EventAccessPolicyService,
  ) {}

  async desk(verifiedActor: PrismVerifiedEventActor, now = new Date()): Promise<PrismFinanceDesk> {
    const actor = this.policy.resolveEventScopedActor(verifiedActor);
    await this.policy.requireActorRole(actor, [OpsUserRole.PmcmAdmin, OpsUserRole.System], 'finance desk');
    return buildFinanceDesk(await this.facts(now), now.toISOString());
  }

  private async facts(now: Date): Promise<FinanceDeskFacts> {
    const events = await this.prisma.opsEvent.findMany({
      where: { archived: false },
      select: { id: true, eventName: true, eventDate: true, clientName: true },
      orderBy: [{ eventDate: 'asc' }, { id: 'asc' }],
      take: MAX_EVENTS,
    });
    const eventIds = events.map((event) => event.id);
    const scope = { eventId: { in: eventIds } };
    const [statements, milestones, records, receipts, disputes, corrections, draftSources, payables] = await Promise.all([
      this.prisma.opsBillingStatement.findMany({
        where: { ...scope, status: { not: 'superseded' } },
        select: { id: true, eventId: true, number: true, totalAmount: true, sentAt: true, generatedAt: true, paymentMethods: true },
        orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }],
        take: MAX_ROWS,
      }),
      this.prisma.opsPaymentMilestone.findMany({
        where: { ...scope, supersededAt: null },
        select: { id: true, eventId: true, label: true, dueDate: true, amount: true, amountPaid: true, creditApplied: true, remainingBalance: true, status: true },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: MAX_ROWS,
      }),
      this.prisma.opsPaymentRecord.findMany({
        where: { ...scope, milestone: { supersededAt: null } },
        select: { id: true, eventId: true, milestoneId: true, receiptId: true, amountReceived: true, paymentDate: true, paymentMethod: true, referenceNumber: true, reversesRecordId: true },
        take: MAX_ROWS,
      }),
      // Money still being checked, or checked and not yet applied, wherever it was meant to go.
      this.prisma.opsPaymentReceipt.findMany({
        where: { status: { in: [...LIVE_RECEIPT_STATUSES] }, OR: [{ eventId: null }, scope] },
        include: { records: { select: { amountReceived: true, milestoneId: true } }, refunds: { select: { id: true, amount: true, refundedDate: true, method: true, referenceNumber: true } } },
        orderBy: [{ receivedDate: 'asc' }, { id: 'asc' }],
        take: MAX_ROWS,
      }),
      this.prisma.opsBillingDispute.findMany({ where: { ...scope, status: 'open' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_ROWS }),
      this.prisma.opsBillingCorrection.findMany({ where: { ...scope, status: 'pending' }, orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], take: MAX_ROWS }),
      this.prisma.opsBillingSource.findMany({ where: { ...scope, status: 'draft' }, select: { id: true, eventId: true, sourceLabel: true, totalAmount: true }, take: MAX_ROWS }),
      this.prisma.opsSupplierPayableMilestone.findMany({
        where: { ...scope, status: { not: 'cancelled' } },
        include: { supplier: { select: { name: true } }, payouts: { select: { kind: true, amount: true } } },
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
        take: MAX_ROWS,
      }),
    ]);

    const names = new Map(events.map((event) => [event.id, event.eventName]));
    const labels = new Map(milestones.map((milestone) => [milestone.id, milestone.label]));
    const latest = new Map<string, (typeof statements)[number]>();
    for (const statement of statements) if (!latest.has(statement.eventId)) latest.set(statement.eventId, statement);
    const milestonesByEvent = groupBy(milestones, (row) => row.eventId);
    const recordsByEvent = groupBy(records, (row) => row.eventId);
    const receiptsByEvent = groupBy(receipts.filter((receipt) => receipt.eventId), (row) => row.eventId!);
    const disputesByEvent = groupBy(disputes, (row) => row.eventId);
    const balanceOf = (receipt: (typeof receipts)[number]) => receiptBalance(receipt.amount, receipt.records, receipt.refunds).unapplied;

    return {
      today: manilaToday(now),
      events: events.map((event) => ({ id: event.id, eventName: event.eventName, eventDate: event.eventDate ? isoDate(event.eventDate) : null, clientName: event.clientName })),
      statements: [...latest.values()].map((statement) => {
        const eventReceipts = receiptsByEvent.get(statement.eventId) ?? [];
        return {
          sent: statement.sentAt !== null,
          statement: {
            eventId: statement.eventId,
            eventName: names.get(statement.eventId) ?? '',
            generatedAt: now.toISOString(),
            ...buildStatementOfAccount({
              viewer: 'pmcm',
              statement,
              milestones: milestonesByEvent.get(statement.eventId) ?? [],
              records: recordsByEvent.get(statement.eventId) ?? [],
              refunds: eventReceipts.flatMap((receipt) => receipt.refunds),
              receipts: eventReceipts.map((receipt) => ({
                id: receipt.id, amount: receipt.amount, receivedDate: receipt.receivedDate, method: receipt.method, referenceNumber: receipt.referenceNumber,
                status: receipt.status, source: receipt.source, rejectionReason: receipt.rejectionReason, intendedMilestoneId: receipt.intendedMilestoneId,
                hasProof: Boolean(receipt.evidenceObjectId), unapplied: balanceOf(receipt), createdAt: receipt.createdAt,
              })),
              openDisputes: (disputesByEvent.get(statement.eventId) ?? []).filter((dispute) => dispute.statementId === statement.id),
            }),
          },
        };
      }),
      receipts: receipts.map((receipt) => {
        const applied = receipt.records.find((record) => record.amountReceived > 0)?.milestoneId;
        const forMilestone = applied ?? receipt.intendedMilestoneId;
        return {
          id: receipt.id, eventId: receipt.eventId, amount: receipt.amount, receivedDate: isoDate(receipt.receivedDate), method: receipt.method,
          referenceNumber: receipt.referenceNumber, status: receipt.status === 'verified' ? 'verified' as const : 'recorded' as const,
          source: receipt.source === 'client' ? 'client' as const : 'pmcm' as const, unapplied: balanceOf(receipt),
          forPayment: forMilestone ? labels.get(forMilestone) ?? null : null, hasProof: Boolean(receipt.evidenceObjectId),
        };
      }),
      disputes: disputes.map((dispute) => ({ id: dispute.id, eventId: dispute.eventId, amount: dispute.amount, reason: dispute.reason, payment: dispute.milestoneId ? labels.get(dispute.milestoneId) ?? null : null, raisedOn: isoDate(dispute.createdAt) })),
      corrections: corrections.map((correction) => ({ id: correction.id, eventId: correction.eventId, reason: correction.reason, requestedOn: isoDate(correction.createdAt) })),
      draftSources: draftSources.map((source) => ({ id: source.id, eventId: source.eventId, label: source.sourceLabel, amount: source.totalAmount })),
      unsentStatements: [...latest.values()].filter((statement) => statement.sentAt === null).map((statement) => ({ id: statement.id, eventId: statement.eventId, number: statement.number, amount: statement.totalAmount })),
      payouts: payables.map((payable): PrismFinanceDeskPayout => ({
        id: payable.id, eventId: payable.eventId, eventName: names.get(payable.eventId) ?? '', supplierName: payable.supplier.name, label: payable.label,
        amount: payable.amount, released: payable.payouts.reduce((total, payout) => total + (payout.kind === 'release' ? payout.amount : -payout.amount), 0),
        dueDate: payable.dueDate ? isoDate(payable.dueDate) : null, status: payable.status,
      })),
    };
  }
}
