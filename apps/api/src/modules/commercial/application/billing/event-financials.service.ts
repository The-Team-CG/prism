import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prism/kernel/database';
import type { PrismEventFinancialSummary } from '@prism/types';
import { computeEventFinancials } from '../../domain/event-financials.policy';
import { LIVE_RECEIPT_STATUSES, receiptBalance } from '../../domain/payment-receipt.policy';

/** Statuses of a supplier quote that commit PMCM to its cost. */
const COMMITTED_QUOTE_STATUSES = ['selected', 'locked'];
/** An event has a handful of each of these; the bounds only keep every read finite. */
const MAX_ROWS = 2000;

/**
 * Where one event stands financially: what was estimated and billed, what has been collected and how far to trust it,
 * what supplier cost is committed and paid, and the margin that follows. It only reads Commercial's own tables.
 */
@Injectable()
export class EventFinancialsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(eventId: string): Promise<PrismEventFinancialSummary> {
    const event = await this.prisma.opsEvent.findUnique({ where: { id: eventId }, select: { id: true, eventName: true } });
    if (!event) throw new NotFoundException('Event not found');
    const [statement, estimate, milestones, records, earmarked, quotes, payables, payouts] = await Promise.all([
      this.prisma.opsBillingStatement.findFirst({ where: { eventId }, orderBy: [{ generatedAt: 'desc' }, { id: 'asc' }], select: { number: true, totalAmount: true } }),
      this.prisma.opsCostEstimate.findFirst({ where: { eventId }, orderBy: [{ createdAt: 'desc' }, { id: 'asc' }], include: { lines: true } }),
      this.prisma.opsPaymentMilestone.findMany({ where: { eventId, supersededAt: null }, select: { amount: true, creditApplied: true, remainingBalance: true, dueDate: true }, take: MAX_ROWS }),
      // Only money applied to the current milestones: payments on a replaced milestone are carried forward as credit.
      this.prisma.opsPaymentRecord.findMany({ where: { eventId, milestone: { supersededAt: null } }, select: { receiptId: true, amountReceived: true }, take: MAX_ROWS }),
      this.prisma.opsPaymentReceipt.findMany({
        where: { eventId, status: { in: [...LIVE_RECEIPT_STATUSES] } },
        include: { records: { select: { amountReceived: true } }, refunds: { select: { amount: true } } },
        take: MAX_ROWS,
      }),
      this.prisma.opsSupplierQuote.findMany({ where: { eventId, status: { in: COMMITTED_QUOTE_STATUSES } }, select: { id: true, category: true, amount: true }, take: MAX_ROWS }),
      this.prisma.opsSupplierPayableMilestone.findMany({ where: { eventId }, select: { amount: true }, take: MAX_ROWS }),
      this.prisma.opsSupplierPayoutRecord.findMany({ where: { eventId }, select: { quoteId: true, kind: true, amount: true }, take: MAX_ROWS }),
    ]);

    const appliedByReceipt = netByReceipt(records);
    const figures = computeEventFinancials({
      statement,
      estimate: estimate ? { status: estimate.status, totalAmount: estimate.totalAmount, lines: estimate.lines.map((line) => ({ category: line.category, totalAmount: line.totalAmount })) } : null,
      milestones,
      appliedByReceipt,
      receiptStatus: await this.receiptStatuses(appliedByReceipt),
      unapplied: earmarked.reduce((total, receipt) => total + Math.max(0, receiptBalance(receipt.amount, receipt.records, receipt.refunds).unapplied), 0),
      quotes,
      payables,
      payouts,
      now: new Date(),
    });
    return { eventId, eventName: event.eventName, generatedAt: new Date().toISOString(), ...figures };
  }

  private async receiptStatuses(applied: Array<{ receiptId: string | null }>) {
    const ids = [...new Set(applied.flatMap((entry) => (entry.receiptId ? [entry.receiptId] : [])))];
    if (ids.length === 0) return new Map<string, string>();
    const receipts = await this.prisma.opsPaymentReceipt.findMany({ where: { id: { in: ids } }, select: { id: true, status: true }, take: MAX_ROWS });
    return new Map(receipts.map((receipt) => [receipt.id, receipt.status]));
  }
}

/** Net amount applied per receipt. A record with no receipt keeps its own entry, so it is never mistaken for a verified one. */
function netByReceipt(records: Array<{ receiptId: string | null; amountReceived: number }>) {
  const totals = new Map<string | null, number>();
  for (const record of records) totals.set(record.receiptId, (totals.get(record.receiptId) ?? 0) + record.amountReceived);
  return [...totals.entries()].map(([receiptId, amount]) => ({ receiptId, amount }));
}
